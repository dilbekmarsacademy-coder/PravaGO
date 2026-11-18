import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";
import { PageQueryDto } from "../dto/admin-auth.dto";
import { LOGIN_PATTERN, MAX_CENTER_PASSWORD_LENGTH, MIN_CENTER_PASSWORD_LENGTH, PASSWORD_PATTERN } from "../../auth/center-credentials";

const PASSWORD_LENGTH_MESSAGE = `Parol ${MIN_CENTER_PASSWORD_LENGTH}–${MAX_CENTER_PASSWORD_LENGTH} belgidan iborat bo'lsin`;
const PASSWORD_PATTERN_MESSAGE = "Parolda bo'sh joy bo'lmasin";

export const BULK_MAX = 200;

export class StudentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(["active", "inactive", "blocked"])
  status?: "active" | "inactive" | "blocked";
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

  /** Parolni admin o'zi kiritadi (majburiy). */
  @IsString()
  @MinLength(MIN_CENTER_PASSWORD_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @MaxLength(MAX_CENTER_PASSWORD_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE })
  password: string;
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

export class SetPasswordDto {
  @IsString()
  @MinLength(MIN_CENTER_PASSWORD_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @MaxLength(MAX_CENTER_PASSWORD_LENGTH, { message: PASSWORD_LENGTH_MESSAGE })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE })
  password: string;
}
