import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { EXAM_STATUSES } from "../common/prices";

const NAME = /^[\p{L}][\p{L}\s'ʻʼ‘’`-]*$/u;
export const LOCALES = ["uz-latn", "uz-cyrl", "ru"] as const;

export class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Matches(NAME)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Matches(NAME)
  lastName: string;

  @IsInt()
  @Min(16)
  @Max(90)
  age: number;

  /** "+998 90 123 45 67" yoki "901234567" — serverda +998XXXXXXXXX ga keltiriladi. */
  @IsString()
  @MaxLength(30)
  phone: string;

  @IsIn(EXAM_STATUSES)
  examStatus: (typeof EXAM_STATUSES)[number];

  @IsOptional()
  @IsIn(LOCALES)
  preferredLanguage?: (typeof LOCALES)[number];

  /**
   * Oldingi versiyada faqat brauzerda (localStorage) saqlangan ro'yxat — bir
   * martalik ko'chirish. "active" bo'lsa (eski mock to'lov) admin tasdiqlashi
   * uchun "kutilmoqda" to'lov so'rovi yaratiladi.
   */
  @IsOptional()
  @IsIn(["pending", "active"])
  legacyStatus?: "pending" | "active";
}

export class LanguageDto {
  @IsIn(LOCALES)
  preferredLanguage: (typeof LOCALES)[number];
}

export class PaymentRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
