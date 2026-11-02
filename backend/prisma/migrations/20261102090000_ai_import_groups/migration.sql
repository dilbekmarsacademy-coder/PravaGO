-- AI bilan fayllardan import, "Yangi testlar" to'plamlari, AI xarajatlari va tasdiqlangan izohlar.
-- Faqat qo'shimcha jadval/ustunlar; mavjud ma'lumotlar o'zgarmaydi (pastdagi ma'lumot ko'chirishdan tashqari).

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "explanationApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imageSmallUrl" TEXT;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "linkedDay" INTEGER,
ADD COLUMN     "linkedTopicSlug" VARCHAR(64);

-- CreateTable
CREATE TABLE "TestGroup" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TestGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "feature" VARCHAR(40) NOT NULL,
    "model" VARCHAR(60) NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" VARCHAR(500),
    "batchId" TEXT,
    "adminId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiStudentInsight" (
    "userId" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "content" JSONB NOT NULL,
    "basedOnAttemptAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiStudentInsight_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "groupId" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'uploading',
    "stage" VARCHAR(20) NOT NULL DEFAULT 'extract',
    "removeWatermarks" BOOLEAN NOT NULL DEFAULT true,
    "hintDay" INTEGER,
    "hintTopicSlug" VARCHAR(64),
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "error" VARCHAR(1000),
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportFile" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" VARCHAR(300) NOT NULL,
    "mime" VARCHAR(120),
    "size" INTEGER NOT NULL DEFAULT 0,
    "sha256" VARCHAR(64),
    "storageKey" VARCHAR(400),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "kind" VARCHAR(30),
    "skipReason" VARCHAR(500),
    "extracted" JSONB,
    "classification" JSONB,
    "error" VARCHAR(1000),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ImportFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportTest" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "groupId" TEXT,
    "title" VARCHAR(300) NOT NULL,
    "day" INTEGER,
    "topicNumber" INTEGER,
    "topicTitle" VARCHAR(300),
    "linkedTopicSlug" VARCHAR(64),
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "sourceFileIds" JSONB NOT NULL DEFAULT '[]',
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedTopicId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ImportTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportQuestion" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "testId" TEXT,
    "sourceFileId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "number" INTEGER,
    "day" INTEGER,
    "topicNumber" INTEGER,
    "data" JSONB NOT NULL,
    "matchStatus" VARCHAR(20) NOT NULL DEFAULT 'unmatched',
    "conflict" JSONB,
    "duplicateOfId" TEXT,
    "existingQuestionId" TEXT,
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "imageId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ImportQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportImage" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "sourceFileId" TEXT,
    "originalKey" VARCHAR(400) NOT NULL,
    "masterKey" VARCHAR(400),
    "cleanedKey" VARCHAR(400),
    "cropKey" VARCHAR(400),
    "selected" VARCHAR(20) NOT NULL DEFAULT 'cleaned',
    "boxes" JSONB NOT NULL DEFAULT '[]',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER,
    "height" INTEGER,
    "error" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ImportImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_feature_createdAt_idx" ON "AiUsage"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_batchId_idx" ON "AiUsage"("batchId");

-- CreateIndex
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ImportFile_batchId_idx" ON "ImportFile"("batchId");

-- CreateIndex
CREATE INDEX "ImportTest_batchId_idx" ON "ImportTest"("batchId");

-- CreateIndex
CREATE INDEX "ImportQuestion_batchId_idx" ON "ImportQuestion"("batchId");

-- CreateIndex
CREATE INDEX "ImportQuestion_testId_idx" ON "ImportQuestion"("testId");

-- CreateIndex
CREATE INDEX "ImportImage_batchId_status_idx" ON "ImportImage"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ImportImage_batchId_sha256_key" ON "ImportImage"("batchId", "sha256");

-- CreateIndex
CREATE INDEX "Topic_groupId_idx" ON "Topic"("groupId");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TestGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TestGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportFile" ADD CONSTRAINT "ImportFile_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportTest" ADD CONSTRAINT "ImportTest_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportQuestion" ADD CONSTRAINT "ImportQuestion_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportQuestion" ADD CONSTRAINT "ImportQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "ImportTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportImage" ADD CONSTRAINT "ImportImage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Mavjud "Yangi testlar" testlari — "Umumiy" standart to'plamiga (hech biri yo'qolmaydi).
INSERT INTO "TestGroup" ("id", "name", "sortOrder", "createdAt", "updatedAt")
SELECT 'b5c3c1de-0000-4000-8000-000000000001', 'Umumiy', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Topic" WHERE "kind" = 'collection' AND "deletedAt" IS NULL);
UPDATE "Topic" SET "groupId" = 'b5c3c1de-0000-4000-8000-000000000001'
WHERE "kind" = 'collection' AND "groupId" IS NULL
  AND EXISTS (SELECT 1 FROM "TestGroup" WHERE "id" = 'b5c3c1de-0000-4000-8000-000000000001');

-- Mavjud izohlar (kun testlaridagi DOCX va admin yozganlari) — tasdiqlangan: o'quvchilar ko'rib turgan izohlar yo'qolmaydi.
UPDATE "Question" SET "explanationApproved" = true WHERE "explanation" IS NOT NULL OR "explanationLatn" IS NOT NULL OR "explanationRu" IS NOT NULL;
