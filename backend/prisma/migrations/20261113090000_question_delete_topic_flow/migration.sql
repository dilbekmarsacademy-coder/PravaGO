-- Savolni o'chirish (yumshoq) + kunlik mavzu oqimi (video → kalit so'zlar → test)
-- + haftalik yangilanishda video va kalit so'zlar progressi.
-- Faqat yangi ustun/jadval qo'shiladi: mavjud qiymatlar o'zgarmaydi.

-- Kim o'chirgani (Question.deletedAt allaqachon bor).
ALTER TABLE "Question" ADD COLUMN "deletedById" VARCHAR(64);

-- Mavjud foydalanuvchilar: false (eski xatti-harakat navbatdagi haftalik
-- yangilanishgacha saqlanadi). Keyin yaratiladiganlar: true.
ALTER TABLE "User" ADD COLUMN "topicFlowGatingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "topicFlowGatingEnabled" SET DEFAULT true;
ALTER TABLE "User" ADD COLUMN "progressResetAt" TIMESTAMPTZ(3);

-- Birinchi marta ko'rilgan vaqt — hozir ko'rilganlar uchun completedAt'dan.
ALTER TABLE "LessonProgress" ADD COLUMN "firstCompletedAt" TIMESTAMPTZ(3);
UPDATE "LessonProgress" SET "firstCompletedAt" = "completedAt" WHERE "completedAt" IS NOT NULL;

-- Bitta foydalanuvchi uchun yangilanish ("tester-reset", admin nollashi).
ALTER TABLE "WeeklyReset" ADD COLUMN "userId" TEXT;
CREATE INDEX "WeeklyReset_userId_idx" ON "WeeklyReset"("userId");

-- "Tanishib chiqdim" (mavzu bo'yicha).
CREATE TABLE "TopicKeywordsView" (
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "viewedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicKeywordsView_pkey" PRIMARY KEY ("userId","topicId")
);
CREATE INDEX "TopicKeywordsView_topicId_idx" ON "TopicKeywordsView"("topicId");
ALTER TABLE "TopicKeywordsView" ADD CONSTRAINT "TopicKeywordsView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopicKeywordsView" ADD CONSTRAINT "TopicKeywordsView_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
