export interface Collection {
  id: string;
  slug: string;
  title: { uz: string; cyrl: string; ru: string };
  published: boolean;
  sortOrder: number;
  questionCount: number;
}
