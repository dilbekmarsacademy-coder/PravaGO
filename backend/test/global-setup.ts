import { execSync } from "child_process";

// Test bazasini oxirgi migratsiyalarga olib chiqadi (URL vitest.config.ts'dan).
export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL },
  });
}
