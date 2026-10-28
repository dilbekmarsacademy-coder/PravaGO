// Admin yaratish: npm run admin:create -- --login owner --name "Sayt egasi" --role OWNER [--password ...]
// Parol argument berilmasa stdin'dan o'qiladi. Login band bo'lsa xato beradi.
import { PrismaClient, type AdminRole } from "@prisma/client";
import { hashSecret } from "../src/admin/password";
import { parseArgs, readPassword, validatePassword } from "./admin/common";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const login = args.login?.trim().toLowerCase();
  const name = args.name?.trim();
  const role = args.role?.trim().toUpperCase() as AdminRole | undefined;
  if (!login || !/^[a-z0-9._-]{2,50}$/.test(login)) throw new Error("--login kerak (a-z, 0-9, . _ -).");
  if (!name) throw new Error("--name kerak.");
  if (role !== "OWNER" && role !== "DEVELOPER") throw new Error("--role OWNER yoki DEVELOPER bo'lishi kerak.");
  const password = await readPassword(args);
  validatePassword(password);

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.admin.findUnique({ where: { login } });
    if (existing) throw new Error(`"${login}" logini allaqachon mavjud (parolni admin:reset-password bilan almashtiring).`);
    const admin = await prisma.admin.create({ data: { login, name, role, passwordHash: await hashSecret(password) } });
    await prisma.auditLog.create({
      data: { action: "admin.created_cli", entityType: "admin", entityId: admin.id, after: { login, name, role } },
    });
    console.log(`Admin yaratildi: ${login} (${role})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
