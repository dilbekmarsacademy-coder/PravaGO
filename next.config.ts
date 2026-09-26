import type { NextConfig } from "next";

type RemotePattern = { protocol: "http" | "https"; hostname: string; port?: string; pathname: string };

// Savol rasmlari backend'dan keladi — next/image uchun ruxsat etilgan manbalar.
const imageHosts: RemotePattern[] = [
  { protocol: "https", hostname: "pravatayyor-backend.vercel.app", pathname: "/images/**" },
  { protocol: "http", hostname: "localhost", port: "3001", pathname: "/images/**" },
];

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (apiUrl) {
  try {
    const { protocol, hostname, port } = new URL(apiUrl);
    imageHosts.push({ protocol: protocol === "http:" ? "http" : "https", hostname, port, pathname: "/images/**" });
  } catch {
    // Noto'g'ri URL bo'lsa, faqat yuqoridagi manbalar ishlatiladi.
  }
}

const nextConfig: NextConfig = {
  agentRules: false,
  images: {
    remotePatterns: imageHosts,
    // Lokal ishlab chiqishda backend localhost'da — faqat dev'da ruxsat.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
};

export default nextConfig;
