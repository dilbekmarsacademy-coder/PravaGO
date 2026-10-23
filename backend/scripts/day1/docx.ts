// DOCX test faylini word/document.xml ning run (w:r) darajasida o'qiydi.
// To'g'ri javob faqat formatlash (qalin shrift) bilan belgilangani uchun
// pandoc/oddiy matn ishlatilmaydi.

import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

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

interface StyleInfo {
  basedOn: string | null;
  bold: boolean | undefined;
}

class Styles {
  private readonly styles = new Map<string, StyleInfo>();
  private defaultParagraphStyle: string | null = null;
  private docDefaultBold: boolean | undefined;

  constructor(xml: string | null) {
    if (!xml) return;
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const root = doc.documentElement as unknown as El;
    const docDefaults = child(root, "docDefaults");
    this.docDefaultBold = toggleValue(child(child(child(docDefaults, "rPrDefault"), "rPr"), "b"));
    for (const style of children(root).filter((c) => local(c) === "style")) {
      const id = wAttr(style, "styleId");
      if (!id) continue;
      const basedOn = wAttr(child(style, "basedOn"), "val");
      this.styles.set(id, { basedOn, bold: toggleValue(child(child(style, "rPr"), "b")) });
      if (wAttr(style, "type") === "paragraph" && ["1", "true"].includes(wAttr(style, "default") ?? "")) {
        this.defaultParagraphStyle = id;
      }
    }
  }

  private chainBold(id: string | null): boolean | undefined {
    const seen = new Set<string>();
    while (id && !seen.has(id)) {
      seen.add(id);
      const style = this.styles.get(id);
      if (!style) return undefined;
      if (style.bold !== undefined) return style.bold;
      id = style.basedOn;
    }
    return undefined;
  }

  /** Run'ning haqiqiy qalinligi: run → belgi uslubi → paragraf uslubi → hujjat standarti. */
  runBold(rPr: El | null, pStyle: string | null): boolean {
    return (
      toggleValue(child(rPr, "b")) ??
      this.chainBold(wAttr(child(rPr, "rStyle"), "val")) ??
      this.chainBold(pStyle ?? this.defaultParagraphStyle) ??
      this.docDefaultBold ??
      false
    );
  }
}

/** Paragraf: matn, har bir belgining qalinligi va matn ichidagi rasmlar. */
export interface DocxParagraph {
  text: string;
  bold: boolean[];
  /** `pos` — rasm matnning qaysi indeksida turibdi. */
  images: { pos: number; rid: string }[];
}

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
    if (name === "Fallback") return; // mc:AlternateContent — faqat Choice
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

export interface DocxFile {
  paragraphs: DocxParagraph[];
  /** Rasm (rId) → baytlar va kengaytma. */
  readImage(rid: string): Promise<{ data: Buffer; ext: string } | null>;
}

export async function readDocx(buffer: Buffer): Promise<DocxFile> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("word/document.xml topilmadi");
  const styles = new Styles((await zip.file("word/styles.xml")?.async("string")) ?? null);

  const relsXml = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
  const rels = new Map<string, string>();
  const relsDoc = new DOMParser().parseFromString(relsXml || "<Relationships/>", "text/xml");
  const relEls = relsDoc.getElementsByTagName("Relationship");
  for (let i = 0; i < relEls.length; i++) {
    const rel = relEls[i];
    rels.set(rel.getAttribute("Id") ?? "", rel.getAttribute("Target") ?? "");
  }

  const doc = new DOMParser().parseFromString(documentXml, "text/xml");
  const pEls = doc.getElementsByTagNameNS(W_NS, "p");
  const paragraphs: DocxParagraph[] = [];

  for (let i = 0; i < pEls.length; i++) {
    const p = pEls[i] as unknown as El;
    // Matn qutilaridagi (textbox) va zaxira (Fallback) paragraflar — takror.
    if (hasAncestor(p, ["txbxContent", "Fallback"])) continue;
    const pStyle = wAttr(child(child(p, "pPr"), "pStyle"), "val");
    let text = "";
    const bold: boolean[] = [];
    const images: DocxParagraph["images"] = [];
    for (const r of collectRuns(p)) {
      const rPr = child(r, "rPr");
      const isBold = styles.runBold(rPr, pStyle);
      const add = (s: string) => {
        text += s;
        for (let k = 0; k < s.length; k++) bold.push(isBold);
      };
      for (const c of children(r)) {
        const name = local(c);
        if (name === "t") add(c.textContent ?? "");
        else if (name === "tab" || name === "br" || name === "cr") add(" ");
        else if (name === "noBreakHyphen") add("-");
        else if (name === "drawing" || name === "pict" || name === "AlternateContent" || name === "object") {
          for (const rid of imageIds(c)) images.push({ pos: text.length, rid });
        }
      }
    }
    paragraphs.push({ text, bold, images });
  }

  return {
    paragraphs,
    async readImage(rid) {
      const target = rels.get(rid);
      if (!target) return null;
      const path = target.startsWith("/") ? target.slice(1) : `word/${target}`;
      const file = zip.file(path);
      if (!file) return null;
      return { data: await file.async("nodebuffer"), ext: (path.split(".").pop() ?? "").toLowerCase() };
    },
  };
}
