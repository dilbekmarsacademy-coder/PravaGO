// Bu DTO'lar frontendga chiqariladigan javoblarni shakllantiradi.
// `correctOptionId` va `keyword` bu yerda ATAYLAB yo'q — savollar
// ro'yxati so'ralganda ular hech qachon JSON'da bo'lmasligi kerak.

import type { LocalizedTextDto } from "../../common/localized-text";

export class PublicOptionDto {
  id: string;
  text: LocalizedTextDto;

  constructor(id: string, text: LocalizedTextDto) {
    this.id = id;
    this.text = text;
  }
}

export class PublicQuestionDto {
  id: string;
  text: LocalizedTextDto;
  imageUrl: string;
  options: PublicOptionDto[];

  constructor(params: {
    id: string;
    text: LocalizedTextDto;
    imageUrl: string;
    options: PublicOptionDto[];
  }) {
    this.id = params.id;
    this.text = params.text;
    this.imageUrl = params.imageUrl;
    this.options = params.options;
  }
}
