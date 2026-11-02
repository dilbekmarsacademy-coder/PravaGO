// .docx: word/document.xml run (w:r) darajasida — matn, rasmlar HUJJATDAGI TARTIBDA va
// har bir belgining formatlashi: qalin (w:b), rang (w:color, qora/avto emas), highlight
// (w:highlight) va fon (w:shd fill). Jadval kataklaridagi paragraflar ham tartibda o'qiladi.

import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { F_BOLD, F_COLOR, F_HIGHLIGHT, type Line, type ReadResult } from "./types";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const V_NS = "urn:schemas-microsoft-com:vml";

type El = Element;

function children(el: El): El[] {
  const out: El[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) out.push(n as El);
  return out;
}

function local(el: El): string {
  return el.localName ?? el.nodeName.replace(/^.*:/, "");
}

function child(el: El | null | undefined, name: string): El | null {
  if (!el) return null;
  return children(el).find((c) => local(c) === name && c.namespaceURI === W_NS) ?? null;
}

function wAttr(el: El | null, name: string): string | null {
  if (!el) return null;
  return el.getAttributeNS(W_NS, name) || el.getAttribute(`w:${name}`) || null;
}

/** <w:b/> → true, <w:b w:val="0|false|off|none"/> → false, yo'q → undefined. */
function toggleValue(el: El | null): boolean | undefined {
  if (!el) return undefined;
  const val = wAttr(el, "val");
  if (val === null) return true;
  return !["0", "false", "off", "none"].includes(val.toLowerCase());
}

