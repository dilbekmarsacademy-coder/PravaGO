import type { Dictionary } from "@/lib/i18n";
import { COURSE_TOPICS } from "@/data/curriculum";
import type { Topic } from "@/lib/course-types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Nisbiy sana: "hozirgina", "5 daqiqa oldin", "2 kun oldin"... */
export function formatAgo(iso: string, now: number, ago: Dictionary["saved"]["ago"]): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < MINUTE) return ago.justNow;
  if (diff < HOUR) return ago.minutes(Math.floor(diff / MINUTE));
  if (diff < DAY) return ago.hours(Math.floor(diff / HOUR));
  const days = Math.floor(diff / DAY);
  if (days < 30) return ago.days(days);
  if (days < 365) return ago.months(Math.floor(days / 30));
  return ago.years(Math.floor(days / 365));
}

/** Header badge'i: 99 dan keyin "99+". */
export function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/** Backend mavzu slug'i bo'yicha o'quv dasturidagi mavzu (nomi, test raqami, video sahifasi). */
export function topicBySlug(slug: string): Topic | undefined {
  return COURSE_TOPICS.find((topic) => topic.testSlug === slug);
}
