import { IsNotEmpty, IsString } from "class-validator";
import type { LocalizedTextDto } from "../../common/localized-text";

export class CheckAnswerDto {
  @IsString()
  @IsNotEmpty()
  optionId: string;
}

export class CheckAnswerResultDto {
  correct: boolean;
  correctOptionId: string;
  keyword: LocalizedTextDto;

  constructor(correct: boolean, correctOptionId: string, keyword: LocalizedTextDto) {
    this.correct = correct;
    this.correctOptionId = correctOptionId;
    this.keyword = keyword;
  }
}
