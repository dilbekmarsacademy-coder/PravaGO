-- 20261028095644_admin_auth migratsiyasini orqaga qaytarish.
-- Ishlatish: psql "$DATABASE_URL_UNPOOLED" -f prisma/down/20261028095644_admin_auth.down.sql
-- keyin: npx prisma migrate resolve --rolled-back 20261028095644_admin_auth
DROP TABLE IF EXISTS "AuditLog";
DROP TABLE IF EXISTS "AdminLoginAttempt";
DROP TABLE IF EXISTS "AdminSession";
DROP TABLE IF EXISTS "Admin";
DROP TYPE IF EXISTS "AdminRole";
