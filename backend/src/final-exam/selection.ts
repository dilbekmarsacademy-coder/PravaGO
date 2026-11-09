// Yakuniy imtihon savollarini tanlash va tartiblash — sof funksiyalar (bazasiz, test qilinadi).

import { shuffle, type Random } from "../common/option-order";

export interface PoolQuestion {
  id: string;
  topicId: string;
  day: number;
}

/** `total` ni guruhlarga imkon qadar teng bo'ladi (sig'imdan oshmasdan); ortiqchasi tasodifiy guruhlarga. */
export function splitEvenly(capacities: readonly number[], total: number, random: Random = Math.random): number[] {
  const quotas = capacities.map(() => 0);
  let left = Math.min(total, capacities.reduce((s, c) => s + c, 0));
  while (left > 0) {
    const open = capacities.flatMap((c, i) => (quotas[i] < c ? [i] : []));
    const per = Math.floor(left / open.length);
    if (per > 0) {
      for (const i of open) {
        const add = Math.min(per, capacities[i] - quotas[i]);
        quotas[i] += add;
        left -= add;
      }
    } else {
      for (const i of shuffle(open, random).slice(0, left)) {
        quotas[i] += 1;
        left -= 1;
      }
    }
  }
  return quotas;
}

/** Navbatma-navbat: har aylanishda har ro'yxatdan bittadan. */
function roundRobin<T>(groups: T[][], need: number): T[] {
  const queues = groups.map((g) => [...g]);
  const out: T[] = [];
  while (out.length < need && queues.some((q) => q.length)) {
    for (const q of queues) {
      if (out.length >= need) break;
      const item = q.shift();
      if (item) out.push(item);
    }
  }
  return out;
}

/**
 * `count` ta takrorlanmaydigan savol: kunlar (1–6) bo'yicha teng, kun ichida
 * mavzular bo'yicha navbatma-navbat. Oldingi urinishlarda chiqmagan savollar
 * ustun; yetmasa — chiqqanlaridan (takrorga ruxsat).
 */
export function selectExamQuestions(pool: readonly PoolQuestion[], seen: ReadonlySet<string>, count: number, random: Random = Math.random): PoolQuestion[] {
  const unique = [...new Map(pool.map((q) => [q.id, q])).values()];
  const byDay = new Map<number, PoolQuestion[]>();
  for (const q of unique) byDay.set(q.day, [...(byDay.get(q.day) ?? []), q]);
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const quotas = splitEvenly(
    days.map((d) => byDay.get(d)!.length),
    count,
    random,
  );

  const picked: PoolQuestion[] = [];
  days.forEach((day, i) => {
    const byTopic = new Map<string, PoolQuestion[]>();
    for (const q of byDay.get(day)!) byTopic.set(q.topicId, [...(byTopic.get(q.topicId) ?? []), q]);
    const topics = shuffle([...byTopic.values()], random);
    const fresh = topics.map((list) => shuffle(list.filter((q) => !seen.has(q.id)), random));
    const old = topics.map((list) => shuffle(list.filter((q) => seen.has(q.id)), random));
    const first = roundRobin(fresh, quotas[i]);
    picked.push(...first, ...roundRobin(old, quotas[i] - first.length));
  });
  return arrangeNoAdjacent(picked, random);
}

/**
 * Bir mavzu ikki marta qator kelmaydigan tartib (greedy): har qadamda oldingisidan
 * boshqa, eng ko'p qolgan mavzu (teng bo'lsa — boshqa kundagisi, keyin tasodifiy).
 * Imkoni bo'lmasa (faqat bitta mavzu qolgan) — minimal takror.
 */
export function arrangeNoAdjacent<T extends { topicId: string; day: number }>(items: readonly T[], random: Random = Math.random): T[] {
  const byTopic = new Map<string, T[]>();
  for (const item of shuffle(items, random)) byTopic.set(item.topicId, [...(byTopic.get(item.topicId) ?? []), item]);
  const out: T[] = [];
  let last: T | undefined;
  while (out.length < items.length) {
    const open = shuffle([...byTopic.entries()].filter(([, list]) => list.length > 0), random);
    const candidates = open.filter(([topic]) => topic !== last?.topicId);
    const pool = candidates.length > 0 ? candidates : open;
    pool.sort(([, a], [, b]) => b.length - a.length || Number(a[0].day === last?.day) - Number(b[0].day === last?.day));
    const next = pool[0][1].shift()!;
    out.push(next);
    last = next;
  }
  return out;
}

/** Ketma-ket bir xil mavzu juftliklari soni (tekshiruv va hisobot uchun). */
export function adjacentRepeats(items: readonly { topicId: string }[]): number {
  let n = 0;
  for (let i = 1; i < items.length; i++) if (items[i].topicId === items[i - 1].topicId) n++;
  return n;
}
