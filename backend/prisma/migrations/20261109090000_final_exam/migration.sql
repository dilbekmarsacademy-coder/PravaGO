-- CreateEnum
CREATE TYPE "FinalExamType" AS ENUM ('Q20', 'Q50');

-- CreateEnum
CREATE TYPE "FinalExamStatus" AS ENUM ('IN_PROGRESS', 'FINISHED', 'EXPIRED');

-- CreateTable
CREATE TABLE "FinalExamAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FinalExamType" NOT NULL,
    "status" "FinalExamStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3),
    "totalQuestions" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "scorePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "questions" JSONB NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "FinalExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "serial" SERIAL NOT NULL,
    "certificateNumber" VARCHAR(20) NOT NULL,
    "userId" TEXT NOT NULL,
    "examType" "FinalExamType" NOT NULL,
    "averagePercent" DOUBLE PRECISION NOT NULL,
    "attemptsCount" INTEGER NOT NULL,
    "fullName" VARCHAR(120) NOT NULL DEFAULT '',
    "letterText" TEXT NOT NULL,
    "letterTone" VARCHAR(20) NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "celebratedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinalExamAttempt_userId_type_idx" ON "FinalExamAttempt"("userId", "type");

-- CreateIndex
CREATE INDEX "FinalExamAttempt_startedAt_idx" ON "FinalExamAttempt"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_serial_key" ON "Certificate"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_userId_examType_key" ON "Certificate"("userId", "examType");

-- AddForeignKey
ALTER TABLE "FinalExamAttempt" ADD CONSTRAINT "FinalExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Bir foydalanuvchida bir turda bir vaqtda faqat bitta faol urinish.
CREATE UNIQUE INDEX "FinalExamAttempt_one_active_per_type" ON "FinalExamAttempt"("userId", "type") WHERE "status" = 'IN_PROGRESS';
