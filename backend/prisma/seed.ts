import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SeedOption {
  id: string;
  text: string;
}

interface SeedTranslation {
  text: string;
  options: Record<string, string>;
  keyword: string;
}

interface SeedQuestion {
  id: number;
  topic: string;
  text: string;
  image: string;
  options: SeedOption[];
  correctOptionId: string | string[] | null;
  keyword: string;
  confidence?: string;
  needsReview?: boolean;
}

const SEED_DATA_DIR = path.join(__dirname, "seed-data");
const QUESTIONS_JSON_PATH = path.join(SEED_DATA_DIR, "questions.json");
// Ruscha tarjimalar (savol id → matn, variantlar, kalit so'z). AI tarjimasi —
// qo'lda tekshirilguncha `ruNeedsReview=true` bo'lib turadi.
const QUESTIONS_RU_JSON_PATH = path.join(SEED_DATA_DIR, "questions.ru.json");
const SOURCE_IMAGES_DIR = path.join(SEED_DATA_DIR, "images");

// public/ is served as static files by the NestJS app (see main.ts).
const PUBLIC_IMAGES_DIR = path.join(__dirname, "..", "public", "images");

const TOPIC_TITLES: Record<string, string> = {
  "1-kun-2-mavzu-tartibga-soluvchining-ishoralari":
    "1-kun 2-mavzu: Tartibga soluvchining ishoralari",
};

/** JPEG/PNG fayl sarlavhasidan rasm o'lchamlarini o'qiydi (kutubxonasiz). */
function readImageSize(filePath: string): { width: number; height: number } | null {
  const buf = fs.readFileSync(filePath);
  // PNG: IHDR bo'lagida 16-baytdan kenglik, 20-baytdan balandlik.
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: SOFn markerini topguncha segmentlar bo'ylab yuramiz.
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += marker === 0xff ? 1 : 2;
      continue;
    }
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function resolvePublicBaseUrl(): string {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    throw new Error(
      "PUBLIC_BASE_URL environment variable topilmadi. Rasm URL'lari to'liq " +
        "bo'lishi kerak (masalan https://pravatayyor-api.onrender.com).",
    );
  }
  return base.replace(/\/+$/, "");
}

function copyImages(): void {
  fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
  const files = fs.readdirSync(SOURCE_IMAGES_DIR);
  for (const file of files) {
    fs.copyFileSync(
      path.join(SOURCE_IMAGES_DIR, file),
      path.join(PUBLIC_IMAGES_DIR, file),
    );
  }
  console.log(`Nusxalandi: ${files.length} ta rasm -> ${PUBLIC_IMAGES_DIR}`);
}

async function main() {
  if (!fs.existsSync(QUESTIONS_JSON_PATH)) {
    throw new Error(`questions.json topilmadi: ${QUESTIONS_JSON_PATH}`);
  }

  copyImages();
  const publicBaseUrl = resolvePublicBaseUrl();

  const raw = fs.readFileSync(QUESTIONS_JSON_PATH, "utf-8");
  const questions: SeedQuestion[] = JSON.parse(raw);
  const ruTranslations: Record<string, SeedTranslation> = fs.existsSync(QUESTIONS_RU_JSON_PATH)
    ? JSON.parse(fs.readFileSync(QUESTIONS_RU_JSON_PATH, "utf-8"))
    : {};

  const questionsByTopic = new Map<string, SeedQuestion[]>();
  for (const q of questions) {
    const list = questionsByTopic.get(q.topic) ?? [];
    list.push(q);
    questionsByTopic.set(q.topic, list);
  }

  let totalQuestions = 0;
  let totalNeedsReview = 0;

  for (const [slug, topicQuestions] of questionsByTopic) {
    const topic = await prisma.topic.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title: TOPIC_TITLES[slug] ?? slug,
      },
    });

    for (const q of topicQuestions) {
      if (!q.options || q.options.length === 0) {
        console.warn(`Savol #${q.id}: variantlar yo'q, o'tkazib yuborildi.`);
        continue;
      }

      const correctIds = new Set(
        Array.isArray(q.correctOptionId)
          ? q.correctOptionId
          : q.correctOptionId
            ? [q.correctOptionId]
            : [],
      );

      // Faqat bitta aniq to'g'ri javob bo'lsagina isCorrect belgilanadi.
      // Aks holda (bo'sh, noaniq yoki bir nechta variant) savol
      // needsReview=true deb belgilanadi va qo'lda tekshirilishi kerak bo'ladi.
      const isUnambiguous = correctIds.size === 1;
      const needsReview = Boolean(q.needsReview) || !isUnambiguous;
      if (needsReview) totalNeedsReview++;

      const size = readImageSize(path.join(SOURCE_IMAGES_DIR, q.image));
      const imageFields = { imageWidth: size?.width ?? null, imageHeight: size?.height ?? null };

      const ru = ruTranslations[String(q.id)];
      const ruFields = {
        textRu: ru?.text || null,
        keywordRu: ru?.keyword || null,
        ruNeedsReview: Boolean(ru),
      };

      const question = await prisma.question.upsert({
        where: { topicId_order: { topicId: topic.id, order: q.id } },
        update: {
          text: q.text,
          imageUrl: `${publicBaseUrl}/images/${q.image}`,
          keyword: q.keyword ?? "",
          needsReview,
          ...ruFields,
          ...imageFields,
        },
        create: {
          topicId: topic.id,
          text: q.text,
          imageUrl: `${publicBaseUrl}/images/${q.image}`,
          order: q.id,
          keyword: q.keyword ?? "",
          needsReview,
          ...ruFields,
          ...imageFields,
        },
      });

      // Har bir import bosqichida variantlarni tozalab qayta yozamiz —
      // bu skriptni qayta-qayta xavfsiz ishga tushirish imkonini beradi.
      await prisma.option.deleteMany({ where: { questionId: question.id } });
      await prisma.option.createMany({
        data: q.options.map((opt) => ({
          questionId: question.id,
          text: opt.text,
          textRu: ru?.options[opt.id] ?? null,
          isCorrect: isUnambiguous && correctIds.has(opt.id),
        })),
      });

      totalQuestions++;
    }
  }

  console.log(
    `Tugadi: ${totalQuestions} ta savol import qilindi (${totalNeedsReview} tasi needsReview).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
