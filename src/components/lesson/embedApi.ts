// Tashqi video pleyerning IFrame API'si — minimal turlar va yuklovchi.
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
}

declare global {
  interface Window {
    YT?: EmbedNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const EMBED_HOST = "https://www.youtube-nocookie.com";
const API_SRC = "https://www.youtube.com/iframe_api";
const LOAD_TIMEOUT_MS = 15_000;

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
    showinfo: "0",
    autoplay: "0",
    start: String(Math.max(0, Math.floor(startSec))),
  });
  return `${EMBED_HOST}/embed/${encodeURIComponent(videoId)}?${params}`;
}

let apiPromise: Promise<EmbedNamespace> | null = null;

/** API skriptini bir marta yuklaydi (barcha pleyerlar uchun umumiy). */
export function loadEmbedApi(): Promise<EmbedNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<EmbedNamespace>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      apiPromise = null;
      reject(new Error("player api timeout"));
    }, LOAD_TIMEOUT_MS);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("player api missing"));
    };
    const script = document.createElement("script");
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      apiPromise = null;
      script.remove();
      reject(new Error("player api failed to load"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}
