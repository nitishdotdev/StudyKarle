import React, { useEffect } from "react";

const SITE_URL = "https://www.studykarle.me";
const SOCIAL_IMAGE = SITE_URL + "/social-preview.png";

export const PUBLIC_SEO = {
  "/": {
    title: "StudyKarle | Engineering Notes, PYQs and Study Materials",
    description:
      "StudyKarle organizes engineering notes, previous-year papers, assignments, lab files and semester-wise study materials. Year 1 and Year 2 access currently costs ₹9 after account creation and approval.",
    type: "WebSite",
  },
  "/courses": {
    title: "Engineering Courses, Notes & PYQ Solutions | StudyKarle",
    description:
      "Browse engineering subjects on StudyKarle with organized lecture notes, previous-year question papers (PYQs), and solutions. Unlock full semester access for ₹9.",
  },
  "/features": {
    title: "StudyKarle Features | Organized Academic Resources",
    description:
      "Explore StudyKarle features for finding semester-wise notes, previous-year papers, assignments and engineering study resources through an account-based access process.",
  },
  "/how-it-works": {
    title: "How StudyKarle Works | Find Study Materials Faster",
    description:
      "Learn how StudyKarle organizes academic resources so students can create an account, request ₹9 Year 1 or Year 2 access, and study with less searching.",
  },
  "/about": {
    title: "About StudyKarle | Student-Focused Academic Resources",
    description:
      "StudyKarle is a student-focused platform for discovering organized notes, papers, assignments and other engineering study materials through approved semester access.",
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

export default function Seo({
  path,
  noindex = false,
  title,
  description,
  extraGraph = null,
}) {
  const baseConfig = PUBLIC_SEO[path] || {
    title: "StudyKarle | Academic Resources",
    description:
      "Organized academic notes, previous-year papers and study materials for engineering students. Current Year 1 and Year 2 access is ₹9 after approval.",
  };
  const resolvedTitle = title || baseConfig.title;
  const resolvedDescription = description || baseConfig.description;
  const canonical = SITE_URL + (path === "/" ? "/" : path);
  const extraGraphKey = extraGraph ? JSON.stringify(extraGraph) : "";

  useEffect(
    function () {
      document.title = resolvedTitle;
      setMeta("name", "description", resolvedDescription);
      setMeta(
        "name",
        "robots",
        noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"
      );
      setLink("canonical", canonical);

      setMeta("property", "og:type", "website");
      setMeta("property", "og:title", resolvedTitle);
      setMeta("property", "og:description", resolvedDescription);
      setMeta("property", "og:url", canonical);
      setMeta("property", "og:image", SOCIAL_IMAGE);
      setMeta("property", "og:image:secure_url", SOCIAL_IMAGE);
      setMeta("property", "og:image:type", "image/png");
      setMeta("property", "og:image:width", "1200");
      setMeta("property", "og:image:height", "630");
      setMeta("property", "og:site_name", "StudyKarle");
      setMeta("property", "og:locale", "en_IN");

      setMeta("name", "twitter:card", "summary_large_image");
      setMeta("name", "twitter:title", resolvedTitle);
      setMeta("name", "twitter:description", resolvedDescription);
      setMeta("name", "twitter:image", SOCIAL_IMAGE);
      setMeta("name", "twitter:image:alt", "StudyKarle academic resources");

      const graph = [
        {
          "@type": "Organization",
          "@id": SITE_URL + "/#organization",
          name: "StudyKarle",
          url: SITE_URL + "/",
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
          name: resolvedTitle,
          description: resolvedDescription,
          isPartOf: { "@id": SITE_URL + "/#website" },
        },
      ];
      if (Array.isArray(extraGraph) && extraGraph.length > 0) {
        extraGraph.forEach(function (node) {
          graph.push(node);
        });
      }

      const schemaContent = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": graph,
      });
      let schema = document.getElementById("studykarle-schema");
      if (!schema) {
        schema = document.head.querySelector(
          'script[type="application/ld+json"]'
        );
      }
      if (!schema) {
        schema = document.createElement("script");
        document.head.appendChild(schema);
      }
      schema.id = "studykarle-schema";
      schema.type = "application/ld+json";
      schema.textContent = schemaContent;
      document.head
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach(function (node) {
          if (node !== schema) node.remove();
        });
    },
    [canonical, resolvedTitle, resolvedDescription, noindex, extraGraphKey]
  );

  return null;
}

export { SITE_URL, SOCIAL_IMAGE };
