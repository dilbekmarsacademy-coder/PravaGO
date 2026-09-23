// Mock foydalanuvchi progressi. Haqiqiy backend ulanganda bu massiv/obyekt
// o'rniga foydalanuvchining shaxsiy progressi keladi — quyi qatlamdagi hech bir
// komponent buni bilmasligi kerak (faqat `lib/api/course.ts` orqali murojaat qiling).
//
// Holat: 1-kunning birinchi 3 ta mavzusi tugatilgan (topic-22 — 2 urinishda:
// 74% dan keyin 99%), 4-mavzu (topic-23)da video ko'rilgan, PDF hali ochilmagan,
// qolgan mavzular hali boshlanmagan.

import type { ExamProgress, TopicProgress } from "@/lib/course-types";
import { FINAL_EXAM_MAX_ATTEMPTS } from "@/config/rules";

export const MOCK_TOPIC_PROGRESS: TopicProgress[] = [
  {
    topicId: "topic-14",
    videoWatched: true,
    pdfOpened: true,
    attempts: [{ percent: 98, date: "2026-09-15T09:20:00.000Z" }],
  },
  {
    topicId: "topic-15",
    videoWatched: true,
    pdfOpened: true,
    attempts: [{ percent: 100, date: "2026-09-15T10:05:00.000Z" }],
  },
  {
    topicId: "topic-22",
    videoWatched: true,
    pdfOpened: true,
    attempts: [
      { percent: 74, date: "2026-09-16T08:40:00.000Z" },
      { percent: 99, date: "2026-09-16T09:10:00.000Z" },
    ],
  },
  {
    topicId: "topic-23",
    videoWatched: true,
    pdfOpened: false,
    attempts: [],
  },
];

export const MOCK_EXAM_PROGRESS: ExamProgress = {
  attempts: [],
  maxAttempts: FINAL_EXAM_MAX_ATTEMPTS,
};
