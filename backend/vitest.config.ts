import swc from "unplugin-swc";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// E2E testlar alohida bazada ishlaydi (TEST_DATABASE_URL) — dev/prod bazaga
// hech qachon tegmaydi. Nest dekoratorlari metadata talab qiladi, shuning
// uchun TS esbuild o'rniga SWC orqali kompilyatsiya qilinadi.
const env = loadEnv("test", process.cwd(), "");
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL topilmadi (.env yoki muhit o'zgaruvchisi).");
}
if (testDatabaseUrl === (process.env.DATABASE_URL ?? env.DATABASE_URL)) {
  throw new Error("TEST_DATABASE_URL asosiy DATABASE_URL bilan bir xil bo'lmasligi kerak.");
}

// globalSetup shu (asosiy) jarayonda ishlaydi — URL'ni unga shu orqali uzatamiz.
process.env.E2E_DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["test/**/*.e2e-spec.ts"],
    globalSetup: ["test/global-setup.ts"],
    env: { DATABASE_URL: testDatabaseUrl },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
