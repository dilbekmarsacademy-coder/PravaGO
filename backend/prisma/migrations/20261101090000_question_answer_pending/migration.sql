-- Javobi belgilanmagan savol: admin javobni belgilab "Tugatdim" bosmaguncha o'quvchiga ko'rinmaydi.
-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "answerPending" BOOLEAN NOT NULL DEFAULT false;

-- Allaqachon javobsiz qo'shilgan savollar (to'g'ri varianti yo'q) — kutilmoqda.
UPDATE "Question" q SET "answerPending" = true
WHERE q."deletedAt" IS NULL AND NOT EXISTS (SELECT 1 FROM "Option" o WHERE o."questionId" = q.id AND o."isCorrect");
