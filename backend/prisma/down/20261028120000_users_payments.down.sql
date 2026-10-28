-- 20261028120000_users_payments migratsiyasini orqaga qaytarish.
-- keyin: npx prisma migrate resolve --rolled-back 20261028120000_users_payments
DROP TABLE IF EXISTS "AnswerLog";
DROP TABLE IF EXISTS "Payment";
DROP INDEX IF EXISTS "User_phone_key";
DROP INDEX IF EXISTS "User_registeredAt_idx";
DROP INDEX IF EXISTS "User_lastActiveAt_idx";
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "accessGrantedAt",
  DROP COLUMN IF EXISTS "age",
  DROP COLUMN IF EXISTS "examStatus",
  DROP COLUMN IF EXISTS "firstName",
  DROP COLUMN IF EXISTS "lastActiveAt",
  DROP COLUMN IF EXISTS "lastName",
  DROP COLUMN IF EXISTS "paymentStatus",
  DROP COLUMN IF EXISTS "phone",
  DROP COLUMN IF EXISTS "phoneVerifiedAt",
  DROP COLUMN IF EXISTS "preferredLanguage",
  DROP COLUMN IF EXISTS "registeredAt";
ALTER TABLE "Session" DROP COLUMN IF EXISTS "lastSeenAt", DROP COLUMN IF EXISTS "userAgent";
DROP TYPE IF EXISTS "PaymentStatus";
DROP TYPE IF EXISTS "UserPaymentStatus";
