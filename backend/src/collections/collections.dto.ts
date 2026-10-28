import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from "class-validator";

export class TitleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  uz: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cyrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ru?: string;
}

export class CreateCollectionDto {
  @ValidateNested()
  @Type(() => TitleDto)
  title: TitleDto;
}

export class UpdateCollectionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TitleDto)
  title?: TitleDto;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class ReorderDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID("4", { each: true })
  ids: string[];
}

export class SimilarDto {
  @IsString()
  @MaxLength(3000)
  text: string;

  @IsOptional()
  @IsUUID()
  excludeId?: string;
}

export class TranslateDto {
  @IsString()
  @MaxLength(3000)
  text: string;

  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(3000, { each: true })
  options: string[];

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  explanation?: string;
}
