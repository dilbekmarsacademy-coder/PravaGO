import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import type { LocalizedTextDto } from "../../common/localized-text";

export const SAVED_SOURCE_MODES = ["practice", "exam"] as const;
export type SavedSourceModeValue = (typeof SAVED_SOURCE_MODES)[number];

export const SAVED_LANGS = ["uz-latn", "uz-cyrl", "ru"] as const;
export type SavedLang = (typeof SAVED_LANGS)[number];

const TOPIC_SLUG = /^[a-z0-9-]{1,120}$/;

/** Bo'sh satrni "yo'q" deb hisoblaymiz (`?topicSlug=` kabi). */
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export class CreateSavedDto {
  @IsUUID()
  questionId: string;

  @IsIn(SAVED_SOURCE_MODES)
  sourceMode: SavedSourceModeValue;

  // Imtihon rejimida urinish majburiy, mashqda — taqiqlangan emas, lekin e'tiborsiz.
  @ValidateIf((dto: CreateSavedDto) => dto.sourceMode === "exam" || dto.attemptId !== undefined)
  @IsUUID()
  attemptId?: string;
}

export class UpdateSavedNoteDto {
  // null yoki "" — izohni o'chirish.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note: string | null;
}

export class SavedIdsQueryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(TOPIC_SLUG)
  topicSlug?: string;
}

export class ListSavedQueryDto {
  @IsOptional()
  @IsIn(SAVED_LANGS)
  lang?: SavedLang;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(TOPIC_SLUG)
  topicSlug?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(["new", "old"])
  sort?: "new" | "old";

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class QuestionIdParamDto {
  @IsUUID()
  questionId: string;
}

// ---- Javoblar ----

export class SavedRecordDto {
  questionId: string;
  topicSlug: string;
  sourceMode: SavedSourceModeValue;
  attemptId: string | null;
  note: string | null;
  createdAt: Date;
}

export interface SavedOptionDto {
  id: string;
  text: LocalizedTextDto;
}

/**
 * To'liq saqlangan savol. `answerLocked=true` bo'lsa `correctOptionId` va
 * `keyword` JSON'da umuman bo'lmaydi (imtihon urinishi hali yakunlanmagan).
 */
export interface SavedItemDto extends SavedRecordDto {
  question: {
    order: number;
    text: LocalizedTextDto;
    imageUrl: string;
    imageWidth: number | null;
    imageHeight: number | null;
    options: SavedOptionDto[];
  };
  answerLocked: boolean;
  correctOptionId?: string;
  keyword?: LocalizedTextDto;
}

export interface SavedListDto {
  items: SavedItemDto[];
  nextCursor: string | null;
}

export interface SavedCountDto {
  total: number;
  limit: number;
  byTopic: { topicSlug: string; count: number }[];
}
