"use client";

// Himoyalangan video pleyer. Tashqi pleyer faqat "ekran" sifatida ishlatiladi:
//  - iframe'ga hech qanday hodisa yetib bormaydi (pointer-events: none) —
//    barcha boshqaruv o'zimizning qatlamlarda;
//  - iframe konteynerdan 3 barobar baland qilib, vertikal markazlanadi va biroz
//    kattalashtiriladi (scale): video kenglik bo'yicha konteynerga tushadi,
//    pleyerning yuqori paneli va burchakdagi belgisi esa kesilib qoladi;
//  - boshlanishdan oldin, pauzada va tugaganda ustida o'zimizning qopqoq ekran —
//    tashqi pleyerning o'z preview/pauza/tavsiya ekranlari hech qachon ko'rinmaydi;
//  - oldinga o'tkazib bo'lmaydi: vaqt chizig'i faqat ko'rsatadi, → ishlamaydi,
//    har o'lchovda (0.25 s) eng uzoq ko'rilgan nuqtadan +2 s o'tib ketish
//    (masalan, konsol orqali) darhol shu nuqtaga qaytariladi; orqaga — ruxsat;
//  - iframe `sandbox`'da: yangi oyna ochish va sahifani boshqa manzilga o'tkazish taqiqlangan;
//  - skrinshot/ekran yozish urinishida video qora qalqon bilan yopiladi (captureGuard),
//    ustida esa foydalanuvchi telefoni bilan suzuvchi suv belgisi — sizib chiqqan surat egasini ko'rsatadi.
// "Ko'rildi" holatini faqat server belgilaydi — bu yerda faqat o'lchovlar.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import {
  CheckCircle2Icon,
  ClapperboardIcon,
  FastForwardIcon,
  Loader2Icon,
  LockIcon,
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  SkipForwardIcon,
  TriangleAlertIcon,
  Undo2Icon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";
import {
  LESSON_NOT_FOUND_CODE,
  getLessonStatus,
  getLessonVideo,
  reportLessonProgress,
  type LessonStatus,
} from "@/lib/api/lessons";
import { ApiError } from "@/lib/api/session";
import {
  PLAYBACK_RATES,
  TICK_MS,
  clampSeek,
  formatTime,
  tick,
  type PlaybackRate,
  type WatchTally,
} from "@/lib/lesson/watch";
import { useRegistration } from "@/lib/registration-store";
import { PlayerState, embedSrc, loadEmbedApi, type EmbedPlayer } from "./embedApi";
import { useCaptureGuard } from "./captureGuard";

interface SecureVideoPlayerProps {
  lessonId: string;
  /** Qopqoq ekrandagi dars nomi. */
  title?: string;
  /** Server darsni "ko'rildi" deb belgilaganda bir marta chaqiriladi. */
  onCompleted?: (status: LessonStatus) => void;
  /** Har bir server javobida (dastlabki holat ham) — progress foizi uchun. */
  onProgress?: (status: LessonStatus) => void;
  /** Darsga hali video ulanmagan (serverdagi xaritada yo'q). */
  onUnavailable?: () => void;
  className?: string;
}

type Phase = "loading" | "ready" | "error" | "unavailable";
type FullscreenMode = "none" | "native" | "pseudo";

/** Progress serverga shu oraliqda (ijro paytida) va pauza/chiqish/tugashda yuboriladi. */
const REPORT_INTERVAL_MS = 10_000;
const CONTROLS_HIDE_MS = 2500;
/** Dasturiy ijro bloklangan bo'lsa (iOS), shundan keyin "yana bosing" rejimi. */
const TAP_THROUGH_DELAY_MS = 1200;
const SEEK_BACK_SEC = 10;
// VAQTINCHA (sinov uchun): ko'rilmagan qismga oldinga o'tkazish. Faqat
// NEXT_PUBLIC_LESSON_SKIP=true bo'lgan build'da (masalan, preview) yoqiladi;
// server ham faqat LESSON_SKIP_ENABLED=true bo'lsa sakrashni "ko'rildi" deb qabul qiladi.
const TEMP_ALLOW_FORWARD_SEEK = process.env.NEXT_PUBLIC_LESSON_SKIP === "true";
const SEEK_FORWARD_SEC = 10;
/** "Oxiriga" — tugashdan shuncha oldin (server oxirigacha yetildi deb hisoblaydi). */
const SKIP_TO_END_MARGIN_SEC = 2;
/** Bundan kam qolgan bo'lsa, davom ettirish o'rniga boshidan boshlanadi. */
const RESUME_END_MARGIN_SEC = 5;
const HINT_MS = 1800;
/**
 * Tashqi pleyer har bir ijro boshlanishi va seek'dan keyin markazda o'z
 * play/pause belgisini (va ingichka gorizontal chiziqni) ijro boshlangach
 * ~4 s ko'rsatadi — o'lchangan: 3.75 s da bor, 4.0 s da yo'q. Parametr bilan
 * o'chmaydi; tezlik va ovoz o'zgarishi esa uni chaqirmaydi. Shuning uchun har ijro "kirish" bilan
 * boshlanadi: qopqoq ostida ovozsiz, 0.25x tezlikda, nishondan biroz oldindan —
 * belgi yo'qolganda tezlik va ovoz tiklanadi, qopqoq ko'tariladi va video
 * aynan to'xtagan joydan davom etadi (hech narsa o'tkazib yuborilmaydi).
 */
