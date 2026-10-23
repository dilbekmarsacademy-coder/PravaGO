import { IsBoolean, IsUUID, Matches } from "class-validator";
import type { LocalizedTextDto } from "../../common/localized-text";
import type { QuestionKeywordsDto } from "../../common/question-content";

const TOPIC_SLUG = /^[a-z0-9-]{1,120}$/;

export class TopicSlugParamDto {
  @Matches(TOPIC_SLUG)
  slug: string;
}

export class ReviewParamDto extends TopicSlugParamDto {
  @IsUUID()
  questionId: string;
}

export class SetReviewedDto {
  @IsBoolean()
  reviewed: boolean;
}

export interface KeywordCardDto {
  id: string;
  order: number;
  text: LocalizedTextDto;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  /** To'g'ri javob matni (kalit so'z belgilash oralig'i shu matnga nisbatan). */
  correctAnswer: LocalizedTextDto | null;
  explanation: LocalizedTextDto | null;
  /** `null` — kalit so'z mavjud emas. */
  keywords: QuestionKeywordsDto | null;
  reviewed: boolean;
}

export interface KeywordListDto {
  total: number;
  reviewedCount: number;
  items: KeywordCardDto[];
}

export interface ReviewResultDto {
  questionId: string;
  reviewed: boolean;
  total: number;
  reviewedCount: number;
}
