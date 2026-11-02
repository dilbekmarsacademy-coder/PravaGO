-- Storage "db" drayveri (R2 sozlanmaguncha).
-- CreateTable
CREATE TABLE "StorageObject" (
    "key" VARCHAR(400) NOT NULL,
    "contentType" VARCHAR(120) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageObject_pkey" PRIMARY KEY ("key")
);

