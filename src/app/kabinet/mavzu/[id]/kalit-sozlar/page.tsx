"use client";

// Mavzuning "Kalit so'zlar" bo'limi: barcha test savollari kalit so'zlari
// (savol kaliti — sariq, javob kaliti — yashil) bilan, qidiruv, "Javoblarni
// berkitish" rejimi va har savolga "Tanishdim" belgisi. Test barcha savollar
// bilan tanishilgach ochiladi (backend: 403 KEYWORDS_NOT_REVIEWED). Ma'lumotlar
// va progress — faqat backend'dan; kirish huquqi video sharti bilan bir xil.
// Yangi oqim (topicFlowGatingEnabled): pastdagi "Tanishib chiqdim" tugmasi ro'yxat
// OXIRIGACHA aylantirilgandagina yoqiladi; bosilgach test ochiladi (backend ham tekshiradi).

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { ArrowLeftIcon, CheckCircle2Icon, KeyRoundIcon, ListChecksIcon, LockIcon, RotateCcwIcon, SearchIcon, SearchXIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { COURSE_TOPICS, testHref, topicDayNumber, topicPageHref } from "@/data/curriculum";
import { AppHeader } from "@/components/shared/AppHeader";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { HeaderMenu } from "@/components/shared/HeaderMenu";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { showToast } from "@/components/shared/Toast";
import { KeywordCard } from "@/components/keywords/KeywordCard";
import { getTopicKeywords, markKeywordsViewed, setKeywordReviewed, type KeywordCard as KeywordCardData } from "@/lib/api/keywords";
import { LESSON_LOCKED_CODE } from "@/lib/api/lessons";
import { ApiError } from "@/lib/api/session";
import type { Locale } from "@/lib/i18n/dictionary";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { getRegistration, getUnlockAll } from "@/lib/registration-store";
import { track } from "@/lib/analytics";

interface KeywordsPageProps {
  params: Promise<{ id: string }>;
}

type LoadStatus = "loading" | "ready" | "locked" | "error";

/** Qidiruv uchun: kichik harf, apostrof turlari olib tashlanadi, bo'shliqlar siqiladi. */
function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase().replace(/['‘’ʻʼ`]/g, "").replace(/\s+/g, " ").trim();
}

function searchableText(item: KeywordCardData, locale: Locale): string {
  return normalizeSearch(
    [
      item.text,
      item.correctAnswer,
      item.keywords?.question?.text,
      item.keywords?.answer?.text,
    ]
      .map((text) => (text ? localize(text, locale) : ""))
      .join(" "),
  );
}

export default function KeywordsPage({ params }: KeywordsPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { locale, t } = useLocale();
  const labels = t.keywords.page;
  const topic = COURSE_TOPICS.find((item) => item.id === id);
  if (!topic?.testSlug) notFound();
  const testSlug = topic.testSlug;

  const [items, setItems] = useState<KeywordCardData[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [hideAnswers, setHideAnswers] = useState(false);
  // Yangi oqim holati (serverdan): majburiymi va "Tanishib chiqdim" bosilganmi.
  const [flow, setFlow] = useState<{ gated: boolean; viewed: boolean }>({ gated: false, viewed: false });
  const [reachedEnd, setReachedEnd] = useState(false);
  const [markingViewed, setMarkingViewed] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Kabinet bilan bir xil: ro'yxatdan o'tmagan / to'lovi faol bo'lmagan foydalanuvchi kirmaydi.
  // TODO(auth): real login qo'shilganda bu tekshiruv server sessiyasiga ko'chadi.
  useEffect(() => {
    const record = getRegistration();
    if (!record) router.replace("/");
    else if (record.status !== "active") router.replace("/tolov");
  }, [router]);

  useEffect(() => {
    track("keywords_view", { topicSlug: testSlug });
  }, [testSlug]);

  useEffect(() => {
    let cancelled = false;
    getTopicKeywords(testSlug)
      .then((list) => {
        if (cancelled) return;
        setItems(list.items);
        setFlow({ gated: Boolean(list.gated), viewed: Boolean(list.viewed) });
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(error instanceof ApiError && error.status === 403 && error.code === LESSON_LOCKED_CODE ? "locked" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [testSlug, reloadKey]);

  const positions = useMemo(() => new Map(items.map((item, index) => [item.id, index + 1])), [items]);
  const query = normalizeSearch(search);
  const visible = useMemo(
    () => (query ? items.filter((item) => searchableText(item, locale).includes(query)) : items),
    [items, query, locale],
  );
  const reviewedCount = items.filter((item) => item.reviewed).length;

  // Optimistik: belgi darhol o'zgaradi, server xato qaytarsa — qaytariladi.
  function toggleReviewed(item: KeywordCardData) {
    const next = !item.reviewed;
    const apply = (value: boolean) =>
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, reviewed: value } : i)));
    apply(next);
    setKeywordReviewed(testSlug, item.id, next)
      .then((res) => {
        if (next && res.total > 0 && res.reviewedCount === res.total) showToast({ tone: "success", message: labels.allReviewed });
      })
      .catch(() => {
        apply(!next);
        showToast({ tone: "danger", message: labels.reviewError });
      });
  }

  const percent = items.length ? Math.round((reviewedCount / items.length) * 100) : 0;
  // Admin hamma narsani ochib qo'ygan o'quvchi — test tanishib chiqmasdan ham ochiq.
  const [unlockAll, setUnlockAll] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnlockAll(getUnlockAll());
  }, []);
  const allReviewed = reviewedCount === items.length;
  const fullList = !query && visible.length === items.length;
  // Ro'yxat oxiri ko'rindi (qidiruvsiz, to'liq ro'yxatda) — "Tanishib chiqdim" yoqiladi.
  const needsEnd = status === "ready" && flow.gated && !flow.viewed && items.length > 0;
  useEffect(() => {
    if (!needsEnd || !fullList || reachedEnd) return;
    const el = endRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setReachedEnd(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [needsEnd, fullList, reachedEnd]);

  async function confirmViewed() {
    if (markingViewed || !reachedEnd) return;
    setMarkingViewed(true);
    try {
      const res = await markKeywordsViewed(testSlug);
      setFlow({ gated: Boolean(res.gated), viewed: Boolean(res.viewed) });
      showToast({ tone: "success", message: labels.flow.done });
    } catch {
      showToast({ tone: "danger", message: labels.flow.error });
    } finally {
      setMarkingViewed(false);
    }
  }
  // Mavzuda savollar bor, lekin birortasida kalit so'z yo'q (masalan, 2-kun 6-mavzu).
  const topicHasNoKeywords = items.length > 0 && items.every((item) => !item.keywords);
  const title = localize(topic.title, locale);

  return (
    <MotionConfig reducedMotion="user">
      <AppHeader>
        <Link
          href={topicPageHref(topic)}
          aria-label={labels.backToTopic}
          title={labels.backToTopic}
          className={buttonClasses({ variant: "secondary", size: "icon", className: "size-11 md:size-10" })}
        >
          <ArrowLeftIcon className="size-4.5" />
        </Link>
        <p className="min-w-0 flex-1 truncate font-mono text-[0.65rem] font-semibold text-brand uppercase sm:text-xs sm:tracking-wide">
          {t.kabinet.topicPage.dayTopic(topicDayNumber(topic), topic.order)}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher />
            <ThemeToggle className="size-10" />
          </div>
          <HeaderMenu label={t.kabinet.header.menu} className="md:hidden" />
        </div>
      </AppHeader>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand uppercase">
            <KeyRoundIcon className="size-4" aria-hidden="true" />
            {labels.eyebrow}
          </p>
          <h1 className="mt-1.5 font-display text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
          {status === "ready" && items.length > 0 && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{labels.intro}</p>
          )}
        </div>

        {status === "locked" && (
          <Card className="flex flex-col items-center gap-4 p-8 text-center sm:p-10">
            <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
              <LockIcon className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">{labels.lockedTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{labels.lockedDesc}</p>
            </div>
            <Link href={topicPageHref(topic)} className={buttonClasses({ variant: "primary", size: "md" })}>
              {labels.goToVideo}
            </Link>
          </Card>
        )}

        {status === "error" && (
          <Card role="alert" className="flex flex-col items-center gap-4 p-8 text-center sm:p-10">
            <span className="flex size-14 items-center justify-center rounded-full bg-danger/15 text-danger">
              <TriangleAlertIcon className="size-6" />
            </span>
            <p className="font-display text-lg font-bold text-foreground">{labels.loadError}</p>
            <Button
              onClick={() => {
                setStatus("loading");
                setReloadKey((k) => k + 1);
              }}
            >
              <RotateCcwIcon className="size-4" />
              {labels.retry}
            </Button>
          </Card>
        )}

        {status === "loading" && (
          <div aria-busy="true" className="flex flex-col gap-4">
            <span className="sr-only">{t.testSession.loading}</span>
            <div className="skeleton-shimmer h-24 rounded-2xl" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-72 rounded-2xl" />
            ))}
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <Card className="flex flex-col items-center gap-3 p-8 text-center sm:p-10">
            <h2 className="font-display text-lg font-bold text-foreground">{labels.emptyTitle}</h2>
            <p className="text-sm text-muted-foreground">{labels.emptyDesc}</p>
          </Card>
        )}

        {status === "ready" && items.length > 0 && (
          <>
            {/* Kompyuterda: sarlavha ostiga yopishgan TO'Q (shaffof emas) chiziq — pastdagi kartalar
                uning ostiga to'liq kirib yo'qoladi, oradan ko'rinib xalaqit bermaydi. */}
            <div className="md:sticky md:top-[calc(4rem+env(safe-area-inset-top,0px)+var(--reset-banner-h,0px))] md:z-20 md:-mx-6 md:-mt-3 md:bg-background md:px-6 md:py-3 md:after:pointer-events-none md:after:absolute md:after:inset-x-0 md:after:top-full md:after:h-5 md:after:bg-gradient-to-b md:after:from-background md:after:to-transparent">
              <Card className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={items.length}
                    aria-valuenow={reviewedCount}
                    aria-label={labels.progressAria}
                    className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-500",
                        reviewedCount === items.length ? "bg-success" : "bg-gradient-to-r from-brand to-brand-2",
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums sm:text-sm" aria-live="polite">
                    {labels.progress(reviewedCount, items.length)}
                  </span>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="relative block flex-1">
                    <span className="sr-only">{labels.searchLabel}</span>
                    <SearchIcon
                      className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={labels.searchPlaceholder}
                      maxLength={100}
                      className="h-11 w-full rounded-full border border-border bg-surface pr-10 pl-10 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        aria-label={labels.clearSearch}
                        className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <XIcon className="size-4" />
                      </button>
                    )}
                  </label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hideAnswers}
                    onClick={() => setHideAnswers((v) => !v)}
                    className="inline-flex min-h-11 items-center justify-between gap-3 rounded-full border border-border px-4 text-sm font-semibold text-foreground outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand sm:justify-start"
                  >
                    {labels.hideAnswers}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                        hideAnswers ? "bg-brand" : "bg-foreground/15",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow transition-transform",
                          hideAnswers && "translate-x-4",
                        )}
                      />
                    </span>
                  </button>
                </div>
              </Card>
            </div>

            {topicHasNoKeywords && (
              <p
                role="status"
                className="flex items-center gap-2.5 rounded-2xl border border-dashed border-border-strong bg-foreground/[0.03] px-4 py-3 text-sm font-medium text-muted-foreground"
              >
                <KeyRoundIcon className="size-4 shrink-0" aria-hidden="true" />
                {labels.topicNone}
              </p>
            )}

            {visible.length === 0 ? (
              <Card className="flex flex-col items-center gap-4 p-8 text-center sm:p-10">
                <span className="flex size-14 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground">
                  <SearchXIcon className="size-6" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">{labels.noResultsTitle}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{labels.noResultsDesc}</p>
                </div>
                <Button variant="secondary" onClick={() => setSearch("")}>
                  <XIcon className="size-4" />
                  {labels.clearSearch}
                </Button>
              </Card>
            ) : (
              <section aria-label={labels.title} className="flex flex-col gap-4">
                {visible.map((item) => (
                  <KeywordCard
                    // Rejim almashganda ochilgan javoblar qayta yopiladi.
                    key={`${item.id}:${hideAnswers}`}
                    item={item}
                    position={positions.get(item.id) ?? 0}
                    hideAnswers={hideAnswers}
                    onToggleReviewed={() => toggleReviewed(item)}
                  />
                ))}
              </section>
            )}

            {/* Ro'yxat oxiri — "Tanishib chiqdim" shu ko'ringandagina yoqiladi. */}
            <div ref={endRef} aria-hidden="true" className="h-px" data-testid="keywords-end" />

            {flow.gated && !unlockAll ? (
              flow.viewed ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p role="status" className="flex items-center gap-2 text-sm font-semibold text-success" data-testid="keywords-viewed-done">
                    <CheckCircle2Icon className="size-4.5" aria-hidden="true" />
                    {labels.flow.done}
                  </p>
                  <Link href={testHref(testSlug)} className={buttonClasses({ variant: "primary", size: "lg" })} data-testid="keywords-start-test">
                    <ListChecksIcon className="size-4.5" />
                    {labels.startTest}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p role="status" className="text-sm font-medium text-muted-foreground" data-testid="keywords-viewed-hint">
                    {reachedEnd ? labels.flow.pressHint : fullList ? labels.flow.scrollHint : labels.flow.searchHint}
                  </p>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title={labels.flow.lockedHint}
                      className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}
                      data-testid="keywords-start-test"
                    >
                      <LockIcon className="size-4.5" />
                      {labels.startTest}
                    </button>
                    <Button
                      size="lg"
                      className="w-full sm:w-auto"
                      onClick={confirmViewed}
                      disabled={!reachedEnd || markingViewed}
                      aria-disabled={!reachedEnd || markingViewed}
                      data-testid="keywords-viewed"
                    >
                      <CheckCircle2Icon className="size-4.5" />
                      {markingViewed ? labels.flow.saving : labels.flow.button}
                    </Button>
                  </div>
                </div>
              )
            ) : allReviewed || unlockAll ? (
              <div className="flex flex-col items-center gap-3 text-center">
                {allReviewed && (
                  <p role="status" className="flex items-center gap-2 text-sm font-semibold text-success">
                    <CheckCircle2Icon className="size-4.5" aria-hidden="true" />
                    {labels.allReviewed}
                  </p>
                )}
                <Link
                  href={testHref(testSlug)}
                  className={buttonClasses({ variant: "primary", size: "lg" })}
                  data-testid="keywords-start-test"
                >
                  <ListChecksIcon className="size-4.5" />
                  {labels.startTest}
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <p role="status" className="text-sm font-medium text-muted-foreground">
                  {labels.startLocked(items.length - reviewedCount)}
                </p>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className={buttonClasses({ variant: "secondary", size: "lg" })}
                  data-testid="keywords-start-test"
                >
                  <LockIcon className="size-4.5" />
                  {labels.startTest}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </MotionConfig>
  );
}
