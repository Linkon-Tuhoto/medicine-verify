"use strict";

try { require("dotenv").config(); } catch (_error) { /* dotenv is optional for comparison-only tests */ }

const MIN_CONFIDENCE = 0.5;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

function failureResult() {
  return { batchNo: null, expiry: null, manufacturer: null, confidence: 0 };
}

function cleanString(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

function normalizeExpiry(value) {
  const raw = cleanString(value);
  if (!raw) return null;

  const s = raw.toUpperCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
  let match;

  // YYYY-MM-DD or YYYY-MM
  match = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/);
  if (match) return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;

  // DD/MM/YYYY or MM/YYYY. Prefer day-first when there are three parts.
  match = s.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const month = first > 12 ? second : (second > 12 ? first : second);
    if (month >= 1 && month <= 12) return `${match[3]}-${String(month).padStart(2, "0")}`;
    return null;
  }

  // MM/YYYY or MM-YYYY
  match = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= 12) {
    return `${match[2]}-${String(Number(match[1])).padStart(2, "0")}`;
  }

  // MAR 2027 / MARCH 2027
  const months = {
    JAN: "01", JANUARY: "01", FEB: "02", FEBRUARY: "02",
    MAR: "03", MARCH: "03", APR: "04", APRIL: "04",
    MAY: "05", JUN: "06", JUNE: "06", JUL: "07", JULY: "07",
    AUG: "08", AUGUST: "08", SEP: "09", SEPT: "09", SEPTEMBER: "09",
    OCT: "10", OCTOBER: "10", NOV: "11", NOVEMBER: "11",
    DEC: "12", DECEMBER: "12"
  };
  match = s.match(/^([A-Z]+)[ -]+(\d{4})$/);
  if (match && months[match[1]]) return `${match[2]}-${months[match[1]]}`;

  // ISO timestamp-like date; accept its YYYY-MM prefix only if date is valid.
  return null;
}

function normalizeBatch(value) {
  const raw = cleanString(value);
  if (!raw) return null;
  return raw.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/I/g, "1");
}

function normalizeManufacturer(value) {
  const raw = cleanString(value);
  if (!raw) return null;
  return raw
    .replace(/\([^)]*\)/g, " ")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function parseJsonResponse(text) {
  if (typeof text !== "string") throw new Error("Gemini returned no text");
  const stripped = text.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(stripped);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object");
  }
  return parsed;
}

/**
 * Extract visible pack details from an image.
 * Never throws: all API/validation errors produce null fields and confidence 0.
 */
async function extractPackFields(imageBuffer, mimeType) {
  try {
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) return failureResult();
    if (typeof mimeType !== "string" || !mimeType.startsWith("image/")) return failureResult();
    if (!process.env.OCR_API_KEY) return failureResult();

    // Dynamic import allows this CommonJS package to use the ESM Google GenAI SDK.
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.OCR_API_KEY });
    const prompt = [
      "Read the visible text on this medicine package.",
      "Return ONLY a JSON object with exactly these fields:",
      '{"batchNo": string|null, "expiry": string|null, "manufacturer": string|null, "confidence": number}.',
      "Do not guess missing or blurry fields; use null.",
      "confidence must be a number from 0 to 1 representing confidence in reading the batch number and expiry.",
      "If an expiry date is visible, normalize it to YYYY-MM-DD when day is known, otherwise YYYY-MM.",
      "Do not infer whether the medicine is genuine, safe, counterfeit, or effective."
    ].join(" ");

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
        { text: prompt }
      ],
      config: { temperature: 0, responseMimeType: "application/json" }
    });

    const parsed = parseJsonResponse(response.text);
    const batchNo = cleanString(parsed.batchNo);
    const expiry = normalizeExpiry(parsed.expiry);
    const manufacturer = cleanString(parsed.manufacturer);
    const confidence = Number(parsed.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return failureResult();

    return {
      batchNo,
      expiry,
      manufacturer,
      confidence: Math.round(confidence * 100) / 100
    };
  }catch (error) {
  console.error("OCR extraction failed:", error.message);

  return {
    batchNo: null,
    expiry: null,
    manufacturer: null,
    confidence: 0,
  };
}
}

/**
 * Deterministic comparison against a registered record.
 * Return shape is intentionally stable for other project parts.
 */
function comparePack(extracted, record) {
  const fields = extracted && typeof extracted === "object" ? extracted : {};
  const registered = record && typeof record === "object" ? record : {};
  const confidence = Number(fields.confidence);

  if (
    !cleanString(fields.batchNo) ||
    !cleanString(fields.expiry) ||
    !Number.isFinite(confidence) ||
    confidence < MIN_CONFIDENCE
  ) {
    return { match: "unreadable", differences: [] };
  }

  const differences = [];
  const extractedBatch = normalizeBatch(fields.batchNo);
  const registeredBatch = normalizeBatch(registered.batchNo);

  if (!extractedBatch || !registeredBatch || extractedBatch !== registeredBatch) {
    differences.push(`Batch number on pack is ${cleanString(fields.batchNo) || "unreadable"}, registered batch number is ${cleanString(registered.batchNo) || "unavailable"}`);
  }

  const extractedExpiry = normalizeExpiry(fields.expiry);
  const registeredExpiry = normalizeExpiry(registered.expiry);
  if (!extractedExpiry || !registeredExpiry || extractedExpiry !== registeredExpiry) {
    differences.push(`Expiry on pack is ${extractedExpiry || cleanString(fields.expiry) || "unreadable"}, registered expiry is ${registeredExpiry || cleanString(registered.expiry) || "unavailable"}`);
  }

  const extractedManufacturer = normalizeManufacturer(fields.manufacturer);
  const registeredManufacturer = normalizeManufacturer(registered.manufacturer);
  if (extractedManufacturer && registeredManufacturer && extractedManufacturer !== registeredManufacturer) {
    differences.push(`Manufacturer on pack is ${cleanString(fields.manufacturer)}, registered manufacturer is ${cleanString(registered.manufacturer)}`);
  }

  return { match: differences.length ? "mismatch" : "match", differences };
}

module.exports = { extractPackFields, comparePack };
