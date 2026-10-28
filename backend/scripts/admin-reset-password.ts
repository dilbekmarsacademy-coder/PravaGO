// Parolni tiklash: npm run admin:reset-password -- --login owner [--password ...]
// Barcha faol sessiyalar bekor qilinadi. Parol argument berilmasa stdin'dan o'qiladi.
import { PrismaClient } from "@prisma/client";
import { hashSecret } from "../src/admin/password";
import { parseArgs, readPassword, validatePassword } from "./admin/common";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const login = args.login?.trim().toLowerCase();
  if (!login) throw new Error("--login kerak.");
  const password = await readPassword(args);
  validatePassword(password);

  const prisma = new PrismaClient();
  try {
    const admin = await prisma.admin.findUnique({ where: { login } });
    if (!admin) throw new Error(`"${login}" logini topilmadi.`);
    const now = new Date();
    await prisma.$transaction([
      prisma.admin.update({ where: { id: admin.id }, data: { passwordHash: await hashSecret(password), passwordChangedAt: now, active: true } }),
      prisma.adminSession.updateMany({ where: { adminId: admin.id, revokedAt: null }, data: { revokedAt: now } }),
      prisma.auditLog.create({ data: { action: "admin.password_reset_cli", entityType: "admin", entityId: admin.id } }),
    ]);
    console.log(`Parol yangilandi: ${login} (barcha sessiyalar bekor qilindi)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
