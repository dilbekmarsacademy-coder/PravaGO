import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AdminUser } from "../admin-request";
import { AuditService } from "../audit.service";
import { deviceLabel, deviceType } from "../../common/device";
import { PASS_PERCENT } from "../../common/rules";
import { LESSONS } from "../../lessons/lessons.config";
import { userSearch } from "../../payments/payments.service";
import { computeProgress, loadBestPercents, loadCourseTopics, type CourseTopic, type UserProgress } from "../progress";
import type { UsersQueryDto } from "./admin-users.dto";

/** Oxirgi 7 kunda faol bo'lgan — "faol". */
const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface AdminUserRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  examStatus: string | null;
  registeredAt: Date | null;
  lastActiveAt: Date | null;
  paymentStatus: string;
  active: boolean;
  siteAccessBlocked: boolean;
  blockedAt: Date | null;
  blockReason: string | null;
  progress: UserProgress;
}

/** Bir martada yopish/ochish mumkin bo'lgan foydalanuvchilar soni (DTO bilan bir xil). */
export const SITE_ACCESS_BULK_MAX = 200;

/** Admin panelda foydalanuvchi sahifasida ko'rsatiladigan oxirgi qurilmalar soni. */
const RECENT_DEVICES = 3;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private where(query: Pick<UsersQueryDto, "q" | "payment" | "activity" | "access">): Prisma.UserWhereInput {
    const since = new Date(Date.now() - ACTIVE_WINDOW_MS);
    const and: Prisma.UserWhereInput[] = [{ registeredAt: { not: null } }, { type: "SELF" }];
    if (query.q?.trim()) and.push(userSearch(query.q));
    if (query.payment === "paid") and.push({ paymentStatus: "PAID" });
    if (query.payment === "pending") and.push({ paymentStatus: "PENDING" });
    if (query.payment === "unpaid") and.push({ paymentStatus: { not: "PAID" } });
    if (query.activity === "active") and.push({ lastActiveAt: { gte: since } });
    if (query.activity === "inactive") and.push({ OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: since } }] });
    if (query.access === "blocked") and.push({ siteAccessBlocked: true });
    if (query.access === "open") and.push({ siteAccessBlocked: false });
    return { AND: and };
  }

  /** Filtrlangan BARCHA foydalanuvchilar progress bilan (saralash progress bo'yicha ham bo'lishi uchun). */
  private async rows(query: UsersQueryDto): Promise<AdminUserRow[]> {
    const users = await this.prisma.user.findMany({
      where: this.where(query),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        examStatus: true,
        registeredAt: true,
        lastActiveAt: true,
        paymentStatus: true,
        siteAccessBlocked: true,
        blockedAt: true,
        blockReason: true,
      },
      take: 20_000,
    });
    const topics = await loadCourseTopics(this.prisma);
    const best = await loadBestPercents(this.prisma, users.map((u) => u.id));
    const since = Date.now() - ACTIVE_WINDOW_MS;
    const rows: AdminUserRow[] = users.map((u) => ({
      ...u,
      active: Boolean(u.lastActiveAt && u.lastActiveAt.getTime() >= since),
      progress: computeProgress(topics, best.get(u.id)),
    }));
    const dir = query.dir === "asc" ? 1 : -1;
    const time = (d: Date | null) => d?.getTime() ?? 0;
    rows.sort((a, b) => {
      switch (query.sort) {
        case "name":
          return dir * `${a.firstName ?? ""} ${a.lastName ?? ""}`.localeCompare(`${b.firstName ?? ""} ${b.lastName ?? ""}`, "uz");
        case "progress":
          return dir * (a.progress.percent - b.progress.percent);
        case "lastActiveAt":
          return dir * (time(a.lastActiveAt) - time(b.lastActiveAt));
        default:
          return dir * (time(a.registeredAt) - time(b.registeredAt));
      }
    });
    return rows;
  }

  async list(query: UsersQueryDto) {
    const rows = await this.rows(query);
    const start = (query.page - 1) * query.pageSize;
    return { total: rows.length, page: query.page, pageSize: query.pageSize, items: rows.slice(start, start + query.pageSize) };
  }

  async csv(query: UsersQueryDto): Promise<string> {
    const rows = await this.rows(query);
    const status: Record<string, string> = { PAID: "To'lagan", PENDING: "Kutilmoqda", NONE: "To'lamagan" };
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      // CSV injection'dan himoya: formula bilan boshlanadigan qiymatlar.
      const safe = /^[=+\-@\t\r]/.test(s) && !/^\+998/.test(s) ? `'${s}` : s;
      return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const iso = (d: Date | null) => (d ? d.toISOString().replace("T", " ").slice(0, 16) : "");
    const lines = [
      ["Ism", "Familiya", "Telefon", "Ro'yxatdan o'tgan", "Oxirgi faollik", "To'lov holati", "Progress %", "O'tilgan kunlar"].join(";"),
      ...rows.map((r) =>
        [r.firstName, r.lastName, r.phone, iso(r.registeredAt), iso(r.lastActiveAt), status[r.paymentStatus] ?? r.paymentStatus, r.progress.percent, r.progress.passedDays.join(", ")]
          .map(cell)
          .join(";"),
      ),
    ];
    return `﻿${lines.join("\r\n")}\r\n`;
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        sessions: { orderBy: { createdAt: "desc" }, select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true } },
        payments: {
          orderBy: { createdAt: "desc" },
          include: { confirmedBy: { select: { login: true, name: true } }, createdBy: { select: { login: true, name: true } } },
        },
        lessonProgress: { select: { lessonId: true, completedAt: true, maxPosition: true } },
        keywordsViews: { select: { topicId: true } },
      },
    });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");

    const topics = await loadCourseTopics(this.prisma);
    const [attempts, reviews, wrong] = await Promise.all([
      // Joriy hafta natijalari (kabinetdagi bilan bir xil); oldingi haftalar — "Natijalar arxivi" panelida.
      this.prisma.topicTestAttempt.findMany({ where: { userId: id, archivedAt: null }, orderBy: { createdAt: "asc" }, select: { topicId: true, percent: true, createdAt: true } }),
      this.prisma.keywordReview.groupBy({ by: ["questionId"], where: { userId: id } }),
      this.prisma.answerLog.groupBy({
        by: ["questionId"],
        where: { userId: id, correct: false, archivedAt: null },
        _count: { _all: true },
        orderBy: { _count: { questionId: "desc" } },
        take: 10,
      }),
    ]);
    const best = new Map<string, number>();
    for (const a of attempts) best.set(a.topicId, Math.max(best.get(a.topicId) ?? 0, a.percent));
    const progress = computeProgress(topics, best);

    const reviewedIds = reviews.map((r) => r.questionId);
    const reviewedByTopic = new Map<string, number>();
    if (reviewedIds.length) {
      const qs = await this.prisma.question.findMany({ where: { id: { in: reviewedIds } }, select: { topicId: true } });
      for (const q of qs) reviewedByTopic.set(q.topicId, (reviewedByTopic.get(q.topicId) ?? 0) + 1);
    }
    const lessonsDone = new Map(user.lessonProgress.map((l) => [l.lessonId, l]));
    const viewedTopics = new Set(user.keywordsViews.map((v) => v.topicId));

    const topicResults = topics.map((t: CourseTopic) => {
      const own = attempts.filter((a) => a.topicId === t.id);
      const lesson = Object.prototype.hasOwnProperty.call(LESSONS, t.slug) ? lessonsDone.get(t.slug) : undefined;
      return {
        slug: t.slug,
        day: t.day,
        order: t.order,
        title: t.title,
        questionCount: t.questionCount,
        attempts: own.length,
        bestPercent: own.length ? Math.max(...own.map((a) => a.percent)) : null,
        lastPercent: own.length ? own[own.length - 1].percent : null,
        lastAttemptAt: own.length ? own[own.length - 1].createdAt : null,
        passed: own.some((a) => a.percent >= PASS_PERCENT),
        videoWatched: lesson ? lesson.completedAt !== null : null,
        keywordsReviewed: reviewedByTopic.get(t.id) ?? 0,
        keywordsViewed: viewedTopics.has(t.id),
      };
    });

    const wrongQuestions = wrong.length
      ? await this.prisma.question.findMany({
          where: { id: { in: wrong.map((w) => w.questionId) } },
          select: { id: true, text: true, textLatn: true, order: true, topic: { select: { slug: true, title: true } } },
        })
      : [];
    const wrongById = new Map(wrongQuestions.map((q) => [q.id, q]));

    return {
      id: user.id,
      type: user.type,
      login: user.login,
      isActive: user.isActive,
      centerAccess: user.centerAccess,
      unlockAll: user.unlockAll,
      siteAccessBlocked: user.siteAccessBlocked,
      blockedAt: user.blockedAt,
      blockReason: user.blockReason,
      topicFlowGatingEnabled: user.topicFlowGatingEnabled,
      weeklyResetExempt: user.weeklyResetExempt,
      progressResetAt: user.progressResetAt,
      lastLoginAt: user.lastLoginAt,
      lastDevice: user.lastDevice,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      age: user.age,
      examStatus: user.examStatus,
      preferredLanguage: user.preferredLanguage,
      registeredAt: user.registeredAt,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      paymentStatus: user.paymentStatus,
      accessGrantedAt: user.accessGrantedAt,
      subscription: user.subscriptionUnlimited || user.subscriptionUntil ? { tariff: user.subscriptionTariff, expiresAt: user.subscriptionUnlimited ? null : user.subscriptionUntil } : null,
      mentorUnassigned: (await this.prisma.subscription.count({ where: { userId: id, tariff: "MENTOR", revokedAt: null, mentorAssignedAt: null } })) > 0,
      progress,
      // Oxirgi kirilgan 3 ta qurilma (faqat ko'rinish; "bitta qurilma" qoidasi sessiyalarda alohida ishlaydi).
      devices: [...user.sessions]
        .sort((a, b) => (b.lastSeenAt ?? b.createdAt).getTime() - (a.lastSeenAt ?? a.createdAt).getTime())
        .slice(0, RECENT_DEVICES)
        .map((s) => ({
          id: s.id,
          type: deviceType(s.userAgent),
          label: s.userAgent ? deviceLabel(s.userAgent) : "Noma'lum (eski sessiya)",
          createdAt: s.createdAt,
          lastSeenAt: s.lastSeenAt,
          expired: s.expiresAt.getTime() <= Date.now(),
        })),
      payments: user.payments,
      topics: topicResults,
      mostWrong: wrong.flatMap((w) => {
        const q = wrongById.get(w.questionId);
        return q ? [{ questionId: q.id, order: q.order, topicSlug: q.topic.slug, topicTitle: q.topic.title, text: q.textLatn ?? q.text, wrongCount: w._count._all }] : [];
      }),
    };
  }

  /**
   * Butunlay o'chirish. Sessiyalar ham o'chadi — qurilmadagi eski token 401 oladi
   * va sayt yangi anonim sessiya ochadi. Audit'ga asosiy ma'lumot va to'lovlar yoziladi.
   */
  async setUnlockAll(admin: AdminUser, ip: string, id: string, enabled: boolean): Promise<{ id: string; unlockAll: boolean }> {
    const before = await this.prisma.user.findUnique({ where: { id }, select: { id: true, unlockAll: true } });
    if (!before) throw new NotFoundException("Foydalanuvchi topilmadi");
    const after = await this.prisma.user.update({ where: { id }, data: { unlockAll: enabled }, select: { id: true, unlockAll: true } });
    await this.audit.log(admin, ip, { action: "user.unlock_all", entityType: "user", entityId: id, before, after });
    return after;
  }

  /**
   * Saytni yopish / ochish (bitta yoki bir nechta foydalanuvchi). Faqat `User`
   * jadvalidagi o'quvchilarga tegadi — adminlar alohida jadvalda (`Admin`) va
   * o'quvchi sessiyasi bilan kirmaydi, shuning uchun admin o'zini yoki boshqa
   * adminni bu yerdan yopa olmaydi.
   *
   * Yopishda: markaz o'quvchisining yagona faol sessiyasi bekor qilinadi (ochilgach
   * qaytadan login qiladi); o'zi ro'yxatdan o'tganlarning qurilma sessiyalari
   * o'chirilmaydi (ular yagona kirish yo'li — o'chirilsa sayt yangi anonim sessiya
   * ochib, yopishni chetlab o'tardi), lekin har so'rovda 403 SITE_CLOSED oladi.
   * Natijalar, to'lovlar, haftalik yangilanish sozlamalari o'zgarmaydi.
   */
  async setSiteAccess(admin: AdminUser, ip: string, ids: string[], blocked: boolean, reason?: string) {
    const unique = [...new Set(ids)].slice(0, SITE_ACCESS_BULK_MAX);
    const blockReason = reason?.trim().slice(0, 300) || null;
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: unique } },
        select: { id: true, type: true, firstName: true, lastName: true, phone: true, login: true, siteAccessBlocked: true },
      });
      const changing = users.filter((u) => u.siteAccessBlocked !== blocked);
      if (changing.length) {
        await tx.user.updateMany({
          where: { id: { in: changing.map((u) => u.id) } },
          data: blocked
            ? { siteAccessBlocked: true, blockedAt: now, blockReason, activeSessionId: null }
            : { siteAccessBlocked: false, blockedAt: null, blockReason: null },
        });
        for (const u of changing) {
          await this.audit.log(
            admin,
            ip,
            {
              action: blocked ? "user.site_closed" : "user.site_opened",
              entityType: "user",
              entityId: u.id,
              before: { siteAccessBlocked: u.siteAccessBlocked },
              after: { siteAccessBlocked: blocked, ...(blocked ? { blockReason } : {}), type: u.type, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null, phone: u.phone, login: u.login, bulk: unique.length > 1 },
            },
            tx,
          );
        }
      }
      const found = new Set(users.map((u) => u.id));
      return {
        blocked,
        updated: changing.length,
        unchanged: users.length - changing.length,
        notFound: unique.filter((id) => !found.has(id)),
      };
    });
  }

  async remove(admin: AdminUser, ip: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        omit: { passwordHash: true },
        include: { payments: { select: { id: true, amount: true, status: true, method: true, note: true, createdAt: true, confirmedAt: true } } },
      });
      if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");
      // Analitikada userId FK emas — ichki ID'ni ham uzib qo'yamiz.
      await tx.analyticsEvent.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.user.delete({ where: { id } });
      await this.audit.log(admin, ip, { action: "user.deleted", entityType: "user", entityId: id, before: user }, tx);
    });
  }
}
