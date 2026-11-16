const express = require("express");

const router = express.Router();
const SITE_URL = "https://www.studykarle.me";

const PUBLIC_PATHS = [
  "/",
  "/features",
  "/how-it-works",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

router.get("/sitemap.xml", function (req, res) {
  const urls = PUBLIC_PATHS.map(function (path) {
    return (
      "  <url><loc>" +
      SITE_URL +
      (path === "/" ? "/" : path) +
      "</loc></url>"
    );
  }).join("\n");

  res
    .type("application/xml")
    .set("Cache-Control", "public, max-age=3600")
    .send(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls +
        "\n</urlset>\n"
    );
});

module.exports = router;
