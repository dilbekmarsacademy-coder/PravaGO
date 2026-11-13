"use client";

// Video hozir o'ynayaptimi — haftalik yangilanishda sahifani jonli yangilash
// (ResetWatcher) videoni to'satdan to'xtatmasligi uchun. Pleyer holatni yozadi,
// kuzatuvchi esa video to'xtagach (pauza/tugash/sahifadan chiqish) yangilaydi.

let playing = false;
const listeners = new Set<(playing: boolean) => void>();

export function setVideoPlaying(value: boolean): void {
  if (playing === value) return;
  playing = value;
  for (const listener of listeners) listener(value);
}

export function isVideoPlaying(): boolean {
  return playing;
}

export function onVideoPlayingChange(listener: (playing: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
