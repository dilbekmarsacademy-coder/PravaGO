// Fayl → (zip bo'lsa) ichidagi fayllar yoki o'qilgan qatorlar + tuzilma. AI'siz.

import JSZip from "jszip";
import { detectScript, type Script } from "../normalize";
import { readDocx } from "./docx";
import { readHtml } from "./html";
import { readPdf } from "./pdf";
import { headingFromFileName, parseStructure, type ExtractedStructure } from "./structure";
import { readTxt } from "./txt";
import type { RawImage, ReadResult } from "./types";

export type FileType = "docx" | "html" | "pdf" | "txt" | "zip" | "unknown";

export const SUPPORTED_EXTENSIONS = [".docx", ".pdf", ".html", ".htm", ".txt", ".zip"];

export function fileType(name: string): FileType {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "docx") return "docx";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "txt";
  if (ext === "zip") return "zip";
  return "unknown";
}

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/** .zip ichidagi fayllar (papkalar va tizim fayllarisiz). Rasmlar HTML uchun alohida qaytariladi. */
export async function unzip(buffer: Buffer): Promise<{ files: ZipEntry[]; assets: Map<string, Buffer> }> {
  const zip = await JSZip.loadAsync(buffer);
  const files: ZipEntry[] = [];
  const assets = new Map<string, Buffer>();
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || /(^|\/)(__MACOSX|\.DS_Store|~\$)/.test(entry.name)) continue;
    const data = await entry.async("nodebuffer");
    if (fileType(entry.name) !== "unknown") files.push({ name: entry.name, data });
    else if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(entry.name)) assets.set(entry.name, data);
  }
  return { files, assets };
}

export interface ExtractResult {
  read: ReadResult;
  structure: ExtractedStructure;
  /** AI tasnifi uchun matn boshi. */
  preview: string;
  script: Script;
  title: string | null;
}

export async function extractFile(name: string, data: Buffer, opts: { day?: number | null; topicNumber?: number | null; assets?: Map<string, Buffer> } = {}): Promise<ExtractResult> {
  const type = fileType(name);
  let read: ReadResult;
  if (type === "docx") read = await readDocx(data);
  else if (type === "html") {
    const assets = opts.assets;
    read = readHtml(data.toString("utf8"), async (ref): Promise<RawImage | null> => {
      if (!assets) return null;
      const clean = decodeURIComponent(ref.replace(/^\.?\//, ""));
      const hit = [...assets.entries()].find(([k]) => k === clean || k.endsWith(`/${clean}`) || k.endsWith(clean));
      return hit ? { ref, data: hit[1], ext: (hit[0].split(".").pop() ?? "png").toLowerCase() } : null;
    });
  } else if (type === "pdf") read = await readPdf(data);
  else if (type === "txt") read = readTxt(data.toString("utf8"));
  else throw new Error(`Qo'llab-quvvatlanmaydigan fayl turi: ${name}`);

  const fromName = headingFromFileName(name);
  const structure = parseStructure(
    read.lines,
    { day: opts.day ?? fromName.day, topicNumber: opts.topicNumber ?? fromName.topicNumber, title: read.title ?? null },
    read.cards,
  );
  const preview = read.lines
    .map((l) => l.text)
    .join("\n")
    .slice(0, 3500);
  return { read, structure, preview, script: detectScript(preview), title: read.title ?? structure.headings[0]?.title ?? null };
}
