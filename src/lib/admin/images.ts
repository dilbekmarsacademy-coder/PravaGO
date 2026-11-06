"use client";

// Admin rasm yuklash: production'da backend funksiyasi ~1.2 MB dan katta
// so'rovni qabul qilmaydi (Vercel 503 "deployment unavailable") — kattaroq rasm
// brauzerning o'zida kichraytiriladi (uzun tomoni 2048 px, WebP/JPEG). Savol
// rasmi saytda 1600 px gacha ko'rsatiladi, sifat yetarli. Server baribir
// 10 MB va kontent turini tekshiradi.

import { adminFetch } from "./api";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 900 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];

export interface ImageJob {
  id: string;
  type: "auto" | "manual" | "original" | "remove-bg";
  status: "queued" | "running" | "done" | "failed";
  inputAssetId: string;
  outputAssetId: string | null;
  result: { steps?: string[]; detections?: { x: number; y: number; w: number; h: number; label: string }[]; aiConfigured?: boolean; aiError?: string };
  error: string | null;
}

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function validateFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return "Faqat rasm (JPEG, PNG, WebP, HEIC) yuklash mumkin";
  if (file.size > MAX_FILE_BYTES) return "Rasm 10 MB dan katta";
  return null;
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function shrink(file: File): Promise<Blob> {
  if (file.size <= MAX_UPLOAD_BYTES) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Masalan HEIC — Chrome o'qiy olmaydi.
    throw new Error("Bu rasmni brauzer o'qiy olmadi — JPEG yoki PNG formatida saqlab, qayta yuklang");
  }
  for (const side of [2048, 1600, 1280]) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.92, 0.85, 0.75]) {
      // WebP odatda kichikroq; brauzer qo'llamasa toBlob PNG qaytaradi — unda JPEG.
      const webp = await encode(canvas, "image/webp", quality);
      const blob = webp?.type === "image/webp" ? webp : await encode(canvas, "image/jpeg", quality);
      if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
    }
  }
  throw new Error("Rasmni yuklash uchun kichraytirib bo'lmadi");
}

export async function uploadImage(file: File): Promise<{ asset: { id: string; width: number; height: number }; job: ImageJob }> {
  const blob = await shrink(file);
  const form = new FormData();
  form.append("file", blob, blob === file ? file.name : blob.type === "image/webp" ? "image.webp" : "image.jpg");
  return adminFetch("images", { method: "POST", body: form });
}

export function startJob(inputAssetId: string, type: ImageJob["type"], params: { crop?: NormRect; erase?: NormRect[]; trim?: boolean } = {}): Promise<ImageJob> {
  return adminFetch("images/jobs", { json: { inputAssetId, type, ...params } });
}

export async function waitForJob(id: string, onUpdate?: (job: ImageJob) => void): Promise<ImageJob> {
  for (let i = 0; i < 240; i++) {
    const job = await adminFetch<ImageJob>(`images/jobs/${id}`);
    onUpdate?.(job);
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, i < 10 ? 700 : 1500));
  }
  throw new Error("Ishlov juda uzoq davom etdi");
}

export function acceptImage(assetId: string): Promise<{ assetId: string; url: string; width: number; height: number }> {
  return adminFetch("images/accept", { json: { assetId } });
}
