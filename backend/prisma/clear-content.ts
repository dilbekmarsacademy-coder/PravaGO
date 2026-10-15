// Kontentni (test banklari va video progressi) DB'dan butunlay o'chiradi.
// Foydalanuvchilar va sessiyalar saqlanib qoladi; sxema/kod o'zgarmaydi.
//
//   npm run content:clear            — DATABASE_URL dagi bazani tozalaydi
//
// O'chiriladi: Saqlanganlar, savollar, variantlar, mavzular (test banklari),
// imtihon urinishlari va video dars progresslari. Qaytarib bo'lmaydi —
// kerak bo'lsa avval pg_dump bilan zaxira oling.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$transaction([
    prisma.savedQuestion.deleteMany(),
    prisma.option.deleteMany(),
    prisma.question.deleteMany(),
    prisma.topic.deleteMany(),
    prisma.examAttempt.deleteMany(),
    prisma.lessonProgress.deleteMany(),
  ]);
  const [saved, options, questions, topics, attempts, lessonProgress] = result.map((r) => r.count);
  console.log(
    `O'chirildi: ${topics} mavzu, ${questions} savol, ${options} variant, ${saved} saqlangan savol, ` +
      `${attempts} imtihon urinishi, ${lessonProgress} video progress.`,
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
