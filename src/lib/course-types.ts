export interface Day {
  id: string;
  number: number; // 1-7 (7-kun = yakuniy imtihon, mavzusiz)
  title: string;
  topicIds: string[];
}

export interface Topic {
  id: string;
  number: number; // rasmiy mavzu raqami (kunlar bo'ylab ketma-ket bo'lishi shart emas)
  title: string;
  dayId: string;
  videoDurationSec: number;
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
