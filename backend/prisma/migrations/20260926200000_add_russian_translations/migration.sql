-- Ruscha tarjimalar uchun ustunlar (hammasi ixtiyoriy — mavjud ma'lumotlarga ta'sir qilmaydi)
ALTER TABLE "Question" ADD COLUMN "textRu" TEXT,
ADD COLUMN "keywordRu" TEXT,
ADD COLUMN "ruNeedsReview" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Option" ADD COLUMN "textRu" TEXT;
