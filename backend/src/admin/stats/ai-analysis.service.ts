import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AI_MODEL, AiService } from "../../ai/ai.service";
import type { AdminUser } from "../admin-request";
import { AuditService } from "../audit.service";
import { StatsService } from "./stats.service";

const SYSTEM = `Sen PravaTayyor (haydovchilik guvohnomasi imtihoniga tayyorlov kursi, "6+1 kun") platformasining tahlilchisisan.
Senga faqat YIG'MA statistika (JSON) beriladi — shaxsiy ma'lumot yo'q. Javobni o'zbek tilida (lotin yozuvi), qisqa va aniq yoz.
Faqat berilgan statistikaga tayan: unda yo'q raqam yoki faktni o'ylab topma; ma'lumot yetarli bo'lmasa, shuni ochiq ayt.
Markdown ishlat: qisqa sarlavhalar va ro'yxatlar.`;

const REPORT_PROMPT = `Quyidagi statistika asosida hisobot yoz. Bo'limlar:
1. Foydalanish darajasi (DAU/WAU/MAU, sessiya vaqti, qurilmalar).
2. Foydalanuvchilar: markaz o'quvchilari (userTypes.center — to'lov qilmaydi, admin qo'shadi) va yangi foydalanuvchilar (userTypes.self) alohida; umumiy son; yangi foydalanuvchilarning to'lov konversiyasi.
3. Qayerda tashlab ketishyapti (kunlar voronkasi — center/self alohida, tugatilmagan testlar).
4. Qaysi mavzu va savollar qiyin (eng ko'p xato).
5. Aniq takliflar (3–6 ta, har biri amalga oshirsa bo'ladigan qadam).`;

@Injectable()
export class AiAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly stats: StatsService,
    private readonly audit: AuditService,
  ) {}

  configured(): boolean {
    return this.ai.configured();
  }

  list() {
    return this.prisma.aiReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, kind: true, periodDays: true, createdAt: true, model: true, inputTokens: true, outputTokens: true },
    });
  }

  async get(id: string) {
    const report = await this.prisma.aiReport.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
    if (!report) throw new NotFoundException("Hisobot topilmadi");
    return report;
  }

  /** Yangi hisobot (tugma yoki haftalik cron). */
  async generate(kind: "manual" | "weekly", admin: AdminUser | null, ip: string | null) {
    const range = kind === "weekly" ? "7d" : "30d";
    const stats = await this.stats.dashboard(range);
    const result = await this.ai.text(SYSTEM, [{ role: "user", content: `${REPORT_PROMPT}\n\nStatistika (${range}):\n${JSON.stringify(stats)}` }]);
    const report = await this.prisma.aiReport.create({
      data: {
        kind,
        periodDays: range === "7d" ? 7 : 30,
        stats: JSON.parse(JSON.stringify(stats)) as Prisma.InputJsonValue,
        content: result.text,
        model: AI_MODEL,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        createdById: admin?.id ?? null,
      },
    });
    await this.audit.log(admin, ip, { action: kind === "weekly" ? "ai.weekly_report" : "ai.report_created", entityType: "ai", entityId: report.id });
    return report;
  }

  /** Hisobot bo'yicha savol — javob faqat shu hisobotdagi statistikaga asoslanadi. */
  async ask(admin: AdminUser, ip: string, reportId: string, question: string) {
    const report = await this.get(reportId);
    if (!question.trim()) throw new BadRequestException("Savol bo'sh");
    const history = report.messages.slice(-10).map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content }));
    const result = await this.ai.text(SYSTEM + "\nSavollarga faqat quyidagi statistika va hisobot asosida javob ber.", [
      { role: "user", content: `Statistika:\n${JSON.stringify(report.stats)}\n\nHisobot:\n${report.content}` },
      { role: "assistant", content: "Tushunarli. Savolingizni bering." },
      ...history,
      { role: "user", content: question.trim() },
    ]);
    await this.prisma.aiReportMessage.createMany({
      data: [
        { reportId, role: "user", content: question.trim(), adminId: admin.id },
        { reportId, role: "assistant", content: result.text },
      ],
    });
    await this.audit.log(admin, ip, { action: "ai.question", entityType: "ai", entityId: reportId });
    return this.get(reportId);
  }
}
