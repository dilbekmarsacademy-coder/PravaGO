"use client";

// O'zimizning analitika (tashqi servissiz): hodisalar navbatga yig'iladi va
// batch bilan yuboriladi — sahifani sekinlatmaydi. Shaxsiy ma'lumot yuborilmaydi:
// faqat tasodifiy qurilma/sessiya ID'lari, yo'l (parametrlarsiz) va hodisa turi.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const VISITOR_KEY = "pt_vid";
const SESSION_KEY = "pt_sid";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_MS = 10_000;
const MAX_BATCH = 20;

export type AnalyticsEventType =
  | "page_view"
  | "session_start"
  | "ping"
  | "test_start"
  | "test_finish"
  | "video_watched"
  | "keywords_view"
  | "register"
  | "payment_request";

interface QueuedEvent {
  type: AnalyticsEventType;
  path?: string;
  topicSlug?: string;
  value?: number;
}

const queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "anon-" + randomId();
  }
}

/** Tab sessiyasi: 30 daqiqa harakatsizlikdan keyin yangisi boshlanadi. */
export function sessionId(): { id: string; isNew: boolean } {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const now = Date.now();
    if (raw) {
      const [id, last] = raw.split(":");
      if (id && now - Number(last) < SESSION_IDLE_MS) {
        sessionStorage.setItem(SESSION_KEY, `${id}:${now}`);
        return { id, isNew: false };
      }
    }
    const id = randomId();
    sessionStorage.setItem(SESSION_KEY, `${id}:${now}`);
    return { id, isNew: true };
  } catch {
    return { id: "s-" + randomId(), isNew: false };
  }
}

function sessionToken(): string | null {
  try {
    return localStorage.getItem("pt_session_token");
  } catch {
    return null;
  }
}

export function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0 || !API_BASE_URL) return;
  const events = queue.splice(0, 50);
  const token = sessionToken();
  fetch(`${API_BASE_URL}/events`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ visitorId: visitorId(), sessionId: sessionId().id, events }),
  }).catch(() => undefined);
}

export function track(type: AnalyticsEventType, data: Omit<QueuedEvent, "type"> = {}): void {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/admin")) return;
  queue.push({ type, ...data, ...(data.value !== undefined ? { value: Math.round(data.value * 100) / 100 } : {}) });
  if (queue.length >= MAX_BATCH) flush();
  else timer ??= setTimeout(flush, FLUSH_MS);
}
