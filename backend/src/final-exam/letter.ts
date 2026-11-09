// Motivatsion xat va o'ta olmaganlar uchun qisqa xabar — server shablonlari
// (tashqi AI ishlatilmaydi). Xat sertifikat bilan birga bir marta yig'iladi va
// Certificate.letterText'da saqlanadi. Murojaat ("Hurmatli <ism>!") va imzo UI'da.

import { shuffle, type Random } from "../common/option-order";
import { FINAL_EXAM_PASS_AVERAGE, averagePercent, formatPercent } from "./rules";

export type LetterTone = "perfect" | "growth" | "learned" | "steady";

export interface LetterStats {
  /** Imtihon turi: 20 yoki 50 ta savol. */
  questions: number;
  /** Urinishlar natijasi (vaqt bo'yicha tartibda). */
  percents: number[];
}

export interface LetterFacts {
  questions: number;
  attempts: number;
  average: number;
  best: number;
  lowest: number;
  perfectCount: number;
  firstHalf: number;
  secondHalf: number;
}

export function letterFacts({ questions, percents }: LetterStats): LetterFacts {
  const half = Math.floor(percents.length / 2);
  return {
    questions,
    attempts: percents.length,
    average: averagePercent(percents) ?? 0,
    best: Math.max(...percents),
    lowest: Math.min(...percents),
    perfectCount: percents.filter((p) => p >= 100).length,
    firstHalf: averagePercent(percents.slice(0, half)) ?? 0,
    secondHalf: averagePercent(percents.slice(half)) ?? 0,
  };
}

/** Natija o'sib borgan: ikkinchi yarmi birinchisidan kamida 2 foiz yuqori. */
export function isGrowing(f: LetterFacts): boolean {
  return f.secondHalf - f.firstHalf >= 2;
}

/**
 * Ohang: 99%+ — "mukammal"; natija o'sib borgan — "qat'iyat va o'sish";
 * ba'zi urinishlar sezilarli past (95% dan kam) — "xatolardan o'rganish";
 * qolgan 98–99% — "izchil va puxta tayyorgarlik".
 */
export function chooseTone(f: LetterFacts): LetterTone {
  if (f.average >= 99) return "perfect";
  if (isGrowing(f)) return "growth";
  if (f.lowest < 95) return "learned";
  return "steady";
}

const p = formatPercent;

function perfectLine(f: LetterFacts): string {
  if (f.perfectCount === 0) return `Eng yaxshi urinishingizda ${p(f.best)} natija ko'rsatdingiz.`;
  if (f.perfectCount === f.attempts) return `${f.attempts} ta urinishning barchasida birorta ham xato qilmadingiz.`;
  return `${f.attempts} ta urinishning ${f.perfectCount} tasida birorta ham xato qilmadingiz.`;
}

function spreadLine(f: LetterFacts): string {
  return f.best - f.lowest <= 5
    ? `Natijalaringiz ${p(f.lowest)} bilan ${p(f.best)} oralig'ida deyarli bir tekis bo'ldi.`
    : `Natijalaringiz ${p(f.lowest)} dan ${p(f.best)} gacha bo'ldi va umumiy daraja yuqori saqlandi.`;
}

type Template = (f: LetterFacts) => string[];

