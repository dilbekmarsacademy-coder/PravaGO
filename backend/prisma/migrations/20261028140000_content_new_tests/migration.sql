-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3),
ADD COLUMN     "imageAssetId" TEXT;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3),
ADD COLUMN     "kind" VARCHAR(20) NOT NULL DEFAULT 'course',
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "mime" VARCHAR(50) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "data" BYTEA NOT NULL,
    "sourceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageJob" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "inputAssetId" TEXT NOT NULL,
    "outputAssetId" TEXT,
    "params" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB NOT NULL DEFAULT '{}',
    "error" VARCHAR(1000),
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ImageJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAsset_sha256_idx" ON "MediaAsset"("sha256");

-- CreateIndex
CREATE INDEX "ImageJob_createdAt_idx" ON "ImageJob"("createdAt");

