import { IsNotEmpty, IsString } from "class-validator";
import type { LocalizedTextDto } from "../../common/localized-text";
import type { QuestionKeywordsDto } from "../../common/question-content";

export class CheckAnswerDto {
  @IsString()
  @IsNotEmpty()
  optionId: string;
}

export class CheckAnswerResultDto {
  correct: boolean;
  correctOptionId: string;
  /** Eski format (bitta matn) — eski klientlar uchun. */
  keyword: LocalizedTextDto;
  /** Savol va javob kalit so'zlari belgilash pozitsiyalari bilan; `null` — kalit so'z mavjud emas. */
  keywords: QuestionKeywordsDto | null;
  /** Izoh — faqat admin tasdiqlagan bo'lsa; aks holda `null`. */
  explanation: LocalizedTextDto | null;

  constructor(
    correct: boolean,
    correctOptionId: string,
    keyword: LocalizedTextDto,
    keywords: QuestionKeywordsDto | null,
    explanation: LocalizedTextDto | null = null,
  ) {
    this.correct = correct;
    this.correctOptionId = correctOptionId;
    this.keyword = keyword;
    this.keywords = keywords;
    this.explanation = explanation;
  }
}
