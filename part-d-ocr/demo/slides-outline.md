# Slide deck outline

1. **Problem** — Pack labels can be hard to check manually; registry comparison can help flag discrepancies.
2. **Our approach** — Photo → Gemini Vision extraction → deterministic comparison → match/mismatch/unreadable.
3. **Architecture** — `extractPackFields(imageBuffer, mimeType)` and `comparePack(extracted, record)`.
4. **Normalization** — Batch rules, expiry year/month comparison, manufacturer normalization.
5. **Evaluation** — Show only measured results from `demo/evidence.md`; include sample count and limitations.
6. **Live demo** — Matching pack, doctored expiry, blurry photo.
7. **Limitations and next steps** — OCR errors, image quality, registry quality, human review.
8. **Disclaimer** — A registry match does not test the medicine inside.
