# Part D — Medicine Pack OCR

**Folder:** `ocr/`
**Branch:** `contribute/part-d-ocr`
**Runtime:** Node.js 20 LTS, CommonJS

This module extracts visible pack fields using Gemini Vision, then compares them deterministically with the registered record. OCR output is not proof that medicine contents are safe or genuine.

## Requirements

- Node.js 20 LTS and npm
- Git
- A Gemini API key for live OCR tests (the comparison tests need no key or internet)

## Install

```bash
nvm install 20
nvm use 20
npm install
cp .env.example .env
```

Put your key in `.env` as `OCR_API_KEY=...`. Do not share the key or commit `.env`.

## Run tests

```bash
npm test
```

This runs deterministic comparison tests and does not need an API key.

For OCR evaluation, add your own permitted test photos to `test-images/`, then update `test-images/expected.json` with the expected fields and run:

```bash
npm run test:ocr
```

The OCR script needs `OCR_API_KEY` and makes live API requests, which may incur API usage. Do not claim accuracy results until the script has actually been run on real images.

## Required interface

```js
const { extractPackFields, comparePack } = require("./index");
```

- `extractPackFields(imageBuffer, mimeType)` resolves to `{ batchNo, expiry, manufacturer, confidence }`.
- `comparePack(extracted, record)` returns `{ match, differences }`, where match is `match`, `mismatch`, or `unreadable`.

## Rules implemented

- Unreadable/missing batch or expiry, or confidence below `0.5` -> `unreadable`.
- Batch numbers: uppercase, spaces/hyphens removed; `O` equals `0`, `I` equals `1`.
- Expiry comparison uses year and month only; accepted formats include `MM/YYYY`, `YYYY-MM`, `DD/MM/YYYY`, `MAR 2027`, `03-2027`, `YYYY-MM-DD`.
- Manufacturer comparison ignores case, punctuation and parenthetical text. A null extracted manufacturer is ignored.
- Extraction never throws; API, decoding or validation errors return null fields and confidence `0`.

## Demo kit and evidence

The `demo/` folder contains print-ready sample pack text layouts and scripts/docs. These are **fictional demonstration designs**, not real medicine packaging. Print and photograph them yourself from multiple angles/lighting conditions, then add at least 20 images and update `test-images/expected.json`. The provided starter dataset intentionally does not fabricate OCR test results.

## Git checklist

Work only inside `ocr/` and `demo/`. Before a PR:

```bash
git fetch origin
git diff --name-only origin/main...HEAD
```

Every changed path must start with `ocr/` or `demo/`. If `spec/` appears, stop and tell the merger. Never commit `.env`, API keys or private keys. Never force-push.
