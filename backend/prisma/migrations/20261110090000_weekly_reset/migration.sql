-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentAt" TIMESTAMPTZ(3),
ADD COLUMN     "offerVersion" VARCHAR(20),
ADD COLUMN     "registrationIp" VARCHAR(100),
ADD COLUMN     "weeklyResetExempt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TopicTestAttempt" ADD COLUMN     "archiveWeekKey" VARCHAR(40),
ADD COLUMN     "archivedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "AnswerLog" ADD COLUMN     "archiveWeekKey" VARCHAR(40),
ADD COLUMN     "archivedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "RandomTestAttempt" ADD COLUMN     "archiveWeekKey" VARCHAR(40),
ADD COLUMN     "archivedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "WeeklyReset" (
    "id" TEXT NOT NULL,
    "weekKey" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "triggeredBy" VARCHAR(20) NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "affectedUsers" INTEGER NOT NULL DEFAULT 0,
    "counts" JSONB,
    "error" VARCHAR(500),
    "adminId" TEXT,

    CONSTRAINT "WeeklyReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyResultArchive" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "sourceId" TEXT NOT NULL,
    "weekKey" VARCHAR(40) NOT NULL,
    "data" JSONB NOT NULL,
    "sourceCreatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyResultArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReset_weekKey_key" ON "WeeklyReset"("weekKey");

-- CreateIndex
CREATE INDEX "WeeklyReset_status_finishedAt_idx" ON "WeeklyReset"("status", "finishedAt");

-- CreateIndex
CREATE INDEX "WeeklyResultArchive_userId_weekKey_idx" ON "WeeklyResultArchive"("userId", "weekKey");

-- CreateIndex
CREATE INDEX "WeeklyResultArchive_weekKey_kind_idx" ON "WeeklyResultArchive"("weekKey", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyResultArchive_kind_sourceId_key" ON "WeeklyResultArchive"("kind", "sourceId");

-- CreateIndex
CREATE INDEX "User_registrationIp_registeredAt_idx" ON "User"("registrationIp", "registeredAt");

-- CreateIndex
CREATE INDEX "TopicTestAttempt_userId_archivedAt_idx" ON "TopicTestAttempt"("userId", "archivedAt");

