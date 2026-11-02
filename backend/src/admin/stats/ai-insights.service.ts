import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService, type ToolSpec } from "../../ai/ai.service";
import { monthStart } from "../../ai/ai-budget";
import type { AdminUser } from "../admin-request";
import { AuditService } from "../audit.service";
import { RANGE_KEYS, rangeStart, StatsService, type RangeKey } from "./stats.service";

const SUMMARY_SYSTEM = `Sen PravaTayyor (haydovchilik guvohnomasi imtihoniga tayyorlov kursi) admini uchun qisqa xulosa yozasan.
Senga faqat YIG'MA statistika (JSON) beriladi — shaxsiy ma'lumot yo'q. O'zbek tilida (lotin), markdown ro'yxat bilan yoz.
5–7 ta qisqa band: eng muhim o'zgarishlar, sotuv (tarif bo'yicha), 98% qoidasi bo'yicha o'tish, qayerda tashlab ketishyapti,
eng qiyin mavzu/savollar va 2 ta aniq taklif. Faqat berilgan raqamlarga tayan; ma'lumot bo'lmasa — shuni ayt.`;

const ASK_SYSTEM = `Sen PravaTayyor admin panelidagi statistika yordamchisisan. Savolga javob berish uchun faqat berilgan funksiyalarni chaqir
(ular faqat yig'ma raqamlarni o'qiydi; shaxsiy ma'lumot yo'q). Raqamlarni o'zing o'ylab topma — faqat funksiya natijalariga tayan.
Davr: "today" — bugun, "7d" — 7 kun, "30d" — 30 kun. Javobni o'zbek tilida (lotin), qisqa va aniq yoz; oxirida qaysi davr ishlatilganini ayt.
Savol statistikaga aloqasiz bo'lsa yoki ma'lumot yo'q bo'lsa — shuni ochiq ayt.`;

const summaryKey = (range: RangeKey) => `ai.summary.${range}`;

interface CachedSummary {
  text: string;
  model: string;
  range: RangeKey;
  createdAt: string;
}

const rangeSchema = { type: "string", enum: RANGE_KEYS, description: "Davr: today | 7d | 30d" };

