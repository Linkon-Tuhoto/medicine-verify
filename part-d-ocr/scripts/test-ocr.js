"use strict";

try { require("dotenv").config(); } catch (_error) { /* .env loading is optional */ }
const fs = require("node:fs");
const path = require("node:path");
const { extractPackFields } = require("../index");

const root = path.join(__dirname, "..", "test-images");
const manifestPath = path.join(root, "expected.json");

function same(a, b) {
  return String(a ?? "").trim().toUpperCase() === String(b ?? "").trim().toUpperCase();
}

async function main() {
  if (!process.env.OCR_API_KEY) {
    console.error("OCR_API_KEY is missing. Add it to .env before running OCR evaluation.");
    process.exitCode = 2;
    return;
  }
  if (!fs.existsSync(manifestPath)) {
    console.error(`Missing manifest: ${manifestPath}`);
    process.exitCode = 2;
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const cases = Array.isArray(manifest) ? manifest : manifest.cases;
  if (!Array.isArray(cases) || cases.length === 0) {
    console.error("expected.json must contain a non-empty array or { cases: [...] }.");
    process.exitCode = 2;
    return;
  }

  let batchExpiryCorrect = 0;
  let unreadableCount = 0;
  let errors = 0;

  for (const item of cases) {
    const imagePath = path.resolve(root, item.image);
    if (!fs.existsSync(imagePath)) {
      console.error(`MISSING ${item.image}`);
      errors++;
      continue;
    }

    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const extracted = await extractPackFields(fs.readFileSync(imagePath), mimeType);
    const batchCorrect = same(extracted.batchNo, item.expected?.batchNo);
    const expiryCorrect = same(extracted.expiry, item.expected?.expiry);
    if (batchCorrect && expiryCorrect && extracted.confidence >= 0.5) batchExpiryCorrect++;
    if (!extracted.batchNo || !extracted.expiry || extracted.confidence < 0.5) unreadableCount++;

    console.log(`${item.image}: batch=${batchCorrect ? "OK" : "NO"}, expiry=${expiryCorrect ? "OK" : "NO"}, confidence=${extracted.confidence}`);
    // Be polite to the API and avoid an uncontrolled burst of requests.
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const total = cases.length;
  console.log(`\nBatch+expiry correct: ${batchExpiryCorrect}/${total}`);
  console.log(`Unreadable outputs: ${unreadableCount}/${total}`);
  console.log(`Missing files: ${errors}`);

  if (errors > 0 || batchExpiryCorrect < Math.ceil(total * 0.85)) {
    console.error("OCR evaluation did not meet the target. Review the images, expected.json and extraction prompt.");
    process.exitCode = 1;
  } else {
    console.log("OCR evaluation target met for this dataset. This is not a safety or authenticity certification.");
  }
}

main().catch(error => {
  console.error("Evaluation failed:", error.message);
  process.exitCode = 1;
});
