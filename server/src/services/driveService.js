const { google } = require("googleapis");
const stream = require("stream");
const env = require("../config/env");
const logger = require("../utils/logger");

function getAuth() {
  const oauth2Client = new google.auth.OAuth2(
    env.google.clientId,
    env.google.clientSecret,
    env.google.redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: env.google.refreshToken,
  });

  return oauth2Client;
}

function getDriveClient() {
  return google.drive({ version: "v3", auth: getAuth() });
}

module.exports = {
  async uploadFile(buffer, filename, mimeType, customFolderId) {
    const drive = getDriveClient();
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    const parentFolder =
      customFolderId || env.google.driveFolderId || undefined;

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: parentFolder ? [parentFolder] : undefined,
      },
      media: {
        mimeType: mimeType,
        body: bufferStream,
      },
      fields: "id, name, size, mimeType",
    });

    return {
      driveFileId: response.data.id,
      name: response.data.name,
      sizeBytes: Number(response.data.size) || buffer.length,
      mimeType: response.data.mimeType,
    };
  },

  async streamFile(driveFileId, res, rangeHeader) {
    const drive = getDriveClient();
    const requestConfig = { responseType: "stream" };
    if (rangeHeader) {
      requestConfig.headers = { Range: rangeHeader };
    }

    const driveResponse = await drive.files.get(
      { fileId: driveFileId, alt: "media" },
      requestConfig
    );

    // Forward partial content (206) metadata when Google Drive honoured the
    // Range request, so clients (e.g. pdf.js) can fetch a PDF page by page.
    const status = driveResponse.status || 200;
    const headers = driveResponse.headers || {};

    if (status === 206) {
      if (headers["content-range"]) {
        res.setHeader("Content-Range", headers["content-range"]);
      }
      if (headers["content-length"]) {
        res.setHeader("Content-Length", headers["content-length"]);
      }
      res.status(206);
    } else if (status === 200 && headers["content-length"]) {
      res.setHeader("Content-Length", headers["content-length"]);
    }

    return new Promise(function (resolve, reject) {
      driveResponse.data
        .on("end", function () {
          resolve();
        })
        .on("error", function (err) {
          logger.error("Drive stream error for file " + driveFileId, err);
          reject(err);
        })
        .pipe(res);
    });
  },

  async deleteFile(driveFileId) {
    const drive = getDriveClient();
    try {
      await drive.files.delete({ fileId: driveFileId });
    } catch (err) {
      logger.error("Failed to delete Drive file " + driveFileId, err);
    }
  },

  async listFolders(parentFolderId) {
    const drive = getDriveClient();
    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id, name, createdTime)",
      orderBy: "name",
    });
    return response.data.files || [];
  },

  async listPdfsInFolder(folderId) {
    const drive = getDriveClient();
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
      fields: "files(id, name, size, createdTime)",
      orderBy: "name",
    });
    return response.data.files || [];
  },

  async getThumbnail(fileId) {
    const drive = getDriveClient();
    try {
      const response = await drive.files.get(
        {
          fileId: fileId,
          alt: "media",
        },
        {
          responseType: "arraybuffer",
          headers: { Range: "bytes=0-0" },
        }
      );
      void response;
    } catch (err) {
      logger.error("Drive thumbnail range probe failed for " + fileId, err);
    }

    try {
      const meta = await drive.files.get({
        fileId: fileId,
        fields: "thumbnailLink, hasThumbnail, mimeType",
      });
      const link = meta.data && meta.data.thumbnailLink;
      if (link) {
        const oauth2 = getAuth();
        const token = await oauth2.getAccessToken();
        const accessToken = token && token.token ? token.token : token;
        const thumbUrl = String(link).replace(/=s\d+$/, "=s400");
        const res = await fetch(thumbUrl, {
          headers: accessToken
            ? { Authorization: "Bearer " + accessToken }
            : {},
        });
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const mime =
            res.headers.get("content-type") || "image/png";
          if (String(mime).indexOf("image/") === 0) {
            return { mimeType: mime, buffer: Buffer.from(arrayBuf) };
          }
        }
      }
    } catch (err) {
      logger.error("Drive thumbnailLink fetch failed for " + fileId, err);
    }
    return null;
  },

  async getFileMetadata(fileId) {
    const drive = getDriveClient();
    const response = await drive.files.get({
      fileId,
      fields: "id, name, size, mimeType, parents",
    });
    return response.data;
  },

  // List every non-trashed child (folders AND files) of a Drive folder,
  // following pagination. Only metadata is requested (no media download).
  async listChildren(parentFolderId) {
    const drive = getDriveClient();
    const children = [];
    let pageToken = null;

    do {
      const params = {
        q:
          "'" +
          parentFolderId +
          "' in parents and trashed = false",
        fields:
          "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime)",
        orderBy: "name",
        pageSize: 500,
        pageToken: pageToken || undefined,
      };

      const response = await drive.files.list(params);
      const files = response.data.files || [];
      for (let i = 0; i < files.length; i++) {
        children.push(files[i]);
      }
      pageToken = response.data.nextPageToken || null;
    } while (pageToken);

    return children;
  },

  // Recursively walk the folder tree rooted at `rootFolderId`, returning flat
  // nodes annotated with kind (folder/file), depth relative to the root, and
  // the human-readable path. Nodes are emitted breadth-first so parents always
  // precede their children. Throws on any Drive API error so the caller can
  // abort the sync safely instead of persisting a partial tree.
  async walkTree(rootFolderId) {
    const FOLDER_MIME = "application/vnd.google-apps.folder";
    const nodes = [];
    const queue = [
      { driveId: rootFolderId, depth: 0, path: "", parentDriveId: null },
    ];
    const enqueued = new Set([rootFolderId]);

    while (queue.length > 0) {
      const current = queue.shift();

      let children;
      try {
        children = await this.listChildren(current.driveId);
      } catch (err) {
        // Keep the human-readable folder-path context, but preserve the
        // original provider error as `cause` so callers (and the sanitized
        // OAuth diagnostic) can still read response.status / response.data
        // instead of seeing only the wrapper message.
        throw new Error(
          "Failed to list children of " + current.path + ": " + err.message,
          { cause: err }
        );
      }

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!child || !child.id) continue;

        const isFolder = child.mimeType === FOLDER_MIME;
        const depth = current.depth + 1;
        const path =
          current.path === "" ? child.name : current.path + "/" + child.name;

        nodes.push({
          driveId: child.id,
          parentDriveId: current.driveId,
          name: child.name,
          mimeType: child.mimeType,
          kind: isFolder ? "folder" : "file",
          depth: depth,
          path: path,
          sizeBytes: child.size ? Number(child.size) : null,
          createdTime: child.createdTime ? new Date(child.createdTime) : null,
          modifiedTime: child.modifiedTime
            ? new Date(child.modifiedTime)
            : null,
        });

        if (isFolder && !enqueued.has(child.id)) {
          enqueued.add(child.id);
          queue.push({
            driveId: child.id,
            depth: depth,
            path: path,
            parentDriveId: current.driveId,
          });
        }
      }
    }

    return nodes;
  },
};
