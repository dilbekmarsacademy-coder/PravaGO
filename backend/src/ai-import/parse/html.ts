// .html: cheerio bilan — bloklar (p, li, h1–h6, td, div matni) hujjat tartibida qatorlarga,
// formatlash: <b>/<strong>/font-weight → qalin; color / <font color> → rang;
// <mark>/background → highlight; <img src> → rasm (data: URI yoki zip ichidagi yo'l).
// Kalit so'z HTML'lari ("article.card": h2.q, p.a, mark.k-q/k-ans, p.chip) alohida o'qiladi.

import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { F_BOLD, F_COLOR, F_HIGHLIGHT, type KeyCard, type Line, type RawImage, type ReadResult } from "./types";

const BLOCK = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "tr", "div", "section", "article", "header", "footer", "blockquote", "figure", "figcaption", "pre", "table", "ul", "ol", "br", "hr", "dt", "dd"]);
const SKIP = new Set(["script", "style", "noscript", "template", "head", "svg", "button", "input", "select", "textarea"]);

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function styleFlags(el: Element): number {
  const tag = el.tagName?.toLowerCase();
  const style = (el.attribs?.style ?? "").toLowerCase();
  let flag = 0;
  if (tag === "b" || tag === "strong" || /font-weight\s*:\s*(bold|[6-9]00)/.test(style)) flag |= F_BOLD;
  if (tag === "mark" || /background(-color)?\s*:\s*(?!\s*(transparent|none|#fff\b|#ffffff|white|inherit))/.test(style)) flag |= F_HIGHLIGHT;
  const color = el.attribs?.color ?? /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(style)?.[1];
  if (color && !/^(#0{3}|#0{6}|black|inherit|initial|currentcolor|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))$/i.test(color.trim())) flag |= F_COLOR;
  return flag;
}

function readCards($: cheerio.CheerioAPI): KeyCard[] {
  return $("article.card")
    .toArray()
    .map((card) => {
      const c = $(card);
      const chip = c.find("p.chip > span").not(".arrow").toArray().map((s) => collapse($(s).text()));
      const num = Number(c.attr("data-num"));
      const answer = c.find("p.a").clone();
      answer.find(".answer-label").remove();
      return {
        number: Number.isInteger(num) && num > 0 ? num : null,
        question: collapse(c.find("h2.q").text()),
        answer: collapse(answer.text()),
        questionKey: collapse(c.find(".cue strong").first().text()) || chip[0] || collapse(c.find("mark.k-q").first().text()),
        answerKey: chip[1] || collapse(c.find("mark.k-ans").first().text()).toUpperCase(),
      };
    })
    .filter((card) => card.question || card.answer);
}

export function readHtml(html: string, resolveRef?: (ref: string) => Promise<RawImage | null>): ReadResult {
  const $ = cheerio.load(html);
  const cards = readCards($);
  const lines: Line[] = [];
  let cur: Line = { text: "", flags: [], images: [] };
  const flush = (heading = false) => {
    if (cur.text.trim() || cur.images.length) {
      // Boshidagi/oxiridagi bo'shliqlarni flags bilan birga kesamiz.
      const start = cur.text.length - cur.text.trimStart().length;
      const end = cur.text.trimEnd().length;
      lines.push({
        text: cur.text.slice(start, end),
        flags: cur.flags.slice(start, end),
        images: cur.images.map((img) => ({ ...img, pos: Math.max(0, Math.min(img.pos - start, end - start)) })),
        heading,
      });
    }
    cur = { text: "", flags: [], images: [] };
  };
  const walk = (node: AnyNode, flag: number) => {
    if (node.type === "text") {
      const text = (node as unknown as { data: string }).data.replace(/\s+/g, " ");
      if (!text) return;
      if (/^\s$/.test(text) && cur.text.endsWith(" ")) return;
      cur.text += text;
      for (let i = 0; i < text.length; i++) cur.flags.push(flag);
      return;
    }
    if (node.type !== "tag") return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) return;
    if (tag === "img") {
      const src = el.attribs?.src;
      if (src) cur.images.push({ pos: cur.text.length, ref: src });
      return;
    }
    const block = BLOCK.has(tag);
    const heading = /^h[1-3]$/.test(tag);
    if (block) flush();
    for (const c of el.children) walk(c, flag | styleFlags(el));
    if (block) flush(heading);
  };
  const body = $("body").get(0) ?? $.root().get(0);
  if (body) for (const c of (body as Element).children ?? []) walk(c, 0);
  flush();

  return {
    lines,
    cards: cards.length ? cards : undefined,
    title: collapse($("h1").first().text()) || collapse($("title").text()) || undefined,
    async readImage(ref) {
      const data = /^data:image\/([a-z+]+);base64,(.+)$/i.exec(ref);
      if (data) return { ref, data: Buffer.from(data[2], "base64"), ext: data[1].replace("jpeg", "jpg").replace("svg+xml", "svg") };
      return resolveRef ? resolveRef(ref) : null;
    },
  };
}
