-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" BIGSERIAL NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "visitorId" VARCHAR(40) NOT NULL,
    "sessionId" VARCHAR(40) NOT NULL,
    "userId" TEXT,
    "path" VARCHAR(200),
    "topicSlug" VARCHAR(120),
    "value" DOUBLE PRECISION,
    "device" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReport" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "stats" JSONB NOT NULL,
    "content" TEXT NOT NULL,
    "model" VARCHAR(60) NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReportMessage" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "adminId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AiReport_createdAt_idx" ON "AiReport"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiReportMessage_reportId_createdAt_idx" ON "AiReportMessage"("reportId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiReportMessage" ADD CONSTRAINT "AiReportMessage_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AiReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

