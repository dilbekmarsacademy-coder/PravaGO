-- CreateEnum
CREATE TYPE "SavedSourceMode" AS ENUM ('practice', 'exam');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "sourceMode" "SavedSourceMode" NOT NULL DEFAULT 'practice',
    "attemptId" TEXT,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_idx" ON "ExamAttempt"("userId");

-- CreateIndex
CREATE INDEX "SavedQuestion_userId_createdAt_idx" ON "SavedQuestion"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SavedQuestion_userId_topicId_idx" ON "SavedQuestion"("userId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedQuestion_userId_questionId_key" ON "SavedQuestion"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedQuestion" ADD CONSTRAINT "SavedQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedQuestion" ADD CONSTRAINT "SavedQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedQuestion" ADD CONSTRAINT "SavedQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedQuestion" ADD CONSTRAINT "SavedQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (qo'shimcha himoya qatlami).
-- Backend (Prisma) jadval egasi roli bilan ulanadi — egaga RLS ta'sir qilmaydi
-- (FORCE yoqilmagan), foydalanuvchi izolyatsiyasi API'da `userId = sessiya`
-- sharti bilan ta'minlanadi. Boshqa har qanday rol (masalan, Supabase anon /
-- Neon Data API) uchun policy yo'q — ya'ni bu jadvallarga umuman kira olmaydi.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedQuestion" ENABLE ROW LEVEL SECURITY;
