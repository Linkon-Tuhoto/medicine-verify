# Demo Q&A

**Does a match prove the medicine is genuine?**

No. It means the readable pack details match a registry record. It does not test the medicine inside.

**What happens if the photo is blurry?**

The extractor should return null fields and confidence 0 on API/processing failure; comparison returns `unreadable` if required fields are absent or confidence is below 0.5.

**Why compare deterministically after using AI?**

AI is used to read the photo. The registered-record comparison follows fixed normalization rules so results are repeatable.

**Can the OCR miss text?**

Yes. Lighting, glare, blur, camera angle, small print and model limitations can cause errors. That is why the prototype has a test-image evaluation script and an unreadable result.

**Does the module replace a pharmacist or regulator?**

No. It is a supporting registry check, not a clinical or laboratory test.
