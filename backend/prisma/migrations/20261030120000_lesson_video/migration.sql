-- CreateTable
CREATE TABLE "LessonVideo" (
    "lessonId" VARCHAR(64) NOT NULL,
    "videoId" VARCHAR(32) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LessonVideo_pkey" PRIMARY KEY ("lessonId")
);
