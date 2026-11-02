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
  /** `/images/...` (API manziliga nisbatan) yoki to'liq URL; rasmsiz savolda null. */
  imageUrl: string | null;
  /** 800 px variant (AI importdagi rasmlar); bo'lmasa — maydon yo'q. */
  imageSmallUrl?: string;
  imageWidth: number | null;
  imageHeight: number | null;
  options: PublicOptionDto[];

  constructor(params: {
    id: string;
    text: LocalizedTextDto;
    imageUrl: string | null;
    imageSmallUrl?: string | null;
    imageWidth: number | null;
    imageHeight: number | null;
    options: PublicOptionDto[];
  }) {
    this.id = params.id;
    this.text = params.text;
    this.imageUrl = params.imageUrl;
    if (params.imageSmallUrl) this.imageSmallUrl = params.imageSmallUrl;
    this.imageWidth = params.imageWidth;
    this.imageHeight = params.imageHeight;
    this.options = params.options;
  }
}
