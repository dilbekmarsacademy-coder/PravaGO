import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";
import { MAX_CHUNK, RANDOM_TEST_SIZES } from "./random-tests.service";

export class StartRandomTestDto {
  @IsIn(RANDOM_TEST_SIZES as unknown as number[])
  size: number;

  /** Bazada savol kam bo'lsa — borlari bilan boshlash (foydalanuvchi rozi bo'ldi). */
  @IsOptional()
  @IsBoolean()
  allowFewer?: boolean;
}

export class AttemptParamDto {
  @IsUUID()
  id: string;
}

export class ChunkQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  from: number = 0;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CHUNK)
  count: number = MAX_CHUNK;
}

export class RandomAnswerDto {
  @IsInt()
  @Min(0)
  @Max(1000)
  position: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  optionId: string;
}

export class AdminRandomTestsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(["in_progress", "finished", "expired"])
  status?: "in_progress" | "finished" | "expired";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;
}
