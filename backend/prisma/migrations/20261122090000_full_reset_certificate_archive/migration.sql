-- Bir martalik to'liq nollash: sertifikatlar o'chirilmaydi, arxivlanadi
-- (kabinetdagi "Sertifikatlar"dan yashiriladi, admin arxivida qoladi).
ALTER TABLE "Certificate" ADD COLUMN "archivedAt" TIMESTAMPTZ(3);
ALTER TABLE "Certificate" ADD COLUMN "archiveWeekKey" VARCHAR(40);

-- Bir turga bitta sertifikat — endi faqat FAOL (arxivlanmagan) sertifikatlar orasida:
-- nollashdan keyin o'quvchi imtihonni qayta topshirib, yangi sertifikat olishi mumkin.
-- Prisma sxemasi qisman indeksni ifodalay olmaydi — u shu migratsiyada qo'lda yaratiladi.
DROP INDEX "Certificate_userId_examType_key";
CREATE INDEX "Certificate_userId_examType_idx" ON "Certificate"("userId", "examType");
CREATE UNIQUE INDEX "Certificate_active_userId_examType_key" ON "Certificate"("userId", "examType") WHERE "archivedAt" IS NULL;
