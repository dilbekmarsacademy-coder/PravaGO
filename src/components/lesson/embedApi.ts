// Tashqi video pleyerning IFrame API'si (maxfiylik rejimidagi domen) — minimal turlar va yuklovchi.
// Pleyer iframe'ini o'zimiz yaratamiz (atributlar to'liq nazoratda), API
// faqat boshqaruv uchun unga ulanadi. Foydalanuvchiga ko'rinadigan matnlarda
// va atributlarda manba nomi ishlatilmaydi.

export const PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export interface EmbedPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}

interface PlayerEvent<T = unknown> {
  target: EmbedPlayer;
  data: T;
}

export interface PlayerEvents {
  onReady?: (event: PlayerEvent) => void;
  onStateChange?: (event: PlayerEvent<number>) => void;
  onError?: (event: PlayerEvent<number>) => void;
}

interface EmbedNamespace {
  Player: new (element: HTMLIFrameElement, options: { events: PlayerEvents }) => EmbedPlayer;
  /** API to'liq yuklanganda 1 bo'ladi. */
  loaded?: number;
}

declare global {
  interface Window {
    YT?: EmbedNamespace;
  }
}

const EMBED_HOST = "https://www.youtube-nocookie.com";
const API_SRC = "https://www.youtube.com/iframe_api";
const LOAD_TIMEOUT_MS = 15_000;
const POLL_MS = 50;

/**
 * Iframe manzili. Boshqaruv elementlari, klaviatura, to'liq ekran, tavsiyalar,
 * annotatsiyalar va subtitrlar o'chirilgan — hammasi o'zimizning interfeysda.
 */
export function embedSrc(videoId: string, startSec: number): string {
  const params = new URLSearchParams({
    enablejsapi: "1",
    origin: window.location.origin,
    controls: "0",
    disablekb: "1",
    modestbranding: "1",
    rel: "0",
    fs: "0",
    iv_load_policy: "3",
    playsinline: "1",
    cc_load_policy: "0",
    autoplay: "0",
    start: String(Math.max(0, Math.floor(startSec))),
  });
  return `${EMBED_HOST}/embed/${encodeURIComponent(videoId)}?${params}`;
}

let apiPromise: Promise<EmbedNamespace> | null = null;

function readyApi(): EmbedNamespace | null {
  const api = window.YT;
  return api?.Player && api.loaded === 1 ? api : null;
}

/**
 * API skriptini bir marta yuklaydi (barcha pleyerlar uchun umumiy). Tayyorlik
 * global callback orqali emas, `loaded` bayrog'ini kuzatib aniqlanadi — kodda
 * manbaga xos nomlar qolmasin.
 */
export function loadEmbedApi(): Promise<EmbedNamespace> {
  const ready = readyApi();
  if (ready) return Promise.resolve(ready);
  apiPromise ??= new Promise<EmbedNamespace>((resolve, reject) => {
    const startedAt = Date.now();
    const fail = (message: string) => {
      window.clearInterval(poll);
      apiPromise = null;
      reject(new Error(message));
    };
    const poll = window.setInterval(() => {
      const api = readyApi();
      if (api) {
        window.clearInterval(poll);
        resolve(api);
      } else if (Date.now() - startedAt > LOAD_TIMEOUT_MS) {
        fail("player api timeout");
      }
    }, POLL_MS);
    const script = document.createElement("script");
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => {
      script.remove();
      fail("player api failed to load");
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}
