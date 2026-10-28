-- 20261028140000_content_new_tests migratsiyasini orqaga qaytarish.
-- Diqqat: "Yangi testlar" to'plamlari (Topic.kind='collection') va ularning savollari ham o'chiriladi.
-- keyin: npx prisma migrate resolve --rolled-back 20261028140000_content_new_tests
DELETE FROM "Topic" WHERE "kind" = 'collection';
DROP TABLE IF EXISTS "ImageJob";
DROP TABLE IF EXISTS "MediaAsset";
ALTER TABLE "Question" DROP COLUMN IF EXISTS "deletedAt", DROP COLUMN IF EXISTS "imageAssetId";
ALTER TABLE "Topic"
  DROP COLUMN IF EXISTS "kind",
  DROP COLUMN IF EXISTS "published",
  DROP COLUMN IF EXISTS "sortOrder",
  DROP COLUMN IF EXISTS "deletedAt";