/** Qora, oq va "auto" — rang belgisi emas. */
function meaningfulColor(hex: string | null): boolean {
  if (!hex) return false;
  const v = hex.toLowerCase();
  if (v === "auto" || v === "000000" || v === "ffffff") return false;
  const n = parseInt(v, 16);
  if (!Number.isFinite(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Deyarli qora/kulrang — oddiy matn.
  return Math.max(r, g, b) - Math.min(r, g, b) > 40;
}

interface StyleInfo {
  basedOn: string | null;
  rPr: El | null;
}

class Styles {
  private readonly styles = new Map<string, StyleInfo>();
  private defaultParagraphStyle: string | null = null;
  private docDefaultRPr: El | null = null;

  constructor(xml: string | null) {
    if (!xml) return;
    const root = new DOMParser().parseFromString(xml, "text/xml").documentElement as unknown as El;
    this.docDefaultRPr = child(child(child(root, "docDefaults"), "rPrDefault"), "rPr");
    for (const style of children(root).filter((c) => local(c) === "style")) {
      const id = wAttr(style, "styleId");
      if (!id) continue;
      this.styles.set(id, { basedOn: wAttr(child(style, "basedOn"), "val"), rPr: child(style, "rPr") });
      if (wAttr(style, "type") === "paragraph" && ["1", "true"].includes(wAttr(style, "default") ?? "")) this.defaultParagraphStyle = id;
    }
  }

  /** Uslub zanjiri bo'yicha birinchi aniqlangan qiymat. */
  private chain<T>(id: string | null, read: (rPr: El | null) => T | undefined): T | undefined {
    const seen = new Set<string>();
    while (id && !seen.has(id)) {
      seen.add(id);
      const style = this.styles.get(id);
      if (!style) return undefined;
      const value = read(style.rPr);
      if (value !== undefined) return value;
      id = style.basedOn;
    }
    return undefined;
  }

  resolve<T>(rPr: El | null, pStyle: string | null, read: (rPr: El | null) => T | undefined): T | undefined {
    return (
      read(rPr) ??
      this.chain(wAttr(child(rPr, "rStyle"), "val"), read) ??
      this.chain(pStyle ?? this.defaultParagraphStyle, read) ??
      read(this.docDefaultRPr)
    );
  }

  isHeading(pStyle: string | null): boolean {
    return Boolean(pStyle && /heading|title|sarlavha|заголов/i.test(pStyle));
  }
}

const readBold = (rPr: El | null) => toggleValue(child(rPr, "b"));
const readColor = (rPr: El | null) => {
  const c = child(rPr, "color");
  return c ? meaningfulColor(wAttr(c, "val")) : undefined;
};
const readHighlight = (rPr: El | null) => {
  const hl = child(rPr, "highlight");
  if (hl) return (wAttr(hl, "val") ?? "none") !== "none";
  const shd = child(rPr, "shd");
  if (shd) {
    const fill = (wAttr(shd, "fill") ?? "auto").toLowerCase();
    return fill !== "auto" && fill !== "ffffff" && fill !== "000000";
  }
  return undefined;
};

function hasAncestor(el: El, names: string[]): boolean {
  for (let p = el.parentNode as El | null; p && p.nodeType === 1; p = p.parentNode as El | null) {
    if (names.includes(local(p))) return true;
  }
  return false;
}

function collectRuns(p: El, out: El[] = []): El[] {
  for (const c of children(p)) {
    const name = local(c);
    if (name === "r" && c.namespaceURI === W_NS) out.push(c);
    else if (["del", "moveFrom", "pPr", "Fallback"].includes(name)) continue;
    else if (name === "p") continue;
    else collectRuns(c, out);
  }
  return out;
}

function imageIds(el: El): string[] {
  const ids: string[] = [];
  const walk = (node: El) => {
    const name = local(node);
    if (name === "Fallback") return;
    if (name === "blip" && node.namespaceURI === A_NS) {
      const id = node.getAttributeNS(R_NS, "embed") || node.getAttribute("r:embed");
      if (id) ids.push(id);
    }
    if (name === "imagedata" && node.namespaceURI === V_NS) {
      const id = node.getAttributeNS(R_NS, "id") || node.getAttribute("r:id");
      if (id) ids.push(id);
    }
    for (const c of children(node)) walk(c);
  };
  walk(el);
  return ids;
}

export async function readDocx(buffer: Buffer): Promise<ReadResult> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("word/document.xml topilmadi — fayl .docx emas yoki buzilgan");
  const styles = new Styles((await zip.file("word/styles.xml")?.async("string")) ?? null);

  const relsXml = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
  const rels = new Map<string, string>();
  const relEls = new DOMParser().parseFromString(relsXml || "<Relationships/>", "text/xml").getElementsByTagName("Relationship");
  for (let i = 0; i < relEls.length; i++) rels.set(relEls[i].getAttribute("Id") ?? "", relEls[i].getAttribute("Target") ?? "");

  const doc = new DOMParser().parseFromString(documentXml, "text/xml");
  const pEls = doc.getElementsByTagNameNS(W_NS, "p");
  const lines: Line[] = [];
  for (let i = 0; i < pEls.length; i++) {
    const p = pEls[i] as unknown as El;
    if (hasAncestor(p, ["txbxContent", "Fallback"])) continue;
    const pPr = child(p, "pPr");
    const pStyle = wAttr(child(pPr, "pStyle"), "val");
    // Paragraf foni (w:pPr/w:shd) — butun qator highlight.
    const pShd = child(pPr, "shd");
    const pFill = pShd ? (wAttr(pShd, "fill") ?? "auto").toLowerCase() : "auto";
    const pHighlighted = pFill !== "auto" && pFill !== "ffffff" && pFill !== "000000";
    let text = "";
    const flags: number[] = [];
    const images: Line["images"] = [];
    for (const r of collectRuns(p)) {
      const rPr = child(r, "rPr");
      const flag =
        (styles.resolve(rPr, pStyle, readBold) ? F_BOLD : 0) |
        (styles.resolve(rPr, pStyle, readColor) ? F_COLOR : 0) |
        (styles.resolve(rPr, pStyle, readHighlight) || pHighlighted ? F_HIGHLIGHT : 0);
      const add = (s: string) => {
        text += s;
        for (let k = 0; k < s.length; k++) flags.push(flag);
      };
      for (const c of children(r)) {
        const name = local(c);
        if (name === "t") add(c.textContent ?? "");
        else if (name === "tab" || name === "br" || name === "cr") add(" ");
        else if (name === "noBreakHyphen") add("-");
        else if (name === "drawing" || name === "pict" || name === "AlternateContent" || name === "object") {
          for (const rid of imageIds(c)) images.push({ pos: text.length, ref: rid });
        }
      }
    }
    if (text.trim() || images.length) lines.push({ text, flags, images, heading: styles.isHeading(pStyle) });
  }

  return {
    lines,
    async readImage(ref) {
      const target = rels.get(ref);
      if (!target) return null;
      const path = target.startsWith("/") ? target.slice(1) : `word/${target}`.replace(/\/\.\.\//g, "/");
      const file = zip.file(path);
      if (!file) return null;
      return { ref, data: await file.async("nodebuffer"), ext: (path.split(".").pop() ?? "").toLowerCase() };
    },
  };
}
