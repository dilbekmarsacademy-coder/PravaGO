// Test javobini belgilash: "Qabul qilaymi?" paneli kerakmi yoki javob darhol qabul qilinadimi.
// Bayroq serverdan keladi (GET /me → skipAnswerConfirm). Faqat aniq `true` bo'lsa panel
// o'tkazib yuboriladi — yuklanmagan yoki noma'lum holatda panel chiqadi (xavfsiz default).

export type AnswerSelection =
  | { kind: "confirm"; index: number; optionId: string }
  | { kind: "submit"; index: number; optionId: string };

export function needsAnswerConfirm(skipAnswerConfirm: boolean | null | undefined): boolean {
  return skipAnswerConfirm !== true;
}

export function selectAnswer(skipAnswerConfirm: boolean | null | undefined, index: number, optionId: string): AnswerSelection {
  return { kind: needsAnswerConfirm(skipAnswerConfirm) ? "confirm" : "submit", index, optionId };
}
