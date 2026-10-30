import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";
import { PageQueryDto } from "../dto/admin-auth.dto";
import { LOGIN_PATTERN, MIN_CENTER_PASSWORD_LENGTH } from "../../auth/center-credentials";

export const BULK_MAX = 200;

export class StudentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}

export class StudentIdParamDto {
  @IsUUID()
  id: string;
}

export class CreateStudentDto {
  @IsString()
  @MaxLength(30)
  phone: string;

  /** Ism (va familiya) — ixtiyoriy. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /** Bo'sh qoldirilsa — "pt" + 5 raqam avtomatik. */
  @IsOptional()
  @IsString()
  @Matches(LOGIN_PATTERN, { message: "Login: 3–40 belgi, faqat lotin harf, raqam, nuqta, tire" })
  login?: string;

  /** Bo'sh qoldirilsa — 8 belgili oson parol avtomatik. */
  @IsOptional()
  @IsString()
  @MinLength(MIN_CENTER_PASSWORD_LENGTH)
  @MaxLength(100)
  password?: string;
}

export class BulkCreateStudentsDto {
  /** Har bir qator — bitta telefon raqami. */
  @IsArray()
  @ArrayMaxSize(BULK_MAX)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  phones: string[];
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  centerAccess?: boolean;
}

export class ResetPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(MIN_CENTER_PASSWORD_LENGTH)
  @MaxLength(100)
  password?: string;
}