const TEMPLATES: Record<LetterTone, Template[]> = {
  perfect: [
    (f) => [
      `Siz ${f.questions} ta savollik yakuniy ichki imtihonni ${f.attempts} marta topshirib, o'rtacha ${p(f.average)} natija qayd etdingiz. Bu deyarli xatosiz ish degani. ${perfectLine(f)} Eng past natijangiz ham ${p(f.lowest)} bo'ldi — demak, bilimingiz tasodif emas, puxta mustahkamlangan.`,
      `Yo'l harakati qoidalarini bunchalik aniq bilish haydovchi uchun katta tayanch. Shunday bo'lsa-da, haqiqiy imtihonda shoshmang: har bir savolni oxirigacha o'qing, rasmga diqqat bilan qarang va birinchi xayolga kelgan javobga emas, qoidaga tayaning. Imtihondan oldingi kuni yaxshi dam oling — tayyorgarligingiz bunga to'liq arziydi.`,
      `Sizni chin dildan tabriklaymiz va haqiqiy imtihonda omad tilaymiz!`,
    ],
    (f) => [
      `${f.attempts} ta urinish, o'rtacha ${p(f.average)} — bu ${f.questions} ta savollik imtihonda juda kam uchraydigan natija. ${perfectLine(f)} Siz savollarni yodlab emas, mazmunini tushunib yechganingiz shundan ko'rinib turibdi.`,
      `Bu natija ortida videodarslar, kunlik testlar va sabr bilan o'tkazilgan soatlar turibdi. Endi asosiy vazifa — shu darajani saqlash. Imtihon kunigacha har kuni bir oz takrorlang, ayniqsa belgilar va chorrahalardagi navbatni. Bilim qanchalik mustahkam bo'lsa ham, uni vaqti-vaqti bilan yangilab turish kerak.`,
      `Haqiqiy imtihonda xotirjam bo'ling va o'zingizga ishoning: siz bunga puxta tayyorlandingiz. Omad sizga yor bo'lsin!`,
    ],
    (f) => [
      `Tabriklaymiz! Yakuniy ichki imtihonning ${f.questions} talik turida o'rtacha natijangiz ${p(f.average)} bo'ldi. ${perfectLine(f)} ${spreadLine(f)}`,
      `Bunday aniqlik tasodifan kelmaydi: u har bir mavzuni oxirigacha o'rganish va xatolarni e'tiborsiz qoldirmaslik natijasi. Haqiqiy imtihonda ham shu odatingizni saqlang — savolni to'liq o'qing, variantlarni solishtiring va keyin javob bering. Rasmli savollarda har bir belgi va chiziqqa alohida qarang.`,
      `Imtihon kuni ertaroq boring, hujjatlaringizni oldindan tayyorlab qo'ying va savollarga xotirjam kirishing. Sizga xotirjamlik, diqqat va haqiqiy imtihonda omad tilaymiz!`,
    ],
  ],
  steady: [
    (f) => [
      `Siz ${f.questions} ta savollik yakuniy ichki imtihonni ${f.attempts} marta topshirib, o'rtacha ${p(f.average)} natijaga erishdingiz. ${spreadLine(f)} Bu bir martalik omad emas, izchil va puxta tayyorgarlik belgisi.`,
      `Har bir urinishda yuqori natijani takrorlash oson emas — buning uchun bilim mustahkam bo'lishi kerak. ${perfectLine(f)} Imtihon kunigacha qolgan vaqtda xato qilgan savollaringizni yana bir bor ko'rib chiqing: aynan ular eng ko'p foyda beradi. Qolgan vaqtni xotirjam takrorlashga ajrating, yangi narsalarni shoshilib yodlashga urinmang.`,
      `Haqiqiy imtihonda shoshmasdan, diqqat bilan ishlang. Sizga omad tilaymiz!`,
    ],
    (f) => [
      `O'rtacha ${p(f.average)} — bu ${f.questions} talik yakuniy imtihonda o'tish chegarasidan yuqori va ishonchli natija. ${f.attempts} ta urinish davomida darajangiz pasaymadi: ${spreadLine(f).charAt(0).toLowerCase()}${spreadLine(f).slice(1)}`,
      `Barqarorlik haydovchilikda ham eng muhim fazilatlardan biri. ${perfectLine(f)} Endi bilimlaringizni yangilab turish kifoya: har kuni bir nechta savol yeching va qoidalarni real yo'l vaziyatlari bilan bog'lab o'ylang. Shunda imtihonda ham, yo'lda ham to'g'ri qaror qabul qilish osonlashadi.`,
      `Imtihon kuni o'zingizga ishoning, shoshmang va har bir savolni oxirigacha o'qing. Omad sizga yor bo'lsin!`,
    ],
    (f) => [
      `Tabriklaymiz! ${f.attempts} ta urinishda ${f.questions} ta savollik imtihonni o'rtacha ${p(f.average)} natija bilan yakunladingiz. Eng yaxshi natijangiz ${p(f.best)}, eng pasti esa ${p(f.lowest)} bo'ldi — ikkalasi ham yuqori daraja.`,
      `Bu natija kunlik mashg'ulotlarni izchil davom ettirganingiz samarasi. ${perfectLine(f)} Haqiqiy imtihonda ham shu tartibni saqlang: avval savolni to'liq o'qing, keyin rasmni tahlil qiling va faqat shundan so'ng javobni belgilang. Izchillik imtihonda ham sizning eng ishonchli yordamchingiz bo'ladi.`,
      `Imtihon oldidan yaxshi dam oling — charchagan ko'z oddiy savolda ham adashishi mumkin. Sizga xotirjamlik va haqiqiy imtihonda omad tilaymiz!`,
    ],
  ],
  growth: [
    (f) => [
      `Sizning yo'lingiz qat'iyat haqida. Dastlabki urinishlarda o'rtacha ${p(f.firstHalf)} natija ko'rsatgan bo'lsangiz, keyingi urinishlarda bu ${p(f.secondHalf)} ga yetdi. ${f.attempts} ta urinish yakunida ${f.questions} talik imtihondagi o'rtacha natijangiz ${p(f.average)} bo'ldi.`,
      `O'sish o'z-o'zidan bo'lmaydi: har bir xatoni tahlil qilib, keyingi safar uni takrorlamaslik uchun harakat qilgansiz. ${perfectLine(f)} Imtihon kunigacha shu odatni davom ettiring — qiyin mavzularni yana bir bor ko'rib chiqing. Ilgari xato qilgan savollaringiz endi sizning kuchli tomoningizga aylangani — eng katta yutuq.`,
      `Haqiqiy imtihonda ham shu qat'iyatingiz sizga tayanch bo'lsin. Sizga chin dildan omad tilaymiz!`,
    ],
    (f) => [
      `Natijalaringiz har urinishda o'sib bordi va bu eng quvonarli jihat. Birinchi yarmida o'rtacha ${p(f.firstHalf)}, ikkinchi yarmida esa ${p(f.secondHalf)} — ${f.questions} ta savollik imtihonda umumiy o'rtacha ${p(f.average)} bo'ldi.`,
      `Bu siz to'xtab qolmay, xatolardan xulosa chiqarganingizni ko'rsatadi. ${perfectLine(f)} Endi asosiy maqsad — erishgan darajani saqlash: har kuni ozgina takrorlang va ilgari qiyin bo'lgan savollarga alohida e'tibor bering. Bu yo'lda ko'rsatgan sabringiz haydovchilikda ham sizga asqatadi.`,
      `Haqiqiy imtihonga xotirjam boring: bosib o'tgan yo'lingiz siz bunga tayyor ekaningizni ko'rsatib turibdi. Omad sizga yor bo'lsin!`,
    ],
    (f) => [
      `Tabriklaymiz! ${f.questions} talik yakuniy ichki imtihonda o'rtacha ${p(f.average)} natija qayd etdingiz. Eng muhimi — natijangiz o'sib bordi: dastlabki urinishlardagi ${p(f.firstHalf)} keyingi urinishlarda ${p(f.secondHalf)} ga ko'tarildi.`,
      `Bunday o'sish sabr va mehnat bilan keladi. ${perfectLine(f)} Haqiqiy imtihonda ham shoshmang: har bir savolni oxirigacha o'qing va avval o'rgangan qoidalaringizga tayaning. Qiyin savolga duch kelsangiz, xotirjamlikni yo'qotmang. Bir savolga qaytib kelish mumkinligini unutmang.`,
      `Siz bosib o'tgan yo'l — dastlabki qiyinchiliklardan barqaror yuqori natijagacha — haqiqiy tayyorgarlik qanday bo'lishini ko'rsatadi. Sizga haqiqiy imtihonda omad va yo'llarda xavfsiz harakat tilaymiz!`,
    ],
  ],
  learned: [
    (f) => [
      `Siz ${f.questions} ta savollik yakuniy ichki imtihonni ${f.attempts} marta topshirib, o'rtacha ${p(f.average)} natijaga erishdingiz. Ba'zi urinishlarda natija ${p(f.lowest)} gacha tushgan bo'lsa-da, siz to'xtamadingiz va keyingi urinishlarda yana yuqori darajaga qaytdingiz.`,
      `Xatolardan o'rganish — haqiqiy tayyorgarlikning eng muhim qismi. ${perfectLine(f)} Imtihon kunigacha aynan xato qilgan savollaringizni qayta ko'rib chiqing: ular qaysi qoidani yana bir bor takrorlash kerakligini aniq ko'rsatadi. Har bir xato — keyingi safar to'g'ri javob berish uchun imkoniyat. Siz bu imkoniyatlardan to'liq foydalandingiz.`,
      `Haqiqiy imtihonda diqqatli va xotirjam bo'ling. Sizga omad tilaymiz!`,
    ],
    (f) => [
      `O'rtacha ${p(f.average)} — ${f.questions} talik imtihonda o'tish chegarasidan yuqori natija. Yo'lingiz doim tekis bo'lmadi: eng past urinishingiz ${p(f.lowest)}, eng yaxshisi esa ${p(f.best)} bo'ldi. Lekin har bir pastroq natijadan keyin siz xulosa chiqardingiz.`,
      `Aynan shu xatolardan o'rganish qobiliyati sizni ${FINAL_EXAM_PASS_AVERAGE}% chegarasidan o'tkazdi. ${perfectLine(f)} Imtihon kunigacha qiyin bo'lgan mavzularning videodarslarini qisqacha qayta ko'rib chiqing. Bir marta xato qilingan savolni puxta tushunish uni yod olishdan ko'ra ancha foydaliroq.`,
      `Haqiqiy imtihonda har bir savolni oxirigacha o'qing, rasmga diqqat bilan qarang va shoshmang. Omad sizga yor bo'lsin!`,
    ],
    (f) => [
      `Tabriklaymiz! ${f.attempts} ta urinishda ${f.questions} ta savollik imtihonni o'rtacha ${p(f.average)} natija bilan yakunladingiz. Ba'zi urinishlar qiyinroq kechdi — natija ${p(f.lowest)} gacha tushgan payt ham bo'ldi.`,
      `Shunga qaramay siz taslim bo'lmadingiz va har safar xatolaringizni tuzatib bordingiz. ${perfectLine(f)} Bu tajriba haqiqiy imtihonda ham asqatadi: savolni diqqat bilan o'qing, rasmni tahlil qiling va avval o'rgangan qoidani eslang. Pastroq natijalar sizni to'xtatmagani — bu tayyorgarligingiz chuqur ekanining belgisi.`,
      `Imtihon oldidan yaxshi dam oling — charchagan ko'z oddiy savolda ham adashishi mumkin. Sizga xotirjamlik va haqiqiy imtihonda omad tilaymiz!`,
    ],
  ],
};

