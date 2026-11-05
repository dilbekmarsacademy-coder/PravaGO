-- CreateTable
CREATE TABLE "SessionTransferCode" (
    "codeHash" VARCHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTransferCode_pkey" PRIMARY KEY ("codeHash")
);

-- CreateIndex
CREATE INDEX "SessionTransferCode_expiresAt_idx" ON "SessionTransferCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "SessionTransferCode" ADD CONSTRAINT "SessionTransferCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
