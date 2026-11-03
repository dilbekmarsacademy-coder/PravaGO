import type { INestApplication } from "@nestjs/common";
import request from "supertest";

/** Mavzuning barcha savollariga "Tanishdim" — test savollari shundan keyin ochiladi (KEYWORDS_NOT_REVIEWED). */
export async function reviewAllKeywords(app: INestApplication, auth: Record<string, string>, slug: string): Promise<void> {
  const http = () => request(app.getHttpServer());
  const list = await http().get(`/topics/${slug}/keywords`).set(auth).expect(200);
  for (const item of list.body.items as { id: string; reviewed: boolean }[]) {
    if (!item.reviewed) await http().put(`/topics/${slug}/keywords/${item.id}/review`).set(auth).send({ reviewed: true }).expect(200);
  }
}