export function templateCount(tone: LetterTone): number {
  return TEMPLATES[tone].length;
}

/** Xat matni (paragraflar "\n\n" bilan). `variant` berilmasa — tasodifiy. */
export function buildLetter(stats: LetterStats, random: Random = Math.random, variant?: number): { tone: LetterTone; text: string; facts: LetterFacts } {
  const facts = letterFacts(stats);
  const tone = chooseTone(facts);
  const list = TEMPLATES[tone];
  const index = variant ?? shuffle(list.map((_, i) => i), random)[0];
  return { tone, facts, text: list[index % list.length](facts).join("\n\n") };
}

export interface WeakTopic {
  title: string;
  /** Shu mavzu savollaridagi xato ulushi (%). */
  errorPercent: number;
}

/**
 * 10 ta urinishdan keyin o'rtacha 98% dan past: 3 gapli hurmatli xabar —
 * nima yaxshi bo'lgani, qaysi mavzularda ko'proq xato va keyingi qadam.
 */
export function buildFailureNote(stats: LetterStats, weakTopics: readonly WeakTopic[]): string {
  const f = letterFacts(stats);
  const good =
    f.perfectCount > 0
      ? `${f.attempts} ta urinishning ${f.perfectCount} tasida xatosiz natija ko'rsatdingiz — demak, kerakli darajaga yetish qo'lingizdan keladi.`
      : f.best >= 90
        ? `Eng yaxshi urinishingizda ${p(f.best)} natija ko'rsatdingiz — bu kerakli darajaga yaqin.`
        : `Siz ${f.attempts} ta urinishni oxirigacha topshirdingiz — bu bilimingizni xolis baholash uchun muhim qadam.`;
  const weak =
    weakTopics.length > 0
      ? `Ko'proq xato qilingan mavzular: ${weakTopics.map((t) => `«${t.title}» (${p(t.errorPercent)} xato)`).join(", ")}.`
      : `Xatolar bitta mavzuga to'planmagan, shuning uchun butun kursni qisqacha takrorlash foydali bo'ladi.`;
  const next = `Shu mavzularning videodarslarini qayta ko'rib, kunlik testlarini yana ishlang; tayyor bo'lgach, urinishlarni yangilash uchun administratorga murojaat qiling.`;
  return [good, weak, next].join(" ");
}
