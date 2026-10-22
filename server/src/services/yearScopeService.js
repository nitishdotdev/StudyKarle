function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyYearFolder(name) {
  const n = normalizeName(name);
  if (!n) return null;
  if (/^(year\s*1|1st\s*year|first\s*year|y1)$/.test(n)) return 1;
  if (/^(year\s*2|2nd\s*year|second\s*year|y2)$/.test(n)) return 2;
  return null;
}

function isYearOneOrTwoFolderName(name) {
  return classifyYearFolder(name) !== null;
}

function isProtectedByAncestry(ancestors) {
  const list = Array.isArray(ancestors) ? ancestors : [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const name = item && typeof item === "object" ? item.name : item;
    if (classifyYearFolder(name) !== null) return true;
  }
  return false;
}

function folderNamesFromPath(path, kind) {
  const raw = String(path || "");
  if (!raw) return [];
  const parts = raw.split("/").filter(Boolean);
  if (kind === "file" && parts.length > 0) {
    parts.pop();
  }
  return parts;
}

function isProtectedNode(node) {
  if (!node) return false;
  if (node.kind === "folder" && isYearOneOrTwoFolderName(node.name)) {
    return true;
  }
  if (isProtectedByAncestry(node.ancestors)) {
    return true;
  }
  const folders = folderNamesFromPath(node.path, node.kind);
  for (let i = 0; i < folders.length; i++) {
    if (isYearOneOrTwoFolderName(folders[i])) return true;
  }
  return false;
}

module.exports = {
  normalizeName,
  classifyYearFolder,
  isYearOneOrTwoFolderName,
  isProtectedByAncestry,
  isProtectedNode,
};
