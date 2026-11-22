// Bir martalik TO'LIQ nollash (hamma foydalanuvchi, weeklyResetExempt ham):
// mavzu testlari, random testlar, javoblar, AI xulosa, video va kalit so'zlar
// progressi, yakuniy imtihon urinishlari va sertifikatlar — avval arxivga, keyin nollanadi.
//
//   npm run reset:all-now -- --dry-run                       # faqat sanaydi, hech narsa yozmaydi
//   npm run reset:all-now -- --confirm "HAMMASINI NOLLASH"   # bajaradi
//   ... --key full-2026-12-01                                # boshqa (yangi) to'liq nollash
//
// Baza — DATABASE_URL. Idempotent: shu kalit "done" bo'lsa ikkinchi chaqiruv hech narsa qilmaydi.
// Deploy paytida avtomatik ishlamaydi.
import "reflect-metadata";
import { PrismaService } from "../src/prisma/prisma.service";
import { WeeklyResetService } from "../src/weekly-reset/weekly-reset.service";
import { FULL_RESET_CONFIRM } from "../src/weekly-reset/weekly-reset.dto";
import { FULL_RESET_KEY } from "../src/weekly-reset/schedule";
import { parseArgs } from "./admin/common";

function dbLabel(): string {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "(DATABASE_URL o'qilmadi)";
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args["dry-run"] === "true";
  const weekKey = args.key && args.key !== "true" ? args.key : FULL_RESET_KEY;
  if (!/^full-[\w.-]{1,35}$/.test(weekKey)) throw new Error('--key "full-..." ko\'rinishida bo\'lishi kerak.');
  if (!dryRun && args.confirm !== FULL_RESET_CONFIRM) {
    throw new Error(`Bajarish uchun: --confirm "${FULL_RESET_CONFIRM}" (yoki avval --dry-run).`);
  }

  const prisma = new PrismaService();
  const reset = new WeeklyResetService(prisma);
  try {
    console.log(`Baza: ${dbLabel()}`);
    console.log(`Kalit: ${weekKey}${dryRun ? " (dry-run — hech narsa yozilmaydi)" : ""}`);
    const previous = await reset.resetState(weekKey);
    if (previous) console.log(`Oldingi holat: ${previous.status}, ${previous.affectedUsers} ta foydalanuvchi, ${previous.finishedAt?.toISOString() ?? "-"}`);
    const result = await reset.fullReset({ dryRun, weekKey });
    if (result.skipped) {
      console.log("O'tkazib yuborildi: bu kalit bilan nollash allaqachon bajarilgan (yoki hozir bajarilmoqda). Hech narsa o'zgarmadi.");
      return;
    }
    console.log(`${dryRun ? "Ta'sirlanadi" : "Nollandi"}: ${result.affectedUsers} ta foydalanuvchi`);
    console.table(result.counts);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
