import React, { useEffect } from "react";

const SITE_URL = "https://www.studykarle.me";
const SOCIAL_IMAGE = SITE_URL + "/social-preview.png";

export const PUBLIC_SEO = {
  "/": {
    title: "StudyKarle | Engineering Notes, PYQs and Study Materials",
    description:
      "StudyKarle helps engineering students find organized notes, previous-year papers, assignments, lab files and semester-wise study materials.",
    type: "WebSite",
  },
  "/features": {
    title: "StudyKarle Features | Organized Academic Resources",
    description:
      "Explore StudyKarle features for finding semester-wise notes, previous-year papers, assignments and engineering study resources.",
  },
  "/how-it-works": {
    title: "How StudyKarle Works | Find Study Materials Faster",
    description:
      "Learn how StudyKarle organizes academic resources so students can create an account, browse materials and study with less searching.",
  },
  "/about": {
    title: "About StudyKarle | Student-Focused Academic Resources",
    description:
      "StudyKarle is a student-focused platform for discovering organized notes, papers, assignments and other engineering study materials.",
  },
  "/contact": {
    title: "Contact StudyKarle | Academic Resource Support",
    description:
      "Contact StudyKarle with questions, feedback or issues about the academic resource platform and its study materials.",
  },
  "/privacy": {
    title: "StudyKarle Privacy Policy",
    description:
      "Read the StudyKarle privacy policy covering account information, secure sessions, data use and user rights.",
  },
  "/terms": {
    title: "StudyKarle Terms of Service",
    description:
      "Read the StudyKarle terms covering academic resource use, accounts, content accuracy and prohibited conduct.",
  },
};

function setMeta(attribute, key, content) {
  let node = document.head.querySelector(
    `meta[${attribute}="${CSS.escape(key)}"]`
  );
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attribute, key);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function setLink(rel, href) {
  let node = document.head.querySelector(`link[rel="${rel}"]`);
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", rel);
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

export default function Seo({ path, noindex = false }) {
  const config = PUBLIC_SEO[path] || {
    title: "StudyKarle | Academic Resources",
    description:
      "Organized academic notes, previous-year papers and study materials for engineering students.",
  };
  const canonical = SITE_URL + (path === "/" ? "/" : path);

  useEffect(
    function () {
      document.title = config.title;
      setMeta("name", "description", config.description);
      setMeta(
        "name",
        "robots",
        noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"
      );
      setLink("canonical", canonical);

      setMeta("property", "og:type", config.type === "WebSite" ? "website" : "website");
      setMeta("property", "og:title", config.title);
      setMeta("property", "og:description", config.description);
      setMeta("property", "og:url", canonical);
      setMeta("property", "og:image", SOCIAL_IMAGE);
      setMeta("property", "og:image:secure_url", SOCIAL_IMAGE);
      setMeta("property", "og:image:type", "image/png");
      setMeta("property", "og:image:width", "1200");
      setMeta("property", "og:image:height", "630");
      setMeta("property", "og:site_name", "StudyKarle");
      setMeta("property", "og:locale", "en_IN");

      setMeta("name", "twitter:card", "summary_large_image");
      setMeta("name", "twitter:title", config.title);
      setMeta("name", "twitter:description", config.description);
      setMeta("name", "twitter:image", SOCIAL_IMAGE);
      setMeta("name", "twitter:image:alt", "StudyKarle academic resources");

      const existing = document.getElementById("studykarle-schema");
      if (existing) existing.remove();
      const schema = document.createElement("script");
      schema.id = "studykarle-schema";
      schema.type = "application/ld+json";
      schema.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": SITE_URL + "/#organization",
            name: "StudyKarle",
            url: SITE_URL + "/",
            logo: SOCIAL_IMAGE,
            sameAs: [
              "https://www.instagram.com/nitishdotdev",
              "https://www.linkedin.com/in/nitishdotdev",
              "https://github.com/nitishdotdev",
            ],
          },
          {
            "@type": "WebSite",
            "@id": SITE_URL + "/#website",
            url: SITE_URL + "/",
            name: "StudyKarle",
            description: PUBLIC_SEO["/"].description,
            publisher: { "@id": SITE_URL + "/#organization" },
          },
          {
            "@type": "WebPage",
            "@id": canonical + "#webpage",
            url: canonical,
            name: config.title,
            description: config.description,
            isPartOf: { "@id": SITE_URL + "/#website" },
          },
        ],
      });
      document.head.appendChild(schema);
    },
    [canonical, config, noindex]
  );

  return null;
}

export { SITE_URL, SOCIAL_IMAGE };
