import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../dist/", import.meta.url);
const base = await readFile(new URL("index.html", root), "utf8");
const site = "https://www.studykarle.me";
const image = `${site}/social-preview.png`;

const pages = {
  "/": {
    title: "StudyKarle | Engineering Notes, PYQs and Study Materials",
    description:
      "StudyKarle helps engineering students find organized notes, previous-year papers, assignments, lab files and semester-wise study materials.",
    heading: "Engineering notes and study materials, organized for students.",
    intro:
      "StudyKarle brings notes, previous-year papers, assignments, lab files and semester-wise resources into one structured academic platform.",
  },
  "/features": {
    title: "StudyKarle Features | Organized Academic Resources",
    description:
      "Explore StudyKarle features for finding semester-wise notes, previous-year papers, assignments and engineering study resources.",
    heading: "Everything students need in one disciplined layout.",
    intro:
      "StudyKarle makes academic resources easier to discover with semester-wise organization, searchable materials and focused study workflows.",
  },
  "/how-it-works": {
    title: "How StudyKarle Works | Find Study Materials Faster",
    description:
      "Learn how StudyKarle organizes academic resources so students can create an account, browse materials and study with less searching.",
    heading: "A simple flow that keeps the focus on studying.",
    intro:
      "Create an account, browse organized academic resources, and open the notes or papers you need for preparation.",
  },
  "/about": {
    title: "About StudyKarle | Student-Focused Academic Resources",
    description:
      "StudyKarle is a student-focused platform for discovering organized notes, papers, assignments and other engineering study materials.",
    heading: "Built to make learning accessible for every student.",
    intro:
      "StudyKarle is a student-focused academic resource platform designed to make useful study material easier to find and use.",
  },
  "/contact": {
    title: "Contact StudyKarle | Academic Resource Support",
    description:
      "Contact StudyKarle with questions, feedback or issues about the academic resource platform and its study materials.",
    heading: "Questions, feedback, or an issue to report?",
    intro:
      "Contact StudyKarle for support, feedback, or questions about the academic resource platform.",
  },
  "/privacy": {
    title: "StudyKarle Privacy Policy",
    description:
      "Read the StudyKarle privacy policy covering account information, secure sessions, data use and user rights.",
    heading: "Privacy Policy",
    intro:
      "This policy explains what information StudyKarle collects, how it is used, and the choices available to users.",
  },
  "/terms": {
    title: "StudyKarle Terms of Service",
    description:
      "Read the StudyKarle terms covering academic resource use, accounts, content accuracy and prohibited conduct.",
    heading: "Terms of Service",
    intro:
      "These terms explain acceptable use of StudyKarle, account responsibilities, and the limits of academic resource content.",
  },
};

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderPage(path, page) {
  const canonical = `${site}${path === "/" ? "/" : path}`;
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site}/#organization`,
        name: "StudyKarle",
        url: `${site}/`,
        logo: image,
      },
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        url: `${site}/`,
        name: "StudyKarle",
        publisher: { "@id": `${site}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: page.title,
        description: page.description,
        isPartOf: { "@id": `${site}/#website` },
      },
    ],
  });
  const head = `
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:secure_url" content="${image}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="StudyKarle" />
    <meta property="og:locale" content="en_IN" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:image:alt" content="StudyKarle academic resources" />
    <script type="application/ld+json">${schema}</script>`;
  const body = `
    <div id="root">
      <main>
        <nav aria-label="Primary">
          <a href="/">StudyKarle</a>
          <a href="/features">Features</a>
          <a href="/how-it-works">How It Works</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
        <h1>${escapeHtml(page.heading)}</h1>
        <p>${escapeHtml(page.intro)}</p>
        <p><a href="/login">Sign in to browse the StudyKarle library</a></p>
      </main>
    </div>`;
  return base
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta name="description"[\s\S]*?\/>/, "")
    .replace(/<meta name="robots"[\s\S]*?\/>/g, "")
    .replace(/<meta name="twitter:[^"]+"[\s\S]*?\/>/g, "")
    .replace(/<meta property="og:[^"]+"[\s\S]*?\/>/g, "")
    .replace(/<link rel="canonical"[\s\S]*?\/>/g, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "")
    .replace(/<body>[\s\S]*?<\/body>/, `<body>${body}</body>`)
    .replace("</head>", `${head}\n  </head>`);
}

for (const [path, page] of Object.entries(pages)) {
  const directory = path === "/" ? new URL("", root) : new URL(`.${path}/`, root);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL("index.html", directory), renderPage(path, page));
}
