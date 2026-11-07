-- Random testlar: faqat yangi jadvallar, mavjud jadvallar o'zgarmaydi.
-- CreateTable
CREATE TABLE "RandomTestAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3),
    "answered" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "percent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RandomTestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RandomTestAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "optionOrder" TEXT[],
    "selectedOptionId" TEXT,
    "correct" BOOLEAN,
    "answeredAt" TIMESTAMPTZ(3),

    CONSTRAINT "RandomTestAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RandomTestAttempt_userId_startedAt_idx" ON "RandomTestAttempt"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "RandomTestAttempt_startedAt_idx" ON "RandomTestAttempt"("startedAt");

-- CreateIndex
CREATE INDEX "RandomTestAnswer_questionId_idx" ON "RandomTestAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "RandomTestAnswer_attemptId_position_key" ON "RandomTestAnswer"("attemptId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RandomTestAnswer_attemptId_questionId_key" ON "RandomTestAnswer"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "RandomTestAttempt" ADD CONSTRAINT "RandomTestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RandomTestAnswer" ADD CONSTRAINT "RandomTestAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "RandomTestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RandomTestAnswer" ADD CONSTRAINT "RandomTestAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Bir foydalanuvchida bir vaqtda faqat bitta tugallanmagan random test.
CREATE UNIQUE INDEX "RandomTestAttempt_one_active_per_user" ON "RandomTestAttempt"("userId") WHERE "status" = 'in_progress';
