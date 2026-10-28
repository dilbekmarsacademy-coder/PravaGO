import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

/** Savol/variant/izoh matni: kirill (asosiy), lotin, rus. */
export class LangTextDto {
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  cyrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  latn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  ru?: string;
}

export class OptionInputDto {
  /** Mavjud variant — id bilan (o'zgarishsiz qoladi), yangi variant — id'siz. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @ValidateNested()
  @Type(() => LangTextDto)
  text: LangTextDto;
}

/** Har tilda `[start, end)` oraliqlar ro'yxati (bir nechta bo'lak). */
export class HighlightInputDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsArray({ each: true })
  uz?: number[][];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsArray({ each: true })
  cyrl?: number[][];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsArray({ each: true })
  ru?: number[][];
}

export class KeywordsInputDto {
  /** "Kalit so'z mavjud emas". */
  @IsBoolean()
  none: boolean;

  /** Savol kaliti — savol matnidagi belgilash. */
  @IsOptional()
  @ValidateNested()
  @Type(() => HighlightInputDto)
  question?: HighlightInputDto;

  /** Javob kaliti — to'g'ri variant matnidagi belgilash. */
  @IsOptional()
  @ValidateNested()
  @Type(() => HighlightInputDto)
  answer?: HighlightInputDto;
}

export class QuestionInputDto {
  @ValidateNested()
  @Type(() => LangTextDto)
  text: LangTextDto;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => OptionInputDto)
  options: OptionInputDto[];

  /** To'g'ri javob — aynan bitta (variantlar ro'yxatidagi indeks). */
  @IsInt()
  @Min(0)
  correctIndex: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => LangTextDto)
  explanation?: LangTextDto;

  /** Rasm: assetId — tasdiqlangan rasm, `null` — rasmni olib tashlash, berilmasa — o'zgarmaydi. */
  @IsOptional()
  @IsUUID()
  imageAssetId?: string | null;

  @IsOptional()
  @IsBoolean()
  removeImage?: boolean;

  @ValidateNested()
  @Type(() => KeywordsInputDto)
  keywords: KeywordsInputDto;

  /** Ruscha tarjima hali tekshirilmagan (AI tarjima). */
  @IsOptional()
  @IsBoolean()
  ruNeedsReview?: boolean;
}
