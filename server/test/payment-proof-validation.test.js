const test = require("node:test");
const assert = require("node:assert/strict");

const { validatePaymentProof } = require("../src/services/paymentProofService");

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
]);
const PDF = Buffer.from("%PDF-1.4");
const HTML = Buffer.from("<html><body>hi</body></html>");

test("accepts JPEG screenshots under the size limit", function () {
  const result = validatePaymentProof({
    buffer: JPEG,
    mimeType: "image/jpeg",
    originalName: "shot.jpg",
    size: JPEG.length,
  });
  assert.equal(result.ok, true);
  assert.equal(result.mimeType, "image/jpeg");
});

test("accepts PNG screenshots", function () {
  const result = validatePaymentProof({
    buffer: PNG,
    mimeType: "image/png",
    originalName: "shot.png",
    size: PNG.length,
  });
  assert.equal(result.ok, true);
});

test("accepts WEBP screenshots", function () {
  const result = validatePaymentProof({
    buffer: WEBP,
    mimeType: "image/webp",
    originalName: "shot.webp",
    size: WEBP.length,
  });
  assert.equal(result.ok, true);
});

test("rejects missing files", function () {
  const result = validatePaymentProof(null);
  assert.equal(result.ok, false);
});

test("rejects PDF uploads pretending to be images", function () {
  const result = validatePaymentProof({
    buffer: PDF,
    mimeType: "application/pdf",
    originalName: "shot.pdf",
    size: PDF.length,
  });
  assert.equal(result.ok, false);
});

test("rejects HTML content even with an image content-type", function () {
  const result = validatePaymentProof({
    buffer: HTML,
    mimeType: "image/jpeg",
    originalName: "shot.jpg",
    size: HTML.length,
  });
  assert.equal(result.ok, false);
});

test("rejects files over 5MB", function () {
  const result = validatePaymentProof({
    buffer: JPEG,
    mimeType: "image/jpeg",
    originalName: "shot.jpg",
    size: 5 * 1024 * 1024 + 1,
  });
  assert.equal(result.ok, false);
});

test("rejects SVG", function () {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const result = validatePaymentProof({
    buffer: svg,
    mimeType: "image/svg+xml",
    originalName: "shot.svg",
    size: svg.length,
  });
  assert.equal(result.ok, false);
});
