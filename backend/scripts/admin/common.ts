// admin:create va admin:reset-password uchun umumiy yordamchilar.

export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [key, inline] = arg.slice(2).split("=", 2);
    if (inline !== undefined) out[key] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[key] = argv[++i];
    else out[key] = "true";
  }
  return out;
}

/** Parol: `--password` argumenti yoki stdin'ning birinchi qatori (masalan `echo "$P" | npm run admin:create ...`). */
export async function readPassword(args: Record<string, string>): Promise<string> {
  if (args.password && args.password !== "true") return args.password;
  if (process.stdin.isTTY) {
    throw new Error("Parolni --password bilan yoki stdin orqali bering (masalan: printf '%s' \"$PAROL\" | npm run ...).");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/)[0];
}

export function validatePassword(password: string): void {
  if (password.length < 12) throw new Error("Parol kamida 12 belgidan iborat bo'lishi kerak.");
}
