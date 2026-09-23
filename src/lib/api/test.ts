// Test/Savollar backend moduli bilan ishlaydigan API qatlami.
// Backend hech qachon to'g'ri javob/kalit so'zni savollar ro'yxatida
// qaytarmaydi — ular faqat check-answer javobida keladi.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface ApiOption {
  id: string;
  text: string;
}

export interface ApiQuestion {
  id: string;
  text: string;
  imageUrl: string;
  options: ApiOption[];
}

export interface CheckAnswerResult {
  correct: boolean;
  correctOptionId: string;
  keyword: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`So'rov muvaffaqiyatsiz tugadi: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getTopicQuestions(topicSlug: string): Promise<ApiQuestion[]> {
  return apiFetch<ApiQuestion[]>(`/topics/${topicSlug}/questions`);
}

export function checkAnswer(questionId: string, optionId: string): Promise<CheckAnswerResult> {
  return apiFetch<CheckAnswerResult>(`/questions/${questionId}/check-answer`, {
    method: "POST",
    body: JSON.stringify({ optionId }),
  });
}
