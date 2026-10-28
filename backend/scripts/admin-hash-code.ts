// Maxsus kod xeshi: printf '%s' "$KOD" | npm run -s admin:hash-code
// Natija (base64) — ADMIN_ACCESS_CODE_HASH qiymati.
import { hashSecret } from "../src/admin/password";
import { parseArgs, readPassword } from "./admin/common";

async function main() {
  const code = await readPassword(parseArgs(process.argv.slice(2)));
  if (code.length < 6) throw new Error("Kod kamida 6 belgi bo'lishi kerak.");
  process.stdout.write(`${Buffer.from(await hashSecret(code)).toString("base64")}\n`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
