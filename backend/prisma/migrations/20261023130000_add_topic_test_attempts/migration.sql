-- Mavzu testi natijalari (kabinetdagi 98% qoidasi uchun). Faqat yangi jadval.

-- CreateTable
CREATE TABLE "TopicTestAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "percent" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicTestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicTestAttempt_userId_topicId_idx" ON "TopicTestAttempt"("userId", "topicId");

-- AddForeignKey
ALTER TABLE "TopicTestAttempt" ADD CONSTRAINT "TopicTestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicTestAttempt" ADD CONSTRAINT "TopicTestAttempt_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