const LEAD_IN_MS = 4300;
const LEAD_IN_RATE = 0.25;
const LEAD_IN_BACK_SEC = (LEAD_IN_MS / 1000) * LEAD_IN_RATE;
/** Suv belgisi har 20–30 soniyada tasodifiy joyga ko'chadi (kesib olib bo'lmasin). */
const WATERMARK_MOVE_MIN_MS = 20_000;
const WATERMARK_MOVE_MAX_MS = 30_000;

const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-presentation";

type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void };

function currentTimeOf(player: EmbedPlayer | null, fallback: number): number {
  try {
    const time = player?.getCurrentTime();
    return typeof time === "number" && Number.isFinite(time) ? time : fallback;
  } catch {
    return fallback;
  }
}

function fullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function SecureVideoPlayer({
  lessonId,
  title,
  onCompleted,
  onProgress,
  onUnavailable,
  className,
}: SecureVideoPlayerProps) {
  const { t } = useLocale();
  const p = t.lesson.player;

  const containerRef = useRef<HTMLDivElement>(null);
  const frameHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<EmbedPlayer | null>(null);
  const tallyRef = useRef<WatchTally>({ maxPosition: 0, pendingSeconds: 0 });
  const lastTimeRef = useRef(0);
  const durationRef = useRef(0);
  const lastSentPositionRef = useRef(0);
  const reportingRef = useRef(false);
  const completedRef = useRef(false);
  const callbacksRef = useRef({ onCompleted, onProgress, onUnavailable });
  /** Qalqon tushganda video o'ynayotgan edi — "Davom etish" ijroni qaytaradi. */
  const resumeAfterShieldRef = useRef(false);
  const stateHandlerRef = useRef<(state: number) => void>(() => undefined);
  const hideTimerRef = useRef<number | undefined>(undefined);
  const hintTimerRef = useRef<number | undefined>(undefined);
  const tapTimerRef = useRef<number | undefined>(undefined);
  const pointerTypeRef = useRef<string>("mouse");
  /**
   * Qopqoq holati. `since` — kirish paytida ijro boshlangan vaqt; `leadIn` —
   * kirish tugagach tiklanadigan tezlik va ovoz (null — oddiy qopqoq, masalan pauzada).
   */
  const veilRef = useRef<{
    active: boolean;
    since: number | null;
    leadIn: { rate: number; unmute: boolean } | null;
  }>({ active: false, since: null, leadIn: null });

  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [playerState, setPlayerState] = useState<number>(PlayerState.UNSTARTED);
  const [hasStarted, setHasStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [maxPosition, setMaxPosition] = useState(0);
  const [resumeAt, setResumeAt] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [rate, setRate] = useState<PlaybackRate>(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState<FullscreenMode>("none");
  const [tapThrough, setTapThrough] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  /** Qopqoq majburan ko'rsatilmoqda (pauza qilinmoqda yoki ijro "kirish"i). */
  const [veil, setVeil] = useState(false);

  /** Tugallanmagan kirish bo'lsa — foydalanuvchi tanlagan tezlik va ovozni qaytaradi. */
  const restoreLeadIn = useCallback(() => {
    const lead = veilRef.current.leadIn;
    const player = playerRef.current;
    if (!lead || !player) return;
    player.setPlaybackRate(lead.rate);
    if (lead.unmute) player.unMute();
  }, []);

  const raiseVeil = useCallback(() => {
    restoreLeadIn();
    veilRef.current = { active: true, since: null, leadIn: null };
    setVeil(true);
  }, [restoreLeadIn]);

  const liftVeil = useCallback(() => {
    restoreLeadIn();
    veilRef.current = { active: false, since: null, leadIn: null };
    setVeil(false);
  }, [restoreLeadIn]);

  const flashHint = useCallback((text: string) => {
    setHint(text);
    window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHint(null), HINT_MS);
  }, []);

  /** O'ynayotgan bo'lsa pauza qiladi; o'ynayotgan edimi — qaytaradi. */
  const pauseIfPlaying = useCallback((): boolean => {
    const player = playerRef.current;
    const state = player?.getPlayerState();
    if (state !== PlayerState.PLAYING && state !== PlayerState.BUFFERING) return false;
    raiseVeil();
    player?.pauseVideo();
    return true;
  }, [raiseVeil]);
  const pauseForShield = useCallback(() => {
    if (pauseIfPlaying()) resumeAfterShieldRef.current = true;
  }, [pauseIfPlaying]);
  const pauseForDevtools = useCallback(() => {
    if (pauseIfPlaying()) flashHint(p.devtools);
  }, [pauseIfPlaying, flashHint, p.devtools]);
  const guard = useCaptureGuard(containerRef, pauseForShield, pauseForDevtools);

  useEffect(() => {
    callbacksRef.current = { onCompleted, onProgress, onUnavailable };
  }, [onCompleted, onProgress, onUnavailable]);

  const applyStatus = useCallback((status: LessonStatus) => {
    if (status.completed) {
      // Ko'rilgan darsda butun video bo'ylab erkin harakatlanish mumkin.
      const end = Math.max(durationRef.current, status.durationSec);
      tallyRef.current = { ...tallyRef.current, maxPosition: end };
      setMaxPosition(end);
      setCompleted(true);
    } else if (status.maxPosition > tallyRef.current.maxPosition) {
      tallyRef.current = { ...tallyRef.current, maxPosition: status.maxPosition };
      setMaxPosition(status.maxPosition);
    }
    callbacksRef.current.onProgress?.(status);
    if (status.completed && !completedRef.current) {
      completedRef.current = true;
      callbacksRef.current.onCompleted?.(status);
    }
  }, []);

  /**
   * Yuborilmagan ko'rilgan soniyalarni serverga yuboradi; xato bo'lsa keyingi safar qayta.
   * Sahifadan chiqishda `keepalive` fetch ishlatiladi — u sendBeacon kabi sahifa
   * yopilgandan keyin ham yetib boradi, lekin sendBeacon'dan farqli ravishda
   * sessiya sarlavhasini (Authorization) yubora oladi.
   */
  const report = useCallback(
    async (options?: { keepalive?: boolean; force?: boolean }) => {
      if (reportingRef.current && !options?.keepalive) return;
      const position = currentTimeOf(playerRef.current, lastTimeRef.current);
      const delta = tallyRef.current.pendingSeconds;
      if (!options?.force && delta < 0.5 && Math.abs(position - lastSentPositionRef.current) < 1) return;

      const end = durationRef.current || Number.MAX_SAFE_INTEGER;
      tallyRef.current = { ...tallyRef.current, pendingSeconds: 0 };
      reportingRef.current = true;
      try {
        const status = await reportLessonProgress(
          lessonId,
          {
            position: Math.min(position, end),
            maxPosition: Math.min(tallyRef.current.maxPosition, end),
            watchedDelta: delta,
          },
          { keepalive: options?.keepalive },
        );
        lastSentPositionRef.current = position;
        applyStatus(status);
      } catch {
        tallyRef.current = { ...tallyRef.current, pendingSeconds: tallyRef.current.pendingSeconds + delta };
      } finally {
        reportingRef.current = false;
      }
    },
    [lessonId, applyStatus],
  );

  /** Bitta o'lchov: ko'rilgan vaqtni hisoblaydi va ko'rilmagan qismga sakrashni qaytaradi. */
  const sample = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const now = currentTimeOf(player, lastTimeRef.current);
    const playing = player.getPlayerState() === PlayerState.PLAYING;
    const result = tick(tallyRef.current, lastTimeRef.current, now, playing);
    if (result.kind === "rewind") {
      player.seekTo(result.to, true);
      lastTimeRef.current = result.to;
      setCurrent(result.to);
      return;
    }
    tallyRef.current = result.tally;
    lastTimeRef.current = now;
    setCurrent(now);
    setMaxPosition(result.tally.maxPosition);

    const guard = veilRef.current;
    // Har qanday qopqoq (kirish yoki iOS'da iframe'ga to'g'ridan-to'g'ri teginish) —
    // ijro LEAD_IN_MS davom etgach ko'tariladi.
    if (guard.active && playing) {
      if (guard.since === null) guard.since = Date.now();
      else if (Date.now() - guard.since >= LEAD_IN_MS) liftVeil();
    }
  }, [liftVeil]);

  // Pleyerni yaratish: video manbai va progress serverdan, iframe — o'zimizniki.
  useEffect(() => {
    let cancelled = false;
    let player: EmbedPlayer | null = null;
    const host = frameHostRef.current;

    Promise.all([getLessonVideo(lessonId), getLessonStatus(lessonId), loadEmbedApi()])
      .then(([{ videoId }, status, api]) => {
        if (cancelled || !host) return;
        const start = status.position < status.durationSec - RESUME_END_MARGIN_SEC ? status.position : 0;
        completedRef.current = status.completed;
        durationRef.current = status.durationSec;
        tallyRef.current = {
          maxPosition: status.completed ? status.durationSec : status.maxPosition,
          pendingSeconds: 0,
        };
        lastTimeRef.current = start;
        lastSentPositionRef.current = status.position;
        setDuration(status.durationSec);
        setMaxPosition(tallyRef.current.maxPosition);
        setCurrent(start);
        setResumeAt(start);
        setCompleted(status.completed);
        callbacksRef.current.onProgress?.(status);

        const iframe = document.createElement("iframe");
        iframe.src = embedSrc(videoId, start);
        iframe.title = "";
        iframe.tabIndex = -1;
        iframe.allow = "autoplay; encrypted-media";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.setAttribute("sandbox", IFRAME_SANDBOX);
        iframe.setAttribute("aria-hidden", "true");
        host.replaceChildren(iframe);

        player = new api.Player(iframe, {
          events: {
            onReady: (event) => {
              if (cancelled) return;
              playerRef.current = event.target;
              const realDuration = event.target.getDuration();
              if (realDuration > 0) {
                durationRef.current = realDuration;
                setDuration(realDuration);
                if (status.completed) tallyRef.current = { ...tallyRef.current, maxPosition: realDuration };
              }
              setMuted(event.target.isMuted());
              setVolume(event.target.getVolume());
              setPhase("ready");
            },
            onStateChange: (event) => {
              if (!cancelled) stateHandlerRef.current(event.data);
            },
            onError: () => {
              if (!cancelled) setPhase("error");
            },
          },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404 && error.code === LESSON_NOT_FOUND_CODE) {
          setPhase("unavailable");
          callbacksRef.current.onUnavailable?.();
        } else {
          setPhase("error");
        }
      });

    return () => {
      cancelled = true;
      playerRef.current = null;
      try {
        player?.destroy();
      } catch {
        // pleyer allaqachon yo'q
      }
      host?.replaceChildren();
    };
  }, [lessonId, attempt]);

  // Iframe sarlavhasi — manba nomi emas, dars nomi.
  useEffect(() => {
    frameHostRef.current?.querySelector("iframe")?.setAttribute("title", title ?? t.lesson.videoLabel);
  }, [title, t.lesson.videoLabel, phase]);

  useEffect(() => {
    stateHandlerRef.current = (state: number) => {
      setPlayerState(state);
      if (state === PlayerState.PLAYING) {
        // Kirish qopqog'i sample() ichida, LEAD_IN_MS ijrodan keyin ko'tariladi.
        setHasStarted(true);
        setTapThrough(false);
        window.clearTimeout(tapTimerRef.current);
        // "Yana bosing" rejimida fokus iframe'ga o'tgan bo'ladi — klaviatura uchun qaytaramiz.
        if (document.activeElement instanceof HTMLIFrameElement) {
          containerRef.current?.focus({ preventScroll: true });
        }
      } else if (state === PlayerState.PAUSED) {
        void report();
      } else if (state === PlayerState.ENDED) {
        sample();
        void report({ force: true });
      }
    };
  }, [report, sample]);

  // O'lchov sikli va davriy hisobot.
  useEffect(() => {
    if (phase !== "ready") return;
    const sampler = window.setInterval(sample, TICK_MS);
    const reporter = window.setInterval(() => {
      if (playerRef.current?.getPlayerState() === PlayerState.PLAYING) void report();
    }, REPORT_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void report({ keepalive: true });
    };
    const onPageHide = () => void report({ keepalive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(sampler);
      window.clearInterval(reporter);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      // Sahifadan chiqish (kabinetga qaytish) — oxirgi holat saqlanadi.
      void report({ keepalive: true });
    };
  }, [phase, sample, report]);

  useEffect(
    () => () => {
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(hintTimerRef.current);
      window.clearTimeout(tapTimerRef.current);
    },
    [],
  );

  // To'liq ekran holati (Esc bilan chiqish ham shu yerda ushlanadi).
  useEffect(() => {
    const onChange = () => {
      const active = fullscreenElement() === containerRef.current;
      setFullscreen((mode) => (active ? "native" : mode === "native" ? "none" : mode));
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // Soxta to'liq ekran (iPhone Safari elementlarni to'liq ekranga chiqarmaydi):
  // sahifa aylantirilmaydi.
  useEffect(() => {
    if (fullscreen !== "pseudo") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  const isPlaying = playerState === PlayerState.PLAYING || playerState === PlayerState.BUFFERING;
  const ended = playerState === PlayerState.ENDED;
  const showCover = phase === "ready" && (!hasStarted || !isPlaying || veil);
  /** Ijro so'raldi, qopqoq hali turibdi — tugma o'rnida yuklanish belgisi. */
  const starting = veil && isPlaying;
  const showControls = phase === "ready" && hasStarted && (controlsVisible || !isPlaying || speedOpen);

  function revealControls() {
    setControlsVisible(true);
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }

  /** Ijro `target` nuqtadan — qopqoq ostidagi kirish bilan (qarang: LEAD_IN_MS). */
  function playWithLeadIn(target: number) {
    const player = playerRef.current;
    if (!player) return;
    restoreLeadIn();
    const unmute = !player.isMuted();
    if (unmute) player.mute();
    player.setPlaybackRate(LEAD_IN_RATE);
    veilRef.current = { active: true, since: null, leadIn: { rate, unmute } };
    setVeil(true);
    const from = Math.max(0, target - LEAD_IN_BACK_SEC);
    if (Math.abs(currentTimeOf(player, lastTimeRef.current) - from) > 0.3) {
      player.seekTo(from, true);
      lastTimeRef.current = from;
      setCurrent(from);
    }
    player.playVideo();
  }

  function togglePlay() {
    const player = playerRef.current;
    if (!player || phase !== "ready") return;
    const state = player.getPlayerState();
    if (state === PlayerState.PLAYING || state === PlayerState.BUFFERING) {
      raiseVeil();
      player.pauseVideo();
      return;
    }
    playWithLeadIn(state === PlayerState.ENDED ? 0 : currentTimeOf(player, lastTimeRef.current));
    revealControls();
    if (!hasStarted) {
      // Ba'zi brauzerlar (iOS Safari) boshqa domendagi pleyerni dasturiy ishga
      // tushirmaydi — unda markaziy tugma bosilishi iframe'ning o'ziga o'tkaziladi.
      window.clearTimeout(tapTimerRef.current);
      tapTimerRef.current = window.setTimeout(() => {
        const now = playerRef.current?.getPlayerState();
        if (now !== PlayerState.PLAYING && now !== PlayerState.BUFFERING) setTapThrough(true);
      }, TAP_THROUGH_DELAY_MS);
    }
  }

  /** Faqat orqaga (yoki ko'rilgan qism ichida) — eng uzoq ko'rilgan nuqtadan oshmaydi. */
  function seekTo(target: number) {
    const player = playerRef.current;
    if (!player || phase !== "ready") return;
    if (TEMP_ALLOW_FORWARD_SEEK && target > tallyRef.current.maxPosition) {
      // Oldinga sakrash qaytarib yuborilmasligi uchun chegara ham suriladi va darhol serverga yuboriladi.
      const end = durationRef.current || target;
      tallyRef.current = { ...tallyRef.current, maxPosition: Math.min(target, end) };
      setMaxPosition(tallyRef.current.maxPosition);
      window.setTimeout(() => void report({ force: true }), 300);
    }
    const allowed = clampSeek(target, tallyRef.current.maxPosition, durationRef.current);
    if (target > allowed + 0.5) flashHint(p.seekLocked);
    const state = player.getPlayerState();
    if (state === PlayerState.PLAYING || state === PlayerState.BUFFERING) {
      // O'ynab turganda seek ham tashqi belgini chaqiradi — kirish bilan.
      playWithLeadIn(allowed);
    } else {
      player.seekTo(allowed, true);
      lastTimeRef.current = allowed;
      setCurrent(allowed);
    }
    revealControls();
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    const lead = veilRef.current.leadIn;
    if (lead) {
      // Kirish paytida pleyer ataylab ovozsiz — tanlov kirish tugaganda qo'llanadi.
      lead.unmute = !lead.unmute;
      setMuted(!lead.unmute);
      return;
    }
    if (player.isMuted()) {
      player.unMute();
      if (player.getVolume() === 0) {
        player.setVolume(50);
        setVolume(50);
      }
      setMuted(false);
    } else {
      player.mute();
      setMuted(true);
    }
  }

  function changeVolume(value: number) {
    const player = playerRef.current;
    if (!player) return;
    player.setVolume(value);
    setVolume(value);
    const lead = veilRef.current.leadIn;
    if (lead) {
      lead.unmute = value > 0;
      setMuted(value === 0);
      return;
    }
    if (value > 0 && player.isMuted()) {
      player.unMute();
      setMuted(false);
    }
    if (value === 0 && !player.isMuted()) {
      player.mute();
      setMuted(true);
    }
  }

  function changeRate(value: PlaybackRate) {
    const lead = veilRef.current.leadIn;
    if (lead) lead.rate = value;
    else playerRef.current?.setPlaybackRate(value);
    setRate(value);
    setSpeedOpen(false);
  }

  function toggleFullscreen() {
    const element = containerRef.current as FullscreenElement | null;
    if (!element) return;
    if (fullscreen === "pseudo") {
      setFullscreen("none");
      return;
    }
    if (fullscreenElement()) {
      const doc = document as FullscreenDocument;
      if (document.exitFullscreen) void document.exitFullscreen().catch(() => undefined);
      else doc.webkitExitFullscreen?.();
      return;
    }
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(() => setFullscreen("pseudo"));
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else {
      setFullscreen("pseudo");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (phase !== "ready" || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      togglePlay();
    } else if (event.key === "ArrowLeft" && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault();
      seekTo(lastTimeRef.current - SEEK_BACK_SEC);
    } else if (event.key === "ArrowRight" && !(event.target instanceof HTMLInputElement)) {
      // Oldinga o'tkazish yo'q.
      event.preventDefault();
    } else if (event.code === "KeyF") {
      event.preventDefault();
      toggleFullscreen();
    } else if (event.key === "Escape") {
      if (speedOpen) setSpeedOpen(false);
      else if (fullscreen === "pseudo") setFullscreen("none");
    }
  }

  function handleSurfaceClick() {
    // Sensorli ekranda yashirin panel birinchi teginishda faqat ko'rsatiladi.
    if (pointerTypeRef.current !== "mouse" && isPlaying && !controlsVisible) {
      revealControls();
      return;
    }
    setSpeedOpen(false);
    togglePlay();
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerTypeRef.current = event.pointerType;
  }

  function resumeAfterShield() {
    guard.resume();
    if (resumeAfterShieldRef.current && playerRef.current) {
      resumeAfterShieldRef.current = false;
      playWithLeadIn(currentTimeOf(playerRef.current, lastTimeRef.current));
    }
    containerRef.current?.focus({ preventScroll: true });
  }

  function retry() {
    setPhase("loading");
    setHasStarted(false);
    setPlayerState(PlayerState.UNSTARTED);
    setTapThrough(false);
    setAttempt((value) => value + 1);
  }

  const coverLabel = tapThrough
    ? p.tapAgain
    : ended
      ? p.ended
      : !hasStarted
        ? resumeAt > RESUME_END_MARGIN_SEC
          ? p.resume(formatTime(resumeAt))
          : p.start
        : p.play;
  const isFullscreen = fullscreen !== "none";

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={title ? `${t.lesson.videoLabel}: ${title}` : t.lesson.videoLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onCopy={(event) => event.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") revealControls();
      }}
      className={cn(
        "group/player relative overflow-hidden bg-[#05070b] select-none print:invisible [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isFullscreen ? "flex items-center justify-center" : "rounded-2xl border border-white/10 shadow-card",
        fullscreen === "pseudo" && "fixed inset-0 z-[100] h-dvh w-screen pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        isFullscreen && !showControls && "cursor-none",
        className,
      )}
    >
      <div
        className={cn(
          "relative aspect-video overflow-hidden",
          isFullscreen ? "w-[min(100vw,calc(100dvh*16/9))]" : "w-full",
        )}
      >
        {/* Iframe: 300% balandlik, -100% siljish va 1.06x kattalashtirish — faqat
            video qismi ko'rinadi, pleyer paneli va burchak belgisi kesiladi. */}
        <div
          ref={frameHostRef}
          aria-hidden="true"
          className={cn(
            "absolute inset-x-0 top-[-100%] h-[300%] scale-[1.06] [&>iframe]:block [&>iframe]:size-full [&>iframe]:border-0",
            !tapThrough && "pointer-events-none [&>iframe]:pointer-events-none",
          )}
        />

        {/* Shaffof boshqaruv qatlami — iframe'ga bosish shu yerda to'xtaydi. */}
        <div
          aria-hidden="true"
          onClick={handleSurfaceClick}
          className={cn("absolute inset-0 z-10", tapThrough && "pointer-events-none")}
        />

        {phase === "ready" && hasStarted && <Watermark />}

        {guard.reason && (
          <div
            role="status"
            className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black px-6 text-center"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
              <ShieldAlertIcon className="size-5" />
            </span>
            <p className="max-w-sm text-xs font-semibold text-white/80 sm:text-sm">
              {guard.reason === "capture" ? p.protected : p.away}
            </p>
            {guard.canResume && (
              <button
                type="button"
                onClick={resumeAfterShield}
                className="glow-orange mt-1 inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-br from-brand to-brand-2 px-5 text-sm font-bold text-brand-foreground transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none active:scale-95"
              >
                <PlayIcon className="size-4" fill="currentColor" />
                {p.continue}
              </button>
            )}
          </div>
        )}

        {phase === "unavailable" && (
          <div
            role="status"
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 overflow-hidden bg-[#070a0f] px-6 text-center"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,94,0,0.18),transparent_60%),linear-gradient(180deg,#0b1020,#070a0f)]"
            />
            <span className="relative flex size-14 items-center justify-center rounded-full border border-brand/30 bg-brand/10 text-brand sm:size-16">
              <ClapperboardIcon className="size-6 sm:size-7" />
            </span>
            <div className="relative max-w-sm">
              <p className="font-display text-base font-bold text-white sm:text-lg">{p.notReadyTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60 sm:text-sm">{p.notReadyDesc}</p>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#070a0f]">
            <div className="skeleton-shimmer absolute inset-0 opacity-60" aria-hidden="true" />
            <Loader2Icon className="relative size-8 animate-spin text-brand" aria-hidden="true" />
            <p className="relative text-sm font-medium text-white/70" role="status">
              {p.loading}
            </p>
          </div>
        )}

        {phase === "error" && (
          <div
            role="alert"
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#070a0f] px-6 text-center"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-danger/15 text-danger">
              <TriangleAlertIcon className="size-5" />
            </span>
            <div className="max-w-sm">
              <p className="font-display text-base font-bold text-white">{p.errorTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/60 sm:text-sm">{p.errorDesc}</p>
            </div>
            <button
              type="button"
              onClick={retry}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <RotateCcwIcon className="size-4" />
              {p.retry}
            </button>
          </div>
        )}

        {showCover && (
          <Cover
            title={title}
            label={coverLabel}
            completed={completed}
            completedLabel={p.watched}
            playLabel={ended ? p.replay : p.play}
            tapThrough={tapThrough}
            ended={ended}
            starting={starting}
            compactLabel={hasStarted && !ended}
            onPlay={togglePlay}
          />
        )}

        {phase === "ready" && hasStarted && playerState === PlayerState.BUFFERING && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <Loader2Icon className="size-10 animate-spin text-white/80" aria-hidden="true" />
          </div>
        )}

        {hint && (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 top-3 z-50 flex justify-center px-4 sm:top-4"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur sm:text-sm">
              <LockIcon className="size-3.5 text-brand" />
              {hint}
            </span>
          </div>
        )}

        {phase === "ready" && hasStarted && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pt-10 pb-2 text-white transition-opacity duration-200 sm:px-4 sm:pb-3",
              showControls ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <Timeline current={current} duration={duration} maxPosition={maxPosition} label={p.timeline} />
            <div className="mt-1.5 flex items-center gap-0.5 sm:gap-1.5">
              <ControlButton label={isPlaying ? p.pause : p.play} onClick={togglePlay}>
                {isPlaying ? <PauseIcon className="size-5" fill="currentColor" /> : <PlayIcon className="size-5" fill="currentColor" />}
              </ControlButton>
              <ControlButton label={p.seekBack} onClick={() => seekTo(lastTimeRef.current - SEEK_BACK_SEC)}>
                <span className="relative flex items-center justify-center">
                  <Undo2Icon className="size-5" />
                  <span className="absolute -right-1.5 -bottom-1.5 font-mono text-[9px] font-bold">10</span>
                </span>
              </ControlButton>
              {TEMP_ALLOW_FORWARD_SEEK && (
                <>
                  <ControlButton label={p.skipForward} onClick={() => seekTo(lastTimeRef.current + SEEK_FORWARD_SEC)}>
                    <FastForwardIcon className="size-5" />
                  </ControlButton>
                  <ControlButton
                    label={p.skipToEnd}
                    onClick={() => seekTo(Math.max(0, durationRef.current - SKIP_TO_END_MARGIN_SEC))}
                  >
                    <SkipForwardIcon className="size-5" />
                  </ControlButton>
                </>
              )}
              <ControlButton label={muted ? p.unmute : p.mute} onClick={toggleMute}>
                {muted || volume === 0 ? <VolumeXIcon className="size-5" /> : <Volume2Icon className="size-5" />}
              </ControlButton>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={muted ? 0 : volume}
                aria-label={p.volume}
                onChange={(event) => changeVolume(Number(event.target.value))}
                className="hidden h-1 w-20 cursor-pointer accent-brand sm:pointer-fine:block"
              />
              <span className="ml-1 font-mono text-[11px] whitespace-nowrap text-white/85 tabular-nums sm:ml-2 sm:text-xs">
                {formatTime(current)} <span className="text-white/45">/ {formatTime(duration)}</span>
              </span>

              <div className="relative ml-auto">
                <button
                  type="button"
                  aria-label={p.speed}
                  aria-haspopup="menu"
                  aria-expanded={speedOpen}
                  onClick={() => setSpeedOpen((open) => !open)}
                  className="h-9 min-w-12 rounded-full px-2 font-mono text-xs font-semibold text-white/90 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  {rate}x
                </button>
                {speedOpen && (
                  <div
                    role="menu"
                    aria-label={p.speed}
                    className="absolute right-0 bottom-11 z-50 min-w-24 overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]/95 p-1 shadow-card backdrop-blur"
                  >
                    {PLAYBACK_RATES.map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={rate === value}
                        onClick={() => changeRate(value)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 font-mono text-xs transition-colors hover:bg-white/10",
                          rate === value ? "font-bold text-brand" : "text-white/85",
                        )}
                      >
                        {value}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <ControlButton label={isFullscreen ? p.exitFullscreen : p.fullscreen} onClick={toggleFullscreen}>
                {isFullscreen ? <MinimizeIcon className="size-5" /> : <MaximizeIcon className="size-5" />}
              </ControlButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Suzuvchi yarim shaffof suv belgisi: foydalanuvchi telefoni (yoki ismi) va sana.
 * Skrinshotni to'xtatmaydi, lekin sizib chiqqan surat egasini ko'rsatadi.
 * Bosishlarga xalaqit bermaydi (pointer-events: none).
 */
function Watermark() {
  const record = useRegistration();
  const [spot, setSpot] = useState({ x: 12, y: 14 });
  const who = record?.phone || [record?.firstName, record?.lastName].filter(Boolean).join(" ");
  const label = who ? `${who} · ${new Date().toLocaleDateString()}` : "";

  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      const wait = WATERMARK_MOVE_MIN_MS + Math.random() * (WATERMARK_MOVE_MAX_MS - WATERMARK_MOVE_MIN_MS);
      timer = window.setTimeout(() => {
        setSpot({ x: 5 + Math.random() * 55, y: 8 + Math.random() * 72 });
        schedule();
      }, wait);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  if (!label) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute z-[15] font-mono text-[10px] font-semibold whitespace-nowrap text-white/30 transition-[left,top] duration-1000 select-none sm:text-xs"
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
    >
      {label}
    </span>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none sm:size-10"
    >
      {children}
    </button>
  );
}

/** Pleyer ustidagi qopqoq: boshlanishdan oldin, pauzada va tugaganda. */
function Cover({
  title,
  label,
  completed,
  completedLabel,
  playLabel,
  tapThrough,
  ended,
  starting,
  compactLabel,
  onPlay,
}: {
  title?: string;
  label: string;
  completed: boolean;
  completedLabel: string;
  playLabel: string;
  tapThrough: boolean;
  ended: boolean;
  starting: boolean;
  /** Pastki panel ko'rinib turganda — kichik ekranda yozuv yashiriladi (ustma-ust tushmasin). */
  compactLabel: boolean;
  onPlay: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 overflow-hidden bg-[#070a0f]",
        // "Yana bosing" rejimi: faqat markaziy tugma ostidagi iframe ochiq qoladi.
        tapThrough && "pointer-events-none",
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,94,0,0.22),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(0,152,179,0.14),transparent_55%),linear-gradient(180deg,#0b1020,#070a0f)]"
      />
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:32px_32px]" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
        {title && (
          <p className="line-clamp-2 max-w-[80%] font-display text-sm font-bold text-white sm:text-lg md:text-xl">
            {title}
          </p>
        )}
        {completed && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success sm:text-xs">
            <CheckCircle2Icon className="size-3.5" />
            <span className="hidden sm:inline">{completedLabel}</span>
          </span>
        )}
      </div>

      {tapThrough && <TapThroughBlockers />}

      <button
        type="button"
        aria-label={playLabel}
        onClick={onPlay}
        className={cn(
          "glow-orange absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-brand-foreground transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none active:scale-95 sm:size-20",
          tapThrough && "pointer-events-none animate-pulse",
        )}
      >
        {starting ? (
          <Loader2Icon className="size-7 animate-spin sm:size-8" />
        ) : ended ? (
          <RotateCcwIcon className="size-7 sm:size-8" strokeWidth={2.5} />
        ) : (
          <PlayIcon className="ml-1 size-7 sm:size-8" fill="currentColor" />
        )}
      </button>

      <p
        className={cn(
          "absolute inset-x-0 top-[calc(50%+3rem)] px-4 text-center text-xs font-semibold text-white/80 sm:top-[calc(50%+3.75rem)] sm:text-sm",
          ended && "font-display text-base font-bold text-white sm:text-xl",
          compactLabel && "max-sm:sr-only",
        )}
      >
        {label}
      </p>
    </div>
  );
}

/**
 * "Yana bosing" rejimida markaziy tugmadan tashqari hamma joy to'siladi —
 * iframe'ga faqat play tugmasi ostidagi kichik maydon orqali teginish mumkin.
 */
function TapThroughBlockers() {
  const cells = [
    "col-start-1 row-start-1 col-span-3",
    "col-start-1 row-start-2",
    "col-start-3 row-start-2",
    "col-start-1 row-start-3 col-span-3",
  ];
  return (
    <div className="absolute inset-0 grid grid-cols-[1fr_5rem_1fr] grid-rows-[1fr_5rem_1fr]" aria-hidden="true">
      {cells.map((cell) => (
        <div key={cell} className={cn("pointer-events-auto", cell)} onContextMenu={(event) => event.preventDefault()} />
      ))}
    </div>
  );
}

/**
 * Vaqt chizig'i — FAQAT ko'rsatish uchun: bosib ham, sudrab ham bo'lmaydi
 * (oldinga o'tkazish umuman yo'q; orqaga — "10 soniya orqaga" va ← orqali).
 */
function Timeline({
  current,
  duration,
  maxPosition,
  label,
}: {
  current: number;
  duration: number;
  maxPosition: number;
  label: string;
}) {
  const percent = (value: number) => (duration > 0 ? Math.min(100, (value / duration) * 100) : 0);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(current)}
      aria-valuetext={`${formatTime(current)} / ${formatTime(duration)}`}
      className="pointer-events-none relative flex h-4 items-center"
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/15">
        <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${percent(maxPosition)}%` }} />
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand to-brand-2"
          style={{ width: `${percent(current)}%` }}
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgba(255,94,0,0.45)]"
        style={{ left: `${percent(current)}%` }}
      />
    </div>
  );
}
