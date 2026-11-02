export interface Collection {
  id: string;
  slug: string;
  title: { uz: string; cyrl: string; ru: string };
  published: boolean;
  sortOrder: number;
  groupId: string | null;
  linkedDay: number | null;
  linkedTopicSlug: string | null;
  questionCount: number;
}

/** "Yangi testlar" to'plami (ichida testlar). */
export interface TestGroup {
  id: string;
  name: string;
  sortOrder: number;
  testCount: number;
}
