"use strict";

const assert = require("node:assert/strict");
const { comparePack } = require("../index");

const registered = {
  batchNo: "ZC-2026-014",
  expiry: "2027-03-31",
  manufacturer: "Zenocare Labs (demo)"
};

function run(name, extracted, record = registered, expectedMatch, expectedDifferences) {
  const result = comparePack(extracted, record);
  assert.equal(result.match, expectedMatch, `${name}: match status`);
  if (expectedDifferences !== undefined) {
    assert.equal(result.differences.length, expectedDifferences, `${name}: difference count`);
  }
  console.log(`PASS ${name}`);
}

const base = { batchNo: "ZC-2026-014", expiry: "2027-03", manufacturer: "Zenocare Labs", confidence: 0.9 };

run("normal exact values", base, registered, "match", 0);
run("batch ignores spaces and hyphens", { ...base, batchNo: "ZC 2026 014" }, registered, "match", 0);
run("batch O equals zero", { ...base, batchNo: "ZC-2O26-014" }, registered, "match", 0);
run("batch I equals one", { ...base, batchNo: "ZC-2026-0I4" }, registered, "match", 0);
run("batch mismatch", { ...base, batchNo: "ZC-2026-015" }, registered, "mismatch", 1);
run("expiry compares year and month only", { ...base, expiry: "31/03/2027" }, registered, "match", 0);
run("month-year expiry format", { ...base, expiry: "03-2027" }, registered, "match", 0);
run("month name expiry format", { ...base, expiry: "MAR 2027" }, registered, "match", 0);
run("expiry mismatch", { ...base, expiry: "03/2026" }, registered, "mismatch", 1);
run("manufacturer ignores case punctuation and parentheses", { ...base, manufacturer: "ZEN-OCARE, LABS" }, registered, "match", 0);
run("manufacturer mismatch", { ...base, manufacturer: "Other Medicines Ltd" }, registered, "mismatch", 1);
run("missing manufacturer is ignored", { ...base, manufacturer: null }, registered, "match", 0);
run("low confidence is unreadable", { ...base, confidence: 0.49 }, registered, "unreadable", 0);
run("missing batch is unreadable", { ...base, batchNo: null }, registered, "unreadable", 0);
run("missing expiry is unreadable", { ...base, expiry: null }, registered, "unreadable", 0);
run("confidence exactly threshold accepted", { ...base, confidence: 0.5 }, registered, "match", 0);

console.log("All comparison tests passed.");
