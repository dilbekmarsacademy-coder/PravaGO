// Mock foydalanuvchi progressi. Haqiqiy backend ulanganda bu massiv/obyekt
// o'rniga foydalanuvchining shaxsiy progressi keladi — quyi qatlamdagi hech bir
// komponent buni bilmasligi kerak (faqat `lib/api/course.ts` orqali murojaat qiling).
//
// Holat: yangi ro'yxatdan o'tgan foydalanuvchi — hech bir mavzu boshlanmagan.

import type { ExamProgress, TopicProgress } from "@/lib/course-types";
import { FINAL_EXAM_MAX_ATTEMPTS } from "@/config/rules";

export const MOCK_TOPIC_PROGRESS: TopicProgress[] = [];

export const MOCK_EXAM_PROGRESS: ExamProgress = {
  attempts: [],
  maxAttempts: FINAL_EXAM_MAX_ATTEMPTS,
};
