-- 1-kun testlari: mavzu nomlari 3 tilda, lotin matnlar, izoh, rasmsiz savollar,
-- variantlar tartibi, kalit so'zlar va "ko'rib chiqdim" progressi.
-- Faqat qo'shuvchi o'zgarishlar — eski backend kodi shu sxemada ishlay oladi.

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN "titleCyrl" TEXT,
ADD COLUMN "titleRu" TEXT,
ADD COLUMN "day" INTEGER,
ADD COLUMN "dayOrder" INTEGER;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "textLatn" TEXT,
ADD COLUMN "explanation" TEXT,
ADD COLUMN "explanationLatn" TEXT,
ADD COLUMN "explanationRu" TEXT,
ALTER COLUMN "imageUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Option" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "textLatn" TEXT;

-- Mavjud variantlar tartibi: shu paytgacha API ularni createdAt bo'yicha
-- qaytarardi — o'sha tartibni (teng bo'lsa id bo'yicha) 1, 2, 3... qilib yozamiz.
UPDATE "Option" AS o
SET "order" = ranked.rn
FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "questionId" ORDER BY "createdAt", "id") AS rn
    FROM "Option"
) AS ranked
WHERE o."id" = ranked."id";

-- CreateIndex
CREATE UNIQUE INDEX "Option_questionId_order_key" ON "Option"("questionId", "order");

-- CreateTable
CREATE TABLE "QuestionKeyword" (
    "questionId" TEXT NOT NULL,
    "questionText" TEXT,
    "questionTextCyrl" TEXT,
    "questionTextRu" TEXT,
    "answerText" TEXT,
    "answerTextCyrl" TEXT,
    "answerTextRu" TEXT,
    "highlights" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL,
    "docxKeyword" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionKeyword_pkey" PRIMARY KEY ("questionId")
);

-- CreateTable
CREATE TABLE "KeywordReview" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordReview_pkey" PRIMARY KEY ("userId","questionId")
);

-- CreateIndex
CREATE INDEX "KeywordReview_questionId_idx" ON "KeywordReview"("questionId");

-- AddForeignKey
ALTER TABLE "QuestionKeyword" ADD CONSTRAINT "QuestionKeyword_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordReview" ADD CONSTRAINT "KeywordReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordReview" ADD CONSTRAINT "KeywordReview_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
