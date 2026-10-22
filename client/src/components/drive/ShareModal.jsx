import React, { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Spinner from "../common/Spinner";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import {
  listDriveShares,
  createDriveShare,
  revokeDriveShare,
} from "../../api/driveApi";

const PERMISSION_LABELS = {
  download: "Anyone with the link can view and download",
  preview: "Anyone with the link can view (download disabled)",
};

function shareUrlForToken(token) {
  return window.location.origin + "/drive/share/" + token;
}

export default function ShareModal({ open, onClose, nodeId, fileName }) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState("preview");
  const [expiresInDays, setExpiresInDays] = useState("");

  function load() {
    setLoading(true);
    listDriveShares(nodeId)
      .then(function (data) {
        setShares(data.shares || []);
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setLoading(false);
      });
  }

  useEffect(
    function () {
      if (open && nodeId) {
        setPermission(isAdmin ? "download" : "preview");
        setExpiresInDays("");
        load();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [open, nodeId]
  );

  function handleCreate() {
    setBusy(true);
    const payload = { permission: permission };
    if (expiresInDays && Number(expiresInDays) > 0) {
      payload.expiresInDays = Number(expiresInDays);
    }
    createDriveShare(nodeId, payload)
      .then(function (share) {
        setShares(function (prev) {
          return [{ shareId: share.shareId, token: share.token, permission: share.permission, expiresAt: share.expiresAt }, ...prev];
        });
        toast.success("Share link created");
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setBusy(false);
      });
  }

  function handleCopy(token) {
    navigator.clipboard
      .writeText(shareUrlForToken(token))
      .then(function () {
        toast.success("Share link copied to clipboard");
      })
      .catch(function () {
        toast.error("Could not copy the link");
      });
  }

  function handleRevoke(shareId) {
    setBusy(true);
    revokeDriveShare(nodeId, shareId)
      .then(function () {
        setShares(function (prev) {
          return prev.filter(function (s) {
            return s.shareId !== shareId;
          });
        });
        toast.success("Share link revoked");
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setBusy(false);
      });
  }

  return (
    <Modal open={open} onClose={onClose} title="Share this file">
      <div className="space-y-5">
        <p className="text-body-sm text-text-secondary">
          Create a secure link to <span className="font-semibold text-text-primary">{fileName}</span>.
          Anyone with the link can view it without logging in. You can revoke it at any time.
        </p>

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-surface-low rounded-xl p-4 space-y-3">
              <div>
                <label className="font-label-md text-label-md text-text-primary block mb-1.5">
                  Permission
                </label>
                <select
                  value={permission}
                  onChange={function (e) {
                    setPermission(e.target.value);
                  }}
                  className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {isAdmin ? <option value="download">View + Download</option> : null}
                  <option value="preview">Preview only</option>
                </select>
                <p className="text-body-xs text-text-muted mt-1.5">
                  {PERMISSION_LABELS[permission]}
                </p>
              </div>
              <div>
                <label className="font-label-md text-label-md text-text-primary block mb-1.5">
                  Expires after (days, optional)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={expiresInDays}
                  onChange={function (e) {
                    setExpiresInDays(e.target.value);
                  }}
                  placeholder="Never expires"
                  className="w-full rounded-lg border border-border-subtle bg-white px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <Button onClick={handleCreate} loading={busy} fullWidth>
                Create share link
              </Button>
            </div>

            {shares.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-label-md text-label-md text-text-muted uppercase tracking-wider">
                  Active share links ({shares.length})
                </h4>
                {shares.map(function (share) {
                  return (
                    <div
                      key={share.shareId}
                      className="border border-border-subtle rounded-xl p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body-sm font-medium text-text-primary break-all">
                          {shareUrlForToken(share.token)}
                        </span>
                        <span className="shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={function () {
                              handleCopy(share.token);
                            }}
                          >
                            Copy
                          </Button>
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body-xs text-text-muted">
                          {PERMISSION_LABELS[share.permission]}
                          {share.expiresAt
                            ? " · Expires " + new Date(share.expiresAt).toLocaleDateString()
                            : ""}
                        </span>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={busy}
                          onClick={function () {
                            handleRevoke(share.shareId);
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}
