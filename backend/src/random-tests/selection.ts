// Random test savollarini tanlash — sof funksiyalar (bazasiz, test qilinadi).

import { shuffle, type Random } from "../common/option-order";

export { shuffle, type Random };

/** Mavzular bo'yicha navbatma-navbat: har aylanishda har mavzudan bittadan — test bitta mavzuga to'planmaydi. */
export function roundRobin(groups: string[][], need: number): string[] {
  const queues = groups.map((g) => [...g]);
  const out: string[] = [];
  while (out.length < need && queues.some((q) => q.length)) {
    for (const q of queues) {
      if (out.length >= need) break;
      const id = q.pop();
      if (id) out.push(id);
    }
  }
  return out;
}

/**
 * `count` ta takrorlanmaydigan savol: avval foydalanuvchi oldingi random
 * testlarda ko'rmaganlari (mavzular bo'yicha teng), yetmasa — ko'rganlaridan.
 * Natija tartibi aralashtiriladi (mavzular aralash keladi).
 */
export function selectQuestions(pool: readonly { id: string; topicId: string }[], seen: ReadonlySet<string>, count: number, random: Random = Math.random): string[] {
  const unique = [...new Map(pool.map((q) => [q.id, q])).values()];
  const group = (items: { id: string; topicId: string }[]) => {
    const byTopic = new Map<string, string[]>();
    for (const q of items) byTopic.set(q.topicId, [...(byTopic.get(q.topicId) ?? []), q.id]);
    return shuffle([...byTopic.values()], random).map((ids) => shuffle(ids, random));
  };
  const fresh = roundRobin(group(unique.filter((q) => !seen.has(q.id))), count);
  const rest = fresh.length < count ? roundRobin(group(unique.filter((q) => seen.has(q.id))), count - fresh.length) : [];
  return shuffle([...fresh, ...rest], random);
}
