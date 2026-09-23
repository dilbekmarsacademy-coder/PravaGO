import { IsNotEmpty, IsString } from "class-validator";

export class CheckAnswerDto {
  @IsString()
  @IsNotEmpty()
  optionId: string;
}

export class CheckAnswerResultDto {
  correct: boolean;
  correctOptionId: string;
  keyword: string;

  constructor(correct: boolean, correctOptionId: string, keyword: string) {
    this.correct = correct;
    this.correctOptionId = correctOptionId;
    this.keyword = keyword;
  }
}
