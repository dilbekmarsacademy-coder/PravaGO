import type { LocalizedText } from "@/lib/i18n/localized";

export interface Day {
  id: string;
  number: number; // 1-7
  isFinalExam: boolean; // 7-kun — yakuniy ichki imtihon, mavzusiz
  topicIds: string[]; // kun ichidagi tartibda
}

export interface Topic {
  id: string;
  number: number; // rasmiy test raqami (testNo), kunlar bo'ylab ketma-ket bo'lishi shart emas
  title: LocalizedText;
  testSlug?: string; // backend test bankidagi slug (mavjud bo'lsa mavzu bosilganda test boshlanadi)
  dayId: string;
  questionCount: number;
}

export interface TopicAttempt {
  percent: number;
  date: string; // ISO sana
}

export interface TopicProgress {
  topicId: string;
  videoWatched: boolean;
  pdfOpened: boolean;
  attempts: TopicAttempt[];
}

export interface ExamProgress {
  attempts: TopicAttempt[];
  maxAttempts: number;
}
