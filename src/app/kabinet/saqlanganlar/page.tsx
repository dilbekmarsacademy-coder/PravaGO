"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import {
  ArrowLeftIcon,
  BookmarkIcon,
  ChevronDownIcon,
  ListChecksIcon,
  RotateCcwIcon,
  SearchIcon,
  SearchXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/shared/AppHeader";
import { Button, buttonClasses } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { HeaderMenu } from "@/components/shared/HeaderMenu";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { SavedQuestionCard, type SavedViewMode } from "@/components/saved/SavedQuestionCard";
import { getSavedList, type SavedItem, type SavedSort } from "@/lib/api/saved";
import { localize } from "@/lib/i18n/localized";
import { useLocale } from "@/lib/i18n/useLocale";
import { getRegistration } from "@/lib/registration-store";
import { SAVED_PAGE_HREF, setSavedWithFeedback } from "@/lib/saved/actions";
import { topicBySlug } from "@/lib/saved/format";
import { loadSavedCount, useSavedState } from "@/lib/saved/store";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type ListStatus = "loading" | "ready" | "error";

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SavedPage() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const labels = t.saved.page;
  const { count } = useSavedState();

  const [topicSlug, setTopicSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SavedSort>("new");
  const [mode, setMode] = useState<SavedViewMode>("view");
  const query = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);

  const [items, setItems] = useState<SavedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<ListStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [now, setNow] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  // Eskirgan javoblarni tashlab yuborish uchun (filtr tez o'zgarganda).
  const requestId = useRef(0);

  useEffect(() => {
    if (!getRegistration()) router.replace("/");
  }, [router]);

  useEffect(() => {
    loadSavedCount({ force: true });
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    // Filtr o'zgardi — yangi ro'yxat yuklanguncha skelet ko'rinadi.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("loading");
    setMoreError(false);
    // `lang` — qidiruv qaysi til matni bo'yicha bo'lishi uchun (matnlar uch tilda keladi).
    getSavedList({ lang: locale, topicSlug, q: query, sort, limit: PAGE_SIZE })
      .then((page) => {
        if (id !== requestId.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setNow(Date.now());
        setStatus("ready");
      })
      .catch(() => {
        if (id === requestId.current) setStatus("error");
      });
  }, [locale, topicSlug, query, sort, reloadKey]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    setMoreError(false);
    getSavedList({ lang: locale, topicSlug, q: query, sort, cursor: nextCursor, limit: PAGE_SIZE })
      .then((page) => {
        if (id !== requestId.current) return;
        setItems((prev) => {
          const seen = new Set(prev.map((item) => item.questionId));
          return [...prev, ...page.items.filter((item) => !seen.has(item.questionId))];
        });
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        if (id === requestId.current) setMoreError(true);
      })
      .finally(() => setLoadingMore(false));
  }, [nextCursor, loadingMore, locale, topicSlug, query, sort]);

  // Infinite scroll: ro'yxat oxiriga yaqinlashganda keyingi sahifa. Tugma — zaxira.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor || moreError) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { rootMargin: "600px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, moreError, loadMore]);

  function removeItem(item: SavedItem) {
    const index = items.findIndex((i) => i.questionId === item.questionId);
    const restore = () =>
      setItems((prev) => {
        if (prev.some((i) => i.questionId === item.questionId)) return prev;
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, item);
        return next;
      });
    setItems((prev) => prev.filter((i) => i.questionId !== item.questionId));
    setSavedWithFeedback(
      item.questionId,
      false,
      { topicSlug: item.topicSlug, sourceMode: item.sourceMode, attemptId: item.attemptId ?? undefined },
      t,
      { note: item.note, onUndo: restore, onRollback: restore },
    );
  }

  function updateNote(questionId: string, note: string | null) {
    setItems((prev) => prev.map((i) => (i.questionId === questionId ? { ...i, note } : i)));
  }

  const topics = useMemo(
    () =>
      (count?.byTopic ?? [])
        .map((group) => {
          const topic = topicBySlug(group.topicSlug);
          return {
            slug: group.topicSlug,
            count: group.count,
            number: topic?.number ?? Number.MAX_SAFE_INTEGER,
            title: topic ? localize(topic.title, locale) : group.topicSlug,
            short: topic ? t.kabinet.topic.testNo(topic.number) : group.topicSlug,
          };
        })
        .sort((a, b) => a.number - b.number),
    [count, locale, t],
  );

  const total = count?.total ?? null;
  const filtersActive = topicSlug !== null || query !== "";
  const clearFilters = () => {
    setTopicSlug(null);
    setSearch("");
  };
  const practiceHref = `${SAVED_PAGE_HREF}/test${topicSlug ? `?topic=${topicSlug}` : ""}`;
  const nothingSaved = total === 0 || (status === "ready" && items.length === 0 && !filtersActive);

  return (
    <MotionConfig reducedMotion="user">
      <AppHeader width="wide">
        <Link
          href="/kabinet"
          aria-label={t.kabinet.backToKabinet}
          title={t.kabinet.backToKabinet}
          className={buttonClasses({ variant: "secondary", size: "icon", className: "md:size-10" })}
        >
          <ArrowLeftIcon className="size-4.5" />
        </Link>
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="truncate font-display text-base font-bold text-foreground sm:text-lg">{t.saved.title}</h1>
          {total !== null && (
            <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums sm:text-sm">
              {t.saved.total(total)}
            </span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher />
            <ThemeToggle className="size-10" />
          </div>
          <HeaderMenu label={t.kabinet.header.menu} className="md:hidden" />
        </div>
      </AppHeader>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-8">
        {nothingSaved && status !== "error" ? (
          <EmptyState />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-8">
            {/* ---- Filtrlar: telefonda yuqorida (chip'lar gorizontal scroll), desktopda chap panel ---- */}
            <aside aria-label={labels.filtersTitle} className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
              <label className="relative block">
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
                    aria-label={labels.clearFilters}
                    className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <XIcon className="size-4" />
                  </button>
                )}
              </label>

              <div role="group" aria-label={labels.topicLabel} className="min-w-0">
                <p className="mb-2 hidden font-mono text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground uppercase lg:block">
                  {labels.topicLabel}
                </p>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
                  <TopicChip active={topicSlug === null} onClick={() => setTopicSlug(null)} count={total ?? undefined}>
                    {labels.allTopics}
                  </TopicChip>
                  {topics.map((topic) => (
                    <TopicChip
                      key={topic.slug}
                      active={topicSlug === topic.slug}
                      onClick={() => setTopicSlug(topic.slug)}
                      count={topic.count}
                      title={topic.title}
                    >
                      <span className="lg:hidden">{topic.short}</span>
                      <span className="hidden truncate lg:inline">{topic.title}</span>
                    </TopicChip>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
                <SegmentedControl
                  label={labels.modeLabel}
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "view", label: labels.modeView },
                    { value: "review", label: labels.modeReview },
                  ]}
                />
                <label className="relative ml-auto flex h-11 items-center lg:ml-0">
                  <span className="sr-only">{labels.sortLabel}</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value === "old" ? "old" : "new")}
                    className="h-full w-full cursor-pointer appearance-none rounded-full border border-border bg-transparent pr-9 pl-4 text-sm font-semibold text-foreground outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <option value="new" className="bg-background">
                      {labels.sortNew}
                    </option>
                    <option value="old" className="bg-background">
                      {labels.sortOld}
                    </option>
                  </select>
                  <ChevronDownIcon
                    className="pointer-events-none absolute right-3.5 size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </label>
              </div>

              <Link
                href={practiceHref}
                aria-disabled={total === 0}
                tabIndex={total === 0 ? -1 : undefined}
                className={buttonClasses({
                  variant: "primary",
                  size: "md",
                  className: cn("w-full", total === 0 && "pointer-events-none opacity-50"),
                })}
              >
                <ListChecksIcon className="size-4" />
                {topicSlug ? labels.practiceTopic : labels.practice}
              </Link>
            </aside>

            {/* ---- Ro'yxat ---- */}
            <section aria-label={t.saved.title} aria-busy={status === "loading"} className="flex min-w-0 flex-col gap-4 lg:max-w-[900px]">
              {status === "loading" && <ListSkeleton label={labels.loading} />}

              {status === "error" && (
                <Card role="alert" className="flex flex-col items-center gap-4 p-8 text-center sm:p-10">
                  <span className="flex size-14 items-center justify-center rounded-full bg-danger/15 text-danger">
                    <TriangleAlertIcon className="size-6" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold text-foreground">{labels.errorTitle}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{labels.errorDesc}</p>
                  </div>
                  <Button onClick={() => setReloadKey((k) => k + 1)}>
                    <RotateCcwIcon className="size-4" />
                    {labels.retry}
                  </Button>
                </Card>
              )}

              {status === "ready" && items.length === 0 && filtersActive && (
                <Card className="flex flex-col items-center gap-4 p-8 text-center sm:p-10">
                  <span className="flex size-14 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground">
                    <SearchXIcon className="size-6" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold text-foreground">{labels.noResultsTitle}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{labels.noResultsDesc}</p>
                  </div>
                  <Button variant="secondary" onClick={clearFilters}>
                    <XIcon className="size-4" />
                    {labels.clearFilters}
                  </Button>
                </Card>
              )}

              {status === "ready" &&
                items.map((item) => (
                  <SavedQuestionCard
                    // Rejim almashganda takrorlash holati tozalanadi.
                    key={`${item.questionId}:${mode}`}
                    item={item}
                    mode={mode}
                    now={now}
                    onRemove={() => removeItem(item)}
                    onNoteSaved={(note) => updateNote(item.questionId, note)}
                  />
                ))}

              {status === "ready" && nextCursor && (
                <div ref={sentinelRef} className="flex flex-col items-center gap-3 py-2">
                  {loadingMore && <ListSkeleton label={labels.loading} count={1} />}
                  {!loadingMore && (
                    <Button variant="secondary" onClick={loadMore}>
                      {moreError && <RotateCcwIcon className="size-4" />}
                      {moreError ? labels.retry : labels.loadMore}
                    </Button>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </MotionConfig>
  );
}

function TopicChip({
  active,
  onClick,
  count,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "flex h-11 min-w-0 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand lg:h-auto lg:min-h-11 lg:justify-between lg:rounded-xl lg:py-2 lg:text-left lg:whitespace-normal",
        active
          ? "border-brand bg-brand/10 text-foreground"
          : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      <span className="min-w-0 lg:line-clamp-2">{children}</span>
      {count !== undefined && (
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 font-mono text-xs tabular-nums",
            active ? "bg-brand text-brand-foreground" : "bg-foreground/5",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="flex h-11 rounded-full border border-border p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-full px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
            value === option.value ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState() {
  const { t } = useLocale();
  const labels = t.saved.page;
  return (
    <Card className="relative mx-auto flex max-w-lg flex-col items-center gap-5 overflow-hidden p-8 text-center sm:p-12">
      <div
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-brand/20 blur-[80px]"
        aria-hidden="true"
      />
      <span className="glow-orange relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-brand-foreground">
        <BookmarkIcon className="size-7" />
      </span>
      <div className="relative">
        <h2 className="font-display text-xl font-bold text-foreground">{labels.emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{labels.emptyDesc}</p>
      </div>
      <Link href="/kabinet" className={buttonClasses({ variant: "primary", size: "md", className: "relative" })}>
        {labels.emptyCta}
      </Link>
    </Card>
  );
}

function ListSkeleton({ label, count = 2 }: { label: string; count?: number }) {
  return (
    <div className="flex w-full flex-col gap-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="flex flex-col gap-4 p-4 sm:p-6" aria-hidden="true">
          <div className="skeleton-shimmer h-5 w-2/5 rounded-full" />
          <div className="skeleton-shimmer h-6 w-4/5 rounded-lg" />
          <div className="skeleton-shimmer aspect-[16/9] max-h-72 rounded-md" />
          {Array.from({ length: 3 }).map((__, j) => (
            <div key={j} className="skeleton-shimmer h-14 rounded-2xl" />
          ))}
        </Card>
      ))}
    </div>
  );
}
