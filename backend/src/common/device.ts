// User-Agent'dan qurilma turi va qisqa nomi (shaxsiy ma'lumotsiz).

export type DeviceType = "mobile" | "tablet" | "desktop";

export function deviceType(ua: string | null | undefined): DeviceType {
  const s = ua ?? "";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini/i.test(s)) return "mobile";
  return "desktop";
}

export function deviceLabel(ua: string | null | undefined): string {
  const s = ua ?? "";
  const os = /iPhone/.test(s)
    ? "iPhone"
    : /iPad/.test(s)
      ? "iPad"
      : /Android/.test(s)
        ? "Android"
        : /Windows/.test(s)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(s)
            ? "Mac"
            : /Linux/.test(s)
              ? "Linux"
              : "Noma'lum";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /YaBrowser/.test(s)
        ? "Yandex"
        : /Chrome\//.test(s)
          ? "Chrome"
          : /Firefox\//.test(s)
            ? "Firefox"
            : /Safari\//.test(s)
              ? "Safari"
              : "";
  return browser ? `${os} · ${browser}` : os;
}
