// Fayl va rasmlar uchun storage abstraksiyasi.
//   STORAGE_DRIVER=local — dev: lokal papka (STORAGE_LOCAL_DIR, standart backend/.storage);
//   STORAGE_DRIVER=s3    — production: S3-mos xotira (Cloudflare R2); brauzer to'g'ridan-to'g'ri
//                          presigned URL orqali yuklaydi (Vercel so'rov hajmi chegarasidan oshmaslik uchun);
//   STORAGE_DRIVER=db    — R2 sozlanmaguncha Vercel'da: Postgres (StorageObject), har bir fayl ≤ 4 MB.
// Vercel'da lokal diskka yozilmaydi: driver berilmagan bo'lsa, Vercel'da "db", lokalda "local".
//
// TODO(R2): Cloudflare R2 bucket yaratib, Vercel'ga STORAGE_DRIVER=s3, S3_ENDPOINT, S3_BUCKET,
// S3_ACCESS_KEY, S3_SECRET_KEY, S3_PUBLIC_URL qo'shish; bucket CORS'ida admin sayt domeni uchun PUT ruxsati.

import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { dirname, join, normalize, resolve } from "path";
import type { PrismaService } from "../prisma/prisma.service";

export type StorageDriverName = "local" | "s3" | "db";

/** Brauzer fayli qanday yuklashi kerak. */
export type UploadTarget =
  | { method: "PUT"; url: string; headers: Record<string, string> }
  | { method: "POST"; url: null };

export interface StorageDriver {
  readonly name: StorageDriverName;
  /** Bitta faylning eng katta hajmi (bayt) — yuklash shu usul bilan. */
  readonly maxUploadBytes: number;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Faqat s3: brauzer uchun presigned PUT manzili. */
  presignPut?(key: string, contentType: string): Promise<string>;
}

export const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024;
/** Vercel funksiyasi so'rov tanasi 4.5 MB — multipart sarlavhalari uchun zaxira bilan. */
export const VERCEL_BODY_LIMIT_BYTES = 4 * 1024 * 1024;

export function storageDriverName(): StorageDriverName {
  const raw = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (raw === "s3" || raw === "local" || raw === "db") return raw;
  return process.env.VERCEL ? "db" : "local";
}

/** Kalit faqat xavfsiz belgilardan: papkadan tashqariga chiqib bo'lmaydi. */
export function safeKey(key: string): string {
  const clean = key.replace(/\\/g, "/").replace(/[^A-Za-z0-9._/-]/g, "_");
  if (!clean || clean.startsWith("/") || clean.split("/").some((p) => p === ".." || p === "")) throw new Error(`Noto'g'ri storage kaliti: ${key}`);
  return clean;
}

export class LocalStorage implements StorageDriver {
  readonly name = "local" as const;
  readonly maxUploadBytes = MAX_IMPORT_FILE_BYTES;
  private readonly root: string;

  constructor(root = process.env.STORAGE_LOCAL_DIR?.trim() || join(process.cwd(), ".storage")) {
    if (process.env.VERCEL) throw new Error("Vercel'da lokal diskka yozilmaydi — STORAGE_DRIVER=s3 (R2) yoki db");
    this.root = resolve(root);
  }

  private path(key: string): string {
    const full = normalize(join(this.root, safeKey(key)));
    if (!full.startsWith(this.root)) throw new Error("Storage kaliti papkadan tashqarida");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}

export class DbStorage implements StorageDriver {
  readonly name = "db" as const;
  readonly maxUploadBytes = VERCEL_BODY_LIMIT_BYTES;

  constructor(private readonly prisma: PrismaService) {}

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const k = safeKey(key);
    const bytes = new Uint8Array(data);
    await this.prisma.storageObject.upsert({
      where: { key: k },
      create: { key: k, data: bytes, contentType, size: data.length },
      update: { data: bytes, contentType, size: data.length },
    });
  }

  async get(key: string): Promise<Buffer> {
    const row = await this.prisma.storageObject.findUnique({ where: { key: safeKey(key) } });
    if (!row) throw new Error(`Storage'da yo'q: ${key}`);
    return Buffer.from(row.data);
  }

  async delete(key: string): Promise<void> {
    await this.prisma.storageObject.deleteMany({ where: { key: safeKey(key) } });
  }
}

export class S3Storage implements StorageDriver {
  readonly name = "s3" as const;
  readonly maxUploadBytes = MAX_IMPORT_FILE_BYTES;
  private clientPromise: Promise<import("@aws-sdk/client-s3").S3Client> | null = null;
  private readonly bucket: string;

  constructor() {
    const missing = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"].filter((k) => !process.env[k]?.trim());
    if (missing.length) throw new Error(`S3/R2 sozlanmagan: ${missing.join(", ")} yo'q`);
    this.bucket = process.env.S3_BUCKET!.trim();
  }

  private client() {
    this.clientPromise ??= import("@aws-sdk/client-s3").then(
      ({ S3Client }) =>
        new S3Client({
          region: process.env.S3_REGION?.trim() || "auto",
          endpoint: process.env.S3_ENDPOINT!.trim(),
          credentials: { accessKeyId: process.env.S3_ACCESS_KEY!.trim(), secretAccessKey: process.env.S3_SECRET_KEY!.trim() },
          forcePathStyle: true,
        }),
    );
    return this.clientPromise;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.client()).send(new PutObjectCommand({ Bucket: this.bucket, Key: safeKey(key), Body: data, ContentType: contentType }));
  }

  async get(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await (await this.client()).send(new GetObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
    if (!res.Body) throw new Error(`Storage'da yo'q: ${key}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.client()).send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
  }

  async presignPut(key: string, contentType: string): Promise<string> {
    const [{ PutObjectCommand }, { getSignedUrl }] = await Promise.all([import("@aws-sdk/client-s3"), import("@aws-sdk/s3-request-presigner")]);
    return getSignedUrl(await this.client(), new PutObjectCommand({ Bucket: this.bucket, Key: safeKey(key), ContentType: contentType }), { expiresIn: 15 * 60 });
  }
}

export function createStorage(prisma: PrismaService, name: StorageDriverName = storageDriverName()): StorageDriver {
  if (name === "s3") return new S3Storage();
  if (name === "db") return new DbStorage(prisma);
  return new LocalStorage();
}
