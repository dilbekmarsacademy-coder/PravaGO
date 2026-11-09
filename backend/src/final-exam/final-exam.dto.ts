import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { CERTIFICATE_NUMBER_RE } from "./rules";

export class StartFinalExamDto {
  @IsIn(["Q20", "Q50"])
  type: "Q20" | "Q50";
}

export class FinalAttemptParamDto {
  @IsUUID()
  id: string;
}

export class FinalAnswerDto {
  @IsInt()
  @Min(0)
  @Max(49)
  position: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  optionId: string;
}

export class FinalSkipDto {
  @IsInt()
  @Min(0)
  @Max(49)
  position: number;
}

export class CertificateParamDto {
  @Matches(CERTIFICATE_NUMBER_RE)
  number: string;
}

export class CertificateNameDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName: string;
}

export class AdminFinalExamQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

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

export class AdminFinalUserParamDto {
  @IsUUID()
  userId: string;
}

export class AdminFinalResetDto {
  @IsIn(["Q20", "Q50"])
  type: "Q20" | "Q50";
}
