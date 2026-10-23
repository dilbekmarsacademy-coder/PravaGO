// Kalit so'z HTML fayllarini o'qiydi. Har bir savol — <article class="card">:
//   .cue strong  — savol kaliti
//   h2.q         — savol matni, ichida <mark class="k-q"> (savoldagi kalit so'z)
//   p.a          — to'g'ri javob ("To'g'ri javob:" yorlig'isiz), ichida <mark class="k-ans">
//   p.chip       — "SAVOL KALITI → JAVOB KALITI"
// `data-num` ATAYLAB ishlatilmaydi — raqamlar docx bilan mos emas.
// HTML bazaga yozilmaydi: faqat toza matn va belgilash pozitsiyalari olinadi.

import { parse, type HTMLElement, type Node } from "node-html-parser";
import { collapseSpaces, type Range } from "./text";

export interface HtmlCard {
  /** Fayldagi tartib (faqat hisobot uchun). */
  index: number;
  question: string;
  questionMark: { text: string; range: Range } | null;
  answer: string;
  answerMark: { text: string; range: Range } | null;
  questionKeyword: string;
  answerKeyword: string;
}

export interface HtmlKeywords {
  title: string;
  cards: HtmlCard[];
}

/** Element matni + berilgan klassli <mark> oralig'i; bo'shliqlar siqiladi. */
function textWithMark(el: HTMLElement, markClass: string, skip?: (node: HTMLElement) => boolean) {
  const chars: { ch: string; marked: boolean }[] = [];
  const walk = (node: Node, marked: boolean) => {
    if (node.nodeType === 3) {
      for (const ch of node.text) chars.push({ ch, marked });
      return;
    }
    const element = node as HTMLElement;
    if (skip?.(element)) return;
    const isMark = element.tagName === "MARK" && element.classList.contains(markClass);
    for (const c of element.childNodes) walk(c, marked || isMark);
  };
  for (const c of el.childNodes) walk(c, false);

  let text = "";
  let start = -1;
  let end = -1;
  let space = false;
  for (const { ch, marked } of chars) {
    if (/\s/.test(ch)) {
      space = true;
      continue;
    }
    if (space && text) text += " ";
    space = false;
    if (marked && start < 0) start = text.length;
    text += ch;
    if (marked) end = text.length;
  }
  const mark = start >= 0 ? { text: text.slice(start, end), range: [start, end] as Range } : null;
  return { text, mark };
}

export function parseKeywordsHtml(html: string): HtmlKeywords {
  const root = parse(html);
  const title = collapseSpaces(root.querySelector("h1")?.text ?? "");
  const cards = root.querySelectorAll("article.card").map((card, index): HtmlCard => {
    const q = card.querySelector("h2.q");
    const a = card.querySelector("p.a");
    const question = q ? textWithMark(q, "k-q") : { text: "", mark: null };
    const answer = a
      ? textWithMark(a, "k-ans", (node) => node.classList?.contains("answer-label") ?? false)
      : { text: "", mark: null };
    const chip = card.querySelectorAll("p.chip > span").filter((s) => !s.classList.contains("arrow"));
    return {
      index: index + 1,
      question: question.text,
      questionMark: question.mark,
      answer: answer.text,
      answerMark: answer.mark,
      questionKeyword: collapseSpaces(card.querySelector(".cue strong")?.text ?? chip[0]?.text ?? ""),
      answerKeyword: collapseSpaces(chip[1]?.text ?? answer.mark?.text.toUpperCase() ?? ""),
    };
  });
  return { title, cards };
}
