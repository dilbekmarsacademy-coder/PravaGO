"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Minimal ambient shape of the YouTube IFrame Player API — just enough
 * to instantiate a player and listen for the "ended" state.
 */
interface YTPlayer {
  destroy: () => void;
}

interface YTPlayerEvent {
  data: number;
}

interface YTNamespace {
  Player: new (
    elementId: string,
    options: {
      videoId: string;
      playerVars: Record<string, number>;
      events: {
        onStateChange: (event: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_API_SRC = "https://www.youtube.com/iframe_api";

interface HiddenVideoPlayerProps {
  videoId: string;
  onEnded: () => void;
}

/**
 * Wraps the YouTube player in a custom-styled retro frame so no YouTube
 * branding, links, or source references are ever shown in the UI.
 * NOTE: true source-hiding (so the raw player URL never reaches the client
 * at all) requires routing playback through a backend proxy — planned for a
 * later stage (TZ, backend bosqichi). This component only applies the
 * frontend-side measures that are actually possible today.
 */
export default function HiddenVideoPlayer({
  videoId,
  onEnded,
}: HiddenVideoPlayerProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const mountId = `retro-player-${rawId}`;
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function createPlayer() {
      if (cancelled || !window.YT) return;
      playerRef.current = new window.YT.Player(mountId, {
        videoId,
        playerVars: {
          modestbranding: 1,
          rel: 0,
          controls: 1,
          showinfo: 0,
        },
        events: {
          onStateChange: (event) => {
            if (window.YT && event.data === window.YT.PlayerState.ENDED) {
              onEnded();
            }
          },
        },
      });
      setReady(true);
    }

    if (window.YT) {
      createPlayer();
    } else {
      const existingScript = document.querySelector(
        `script[src="${YT_API_SRC}"]`,
      );
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = YT_API_SRC;
        document.body.appendChild(script);
      }
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        createPlayer();
      };
    }

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className="w-full">
      <div
        onContextMenu={(e) => e.preventDefault()}
        className="relative aspect-video w-full overflow-hidden border-[3px] border-asphalt bg-asphalt-lighter shadow-[6px_6px_0_0_#C6402C]"
      >
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-asphalt-lighter">
            <span className="font-mono text-xs tracking-widest text-paper/60 uppercase">
              Video yuklanmoqda&hellip;
            </span>
          </div>
        )}
        <div id={mountId} className="h-full w-full" />
        {/* Corner tab masks the default player chrome branding area */}
        <div className="pointer-events-none absolute top-0 right-0 border-b-[3px] border-l-[3px] border-asphalt bg-signal-yellow px-3 py-1 font-display text-xs tracking-widest text-asphalt uppercase">
          01-dars
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[11px] leading-relaxed text-paper/50 uppercase">
        Video manbasi ushbu bosqichda ataylab ko&apos;rsatilmaydi.
      </p>
    </div>
  );
}
