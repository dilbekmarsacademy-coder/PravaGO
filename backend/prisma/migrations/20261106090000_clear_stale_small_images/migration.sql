-- Admin rasmni almashtirgan yoki olib tashlagan savollarda telefon uchun kichik
-- nusxa (import paytidagi eski rasm) qolib ketgan edi — o'quvchi eski rasmni ko'rardi.
-- Import variantlari sourceId'siz yaratiladi; admin yuklagan rasm sourceId bilan.
UPDATE "Question" q
SET "imageSmallUrl" = NULL
WHERE q."imageSmallUrl" IS NOT NULL
  AND (
    q."imageUrl" IS NULL
    OR q."imageAssetId" IS NULL
    OR EXISTS (SELECT 1 FROM "MediaAsset" m WHERE m."id" = q."imageAssetId" AND m."sourceId" IS NOT NULL)
  );
