const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signToken(userId, tokenVersion) {
  const payload = { sub: userId };
  if (tokenVersion != null) {
    payload.tv = tokenVersion;
  }
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function cookieMaxAgeMs() {
  return 7 * 24 * 60 * 60 * 1000;
}

function buildAuthCookie(value, maxAgeSeconds) {
  const parts = [`${env.cookieName}=${value}`, "Path=/", "HttpOnly"];
  if (maxAgeSeconds != null) {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }
  if (env.isProduction) {
    parts.push("SameSite=None", "Secure", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
  }
  return parts.join("; ");
}

function setAuthCookie(res, token) {
  res.append(
    "Set-Cookie",
    buildAuthCookie(token, Math.floor(cookieMaxAgeMs() / 1000))
  );
}

function clearAuthCookie(res) {
  res.append(
    "Set-Cookie",
    `${buildAuthCookie("", 0)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
}

module.exports = {
  signToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
};
