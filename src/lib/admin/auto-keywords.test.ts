import { describe, expect, it } from "vitest";
import { latinToCyrillic } from "@/lib/i18n/translit";
import { autoKeywords } from "./auto-keywords";
import { chipText, type Texts } from "./keywords";

function t(latn: string, ru = ""): Texts {
  return { latn, cyrl: latinToCyrillic(latn), ru };
}

describe("autoKeywords", () => {
  it("javob kaliti — to'g'ri variantni boshqalaridan ajratib turadigan so'zlar", () => {
    const text = t("Piyodalarga yo'lni qayerda kesib o'tishga ruxsat etiladi?", "Где пешеходам разрешается переходить дорогу?");
    const options = [
      t("Faqat piyodalar o'tish joyidan", "Только по пешеходному переходу"),
      t("Istalgan joydan", "В любом месте"),
      t("Svetofor yonidan", "Рядом со светофором"),
    ];
    const res = autoKeywords(text, options, 0)!;
    expect(chipText(options[0].latn, res.answer.uz)).toBe("PIYODALAR O'TISH");
    expect(chipText(options[0].cyrl, res.answer.cyrl)).toBe(latinToCyrillic("piyodalar o'tish").toUpperCase());
    expect(res.question.uz).toBeDefined();
    expect(chipText(text.latn, res.question.uz)).toMatch(/PIYODALARGA/);
    expect(res.answer.ru).toBeDefined();
    expect(chipText(options[0].ru, res.answer.ru)).toBe("ПЕШЕХОДНОМУ ПЕРЕХОДУ");
  });

  it("lotin va kirill bir xil so'zni belgilaydi", () => {
    const text = t("Qaysi transport vositasi ustunlikka ega?");
    const options = [t("Tramvay"), t("Avtobus"), t("Yengil avtomobil")];
    const res = autoKeywords(text, options, 0)!;
    expect(chipText(options[0].latn, res.answer.uz)).toBe("TRAMVAY");
    expect(chipText(options[0].cyrl, res.answer.cyrl)).toBe("ТРАМВАЙ");
    expect(chipText(text.latn, res.question.uz)).toBe("USTUNLIKKA EGA");
  });

  it("qisqa variant — butunligicha", () => {
    const options = [t("А va Б"), t("Faqat А"), t("Faqat Б")];
    const res = autoKeywords(t("Qaysi rasmdagi haydovchi qoidani buzayapti?"), options, 0)!;
    expect(chipText(options[0].latn, res.answer.uz)).toBe("А VA Б");
  });

  it("variantlar bir xil so'zlardan iborat bo'lsa ham bo'sh qolmaydi", () => {
    const options = [t("Ha, ruxsat etiladi"), t("Yo'q, ruxsat etilmaydi")];
    const res = autoKeywords(t("Quvib o'tishga ruxsat etiladimi?"), options, 0)!;
    expect(res.answer.uz?.length).toBe(1);
  });

  it("ruscha matn bo'lmasa — faqat o'zbekcha", () => {
    const res = autoKeywords(t("Bu belgi nimani bildiradi?"), [t("Asosiy yo'l"), t("Yo'l bering")], 0)!;
    expect(res.answer.ru).toBeUndefined();
    expect(res.answer.uz).toBeDefined();
  });
});
