import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsUUID, ValidateNested } from "class-validator";

export class AttemptAnswerDto {
  @IsUUID()
  questionId: string;

  @IsUUID()
  optionId: string;
}

export class CreateTestAttemptDto {
  /** Javob berilgan savollar; javobsiz qolganlari yuborilmaydi (noto'g'ri hisoblanadi). */
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AttemptAnswerDto)
  answers: AttemptAnswerDto[];
}

export interface TestAttemptDto {
  topicSlug: string;
  correct: number;
  total: number;
  percent: number;
  createdAt: Date;
}
