import { readFile } from "node:fs/promises";

const root = new URL("../dist/", import.meta.url);
const landingSource = await readFile(
  new URL("../src/pages/LandingPage.jsx", import.meta.url),
  "utf8"
);
const pages = [
  { path: "/", file: "index.html" },
  { path: "/courses", file: "courses/index.html" },
  { path: "/features", file: "features/index.html" },
  { path: "/how-it-works", file: "how-it-works/index.html" },
  { path: "/about", file: "about/index.html" },
  { path: "/contact", file: "contact/index.html" },
  { path: "/privacy", file: "privacy/index.html" },
  { path: "/terms", file: "terms/index.html" },
];
const site = "https://www.studykarle.me";
const titles = new Set();
const descriptions = new Set();

function matchOne(html, pattern, label, file) {
  const matches = html.match(pattern) || [];
  if (matches.length !== 1) {
    throw new Error(`${file}: expected one ${label}, found ${matches.length}`);
  }
  return matches[0];
}

for (const page of pages) {
  const html = await readFile(new URL(page.file, root), "utf8");
  const title = matchOne(html, /<title>[\s\S]*?<\/title>/gi, "title", page.file);
  const description = matchOne(
    html,
    /<meta name="description" content="[^"]*"\s*\/?>/gi,
    "description",
    page.file
  );
  const canonical = matchOne(
    html,
    /<link rel="canonical" href="[^"]+"\s*\/?>/gi,
    "canonical",
    page.file
  );
  const h1 = matchOne(html, /<h1\b/gi, "H1", page.file);
  const schema = matchOne(
    html,
    /<script id="studykarle-schema" type="application\/ld\+json">[\s\S]*?<\/script>/gi,
    "JSON-LD graph",
    page.file
  );
  const titleValue = title.match(/<title>([\s\S]*?)<\/title>/i)[1];
  const descriptionValue = description.match(/content="([^"]*)"/i)[1];
  const canonicalValue = canonical.match(/href="([^"]*)"/i)[1];
  const schemaValue = schema.match(
    /<script id="studykarle-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/i
  )[1];
  const graph = JSON.parse(schemaValue)["@graph"];

  if (!titleValue || titles.has(titleValue)) {
    throw new Error(`${page.file}: title is missing or duplicated`);
  }
  if (!descriptionValue || descriptions.has(descriptionValue)) {
    throw new Error(`${page.file}: description is missing or duplicated`);
  }
  if (canonicalValue !== site + (page.path === "/" ? "/" : page.path)) {
    throw new Error(`${page.file}: canonical URL is incorrect`);
  }
  if (
    !Array.isArray(graph) ||
    graph.map((entity) => entity["@type"]).join(",") !==
      "Organization,WebSite,WebPage"
  ) {
    throw new Error(`${page.file}: JSON-LD entity graph is invalid`);
  }

  titles.add(titleValue);
  descriptions.add(descriptionValue);
}

for (const value of ["800+", "50+", "4+", "100+"]) {
  if (!landingSource.includes(`value: "${value}"`)) {
    throw new Error(`LandingPage.jsx: approved statistic ${value} is missing`);
  }
}
for (const value of ["Aarav Sharma", "Priya Verma", "Rohan Gupta"]) {
  if (!landingSource.includes(`name: "${value}"`)) {
    throw new Error(`LandingPage.jsx: restored testimonial ${value} is missing`);
  }
}
for (const value of [
  "StudyKarle brings all my study resources together in one place",
  "It feels great to have a platform where students can access quality notes",
  "StudyKarle makes learning more accessible by helping students quickly find",
]) {
  if (!landingSource.includes(value)) {
    throw new Error("LandingPage.jsx: historical testimonial text is missing");
  }
}
if (
  !landingSource.includes('eyebrow="Student Feedback"') ||
  !landingSource.includes('? "star" : "star_border"')
) {
  throw new Error("LandingPage.jsx: historical feedback presentation is missing");
}
for (const value of ["10K+", "8+", "1K+"]) {
  if (landingSource.includes(`value: "${value}"`)) {
    throw new Error(`LandingPage.jsx: unsupported statistic ${value} is present`);
  }
}

console.log(`Validated ${pages.length} public SEO pages`);
