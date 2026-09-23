// Bu DTO'lar frontendga chiqariladigan javoblarni shakllantiradi.
// `correctOptionId` va `keyword` bu yerda ATAYLAB yo'q — savollar
// ro'yxati so'ralganda ular hech qachon JSON'da bo'lmasligi kerak.

export class PublicOptionDto {
  id: string;
  text: string;

  constructor(id: string, text: string) {
    this.id = id;
    this.text = text;
  }
}

export class PublicQuestionDto {
  id: string;
  text: string;
  imageUrl: string;
  options: PublicOptionDto[];

  constructor(params: { id: string; text: string; imageUrl: string; options: PublicOptionDto[] }) {
    this.id = params.id;
    this.text = params.text;
    this.imageUrl = params.imageUrl;
    this.options = params.options;
  }
}
