-- 20261028160000_analytics_ai migratsiyasini orqaga qaytarish.
-- keyin: npx prisma migrate resolve --rolled-back 20261028160000_analytics_ai
DROP TABLE IF EXISTS "AiReportMessage";
DROP TABLE IF EXISTS "AiReport";
DROP TABLE IF EXISTS "AnalyticsEvent";