/** Admin AI tahlili: keshlangan xulosa, statistikadan so'rash (tool use) va AI xarajatlari. */
@Injectable()
export class AiInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly stats: StatsService,
    private readonly audit: AuditService,
  ) {}

  async summary(range: RangeKey): Promise<CachedSummary | null> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: summaryKey(range) } });
    return (row?.value as unknown as CachedSummary | undefined) ?? null;
  }

  /** "AI xulosa" — Haiku; natija keshlanadi (admin "Yangilash"ni bosmaguncha qayta so'ralmaydi). */
  async refreshSummary(admin: AdminUser, ip: string, range: RangeKey): Promise<CachedSummary> {
    const data = await this.stats.dashboard(range);
    const result = await this.ai.text({
      feature: "report",
      system: SUMMARY_SYSTEM,
      messages: [{ role: "user", content: `Statistika (${range}):\n${JSON.stringify(data)}` }],
      meta: { adminId: admin.id },
    });
    const value: CachedSummary = { text: result.text, model: result.model, range, createdAt: new Date().toISOString() };
    await this.prisma.appSetting.upsert({
      where: { key: summaryKey(range) },
      create: { key: summaryKey(range), value: value as unknown as Prisma.InputJsonValue },
      update: { value: value as unknown as Prisma.InputJsonValue },
    });
    await this.audit.log(admin, ip, { action: "ai.summary_created", entityType: "ai", entityId: summaryKey(range) });
    return value;
  }

  /** Faqat o'qiydigan metrika funksiyalari — AI shular orqali raqam oladi (SQL yozmaydi). */
  tools(): ToolSpec[] {
    const cache = new Map<RangeKey, ReturnType<StatsService["dashboard"]>>();
    const dash = (input: Record<string, unknown>) => {
      const range = (RANGE_KEYS as string[]).includes(String(input.range)) ? (input.range as RangeKey) : "7d";
      if (!cache.has(range)) cache.set(range, this.stats.dashboard(range));
      return cache.get(range)!;
    };
    const ranged = (properties: Record<string, unknown> = {}) => ({
      type: "object",
      properties: { range: rangeSchema, ...properties },
      required: ["range", ...Object.keys(properties)],
      additionalProperties: false,
    });
    return [
      {
        name: "getSales",
        description: "Tasdiqlangan to'lovlar: tarif (imtihon toifasi) bo'yicha soni va daromad (so'm), jami; kutilayotgan to'lovlar; yangi foydalanuvchilar konversiyasi.",
        input_schema: ranged(),
        run: async (i) => {
          const d = await dash(i);
          return { range: d.range, sales: d.sales, payments: d.payments, conversion: d.conversion };
        },
      },
      {
        name: "getActiveUsers",
        description: "Faol foydalanuvchilar (DAU/WAU/MAU), ro'yxatdan o'tganlar, markaz va o'zi kelgan foydalanuvchilar, sessiyalar, qurilmalar.",
        input_schema: ranged(),
        run: async (i) => {
          const d = await dash(i);
          return { range: d.range, active: d.active, registrations: d.registrations, userTypes: d.userTypes, sessions: d.sessions, devices: d.devices };
        },
      },
      {
        name: "getTopWrongQuestions",
        description: "Eng ko'p xato qilingan savollar (matni, mavzusi, javoblar soni, xato foizi).",
        input_schema: ranged({ limit: { type: "integer", description: "1..20" } }),
        run: async (i) => {
          const d = await dash(i);
          const limit = Math.max(1, Math.min(20, Number(i.limit) || 10));
          return { range: d.range, questions: d.topWrong.slice(0, limit) };
        },
      },
      {
        name: "getTopicStats",
        description: "Mavzular: urinishlar, o'rtacha foiz, o'tish ulushi (98%), tugatilmagan testlar; 98% qoidasi bo'yicha umumiy o'tish.",
        input_schema: ranged(),
        run: async (i) => {
          const d = await dash(i);
          return { range: d.range, topics: d.mostSolved, abandoned: d.abandoned, passRate: d.passRate };
        },
      },
      {
        name: "getFunnel",
        description: "Kunlar bo'yicha voronka (butun vaqt): kunni boshlagan va to'liq o'tgan foydalanuvchilar, markaz/o'zi kelganlar alohida.",
        input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
        run: async () => (await dash({ range: "30d" })).funnel,
      },
    ];
  }

  /** "Statistikadan so'rash": javob va qaysi funksiyalar (manbalar) ishlatilgani. */
  async ask(admin: AdminUser, ip: string, question: string) {
    const result = await this.ai.withTools({ feature: "ask", system: ASK_SYSTEM, question: question.trim(), tools: this.tools(), meta: { adminId: admin.id }, maxTurns: 5 });
    await this.audit.log(admin, ip, { action: "ai.stats_question", entityType: "ai", entityId: "stats", after: { calls: result.calls.map((c) => c.name) } });
    return { answer: result.text, sources: result.calls };
  }

  /** "AI xarajatlari": shu oy, jami, importlar va o'quvchi tahlili alohida; oxirgi xatolar. */
  async costs() {
    const since = monthStart(Date.now());
    const [byFeature, total, failures, budget, recentFailures] = await Promise.all([
      this.prisma.aiUsage.groupBy({ by: ["feature"], where: { createdAt: { gte: since } }, _sum: { costUsd: true }, _count: { _all: true } }),
      this.prisma.aiUsage.aggregate({ _sum: { costUsd: true }, _count: { _all: true } }),
      this.prisma.aiUsage.count({ where: { createdAt: { gte: rangeStart("7d") }, ok: false } }),
      this.ai.budget(),
      this.prisma.aiUsage.findMany({ where: { ok: false }, orderBy: { createdAt: "desc" }, take: 5, select: { feature: true, error: true, createdAt: true } }),
    ]);
    const sum = (pred: (f: string) => boolean) => byFeature.filter((r) => pred(r.feature)).reduce((a, r) => a + (r._sum.costUsd ?? 0), 0);
    const imports = sum((f) => f.startsWith("import."));
    const student = sum((f) => f === "student");
    return {
      budget,
      month: {
        since,
        total: sum(() => true),
        imports,
        student,
        other: sum((f) => !f.startsWith("import.") && f !== "student"),
        byFeature: byFeature.map((r) => ({ feature: r.feature, costUsd: r._sum.costUsd ?? 0, calls: r._count._all })).sort((a, b) => b.costUsd - a.costUsd),
      },
      allTime: { total: total._sum.costUsd ?? 0, calls: total._count._all },
      failuresLast7d: failures,
      // Xato matnida kalit bo'lmaydi (SDK xabari); baribir qisqartiriladi.
      recentFailures: recentFailures.map((f) => ({ feature: f.feature, error: f.error?.slice(0, 160) ?? null, createdAt: f.createdAt })),
      configured: this.ai.configured(),
    };
  }
}
