-- Markaz o'quvchilari (login + parol) va yagona faol qurilma. Faqat qo'shimcha
-- ustunlar/jadval — eski kod yangi sxema bilan ishlayveradi.

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('SELF', 'CENTER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "type" "UserType" NOT NULL DEFAULT 'SELF',
ADD COLUMN     "login" VARCHAR(40),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "centerAccess" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdByAdminId" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMPTZ(3),
ADD COLUMN     "activeSessionId" VARCHAR(64),
ADD COLUMN     "lastDevice" VARCHAR(80);

-- CreateTable
CREATE TABLE "UserLoginAttempt" (
    "id" TEXT NOT NULL,
    "login" VARCHAR(100) NOT NULL,
    "ip" VARCHAR(100) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" VARCHAR(40) NOT NULL,
    "userAgent" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE INDEX "User_type_idx" ON "User"("type");

-- CreateIndex
CREATE INDEX "UserLoginAttempt_ip_createdAt_idx" ON "UserLoginAttempt"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "UserLoginAttempt_login_createdAt_idx" ON "UserLoginAttempt"("login", "createdAt");
