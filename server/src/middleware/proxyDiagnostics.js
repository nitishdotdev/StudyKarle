const crypto = require("crypto");
const logger = require("../utils/logger");

// Opt-in diagnostic to verify the real proxy chain on Render before touching
// TRUST_PROXY_HOPS. Enable with PROXY_DIAGNOSTICS=true, read ~20 log lines,
// then disable. It logs only the SHAPE of the chain and a short one-way hash
// of req.ip -- never raw IPs, cookies, headers' values, bodies or emails.
//
// How to read it:
//  - xffEntries: how many addresses arrived in X-Forwarded-For.
//  - ipHash: if different real users show the SAME ipHash, req.ip is a shared
//    proxy address and TRUST_PROXY_HOPS is too low.
//  - ipsLen vs xffEntries: with hops=N, ipsLen should be N.
const MAX_LINES = 50;
let logged = 0;

module.exports = function proxyDiagnostics(req, res, next) {
  if (process.env.PROXY_DIAGNOSTICS === "true" && logged < MAX_LINES) {
    logged += 1;
    const xff = req.headers["x-forwarded-for"];
    const entries = xff ? String(xff).split(",").length : 0;
    const ipHash = crypto
      .createHash("sha256")
      .update(String(req.ip))
      .digest("hex")
      .slice(0, 8);
    logger.info(
      "[proxy-diag] " +
        req.method +
        " " +
        req.path +
        " xffEntries=" +
        entries +
        " ipsLen=" +
        (req.ips ? req.ips.length : 0) +
        " ipHash=" +
        ipHash +
        " hasVercelHeader=" +
        !!req.headers["x-vercel-id"] +
        " hasCfRay=" +
        !!req.headers["cf-ray"]
    );
  }
  next();
};
