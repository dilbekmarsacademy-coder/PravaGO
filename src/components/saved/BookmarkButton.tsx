"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookmarkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/useLocale";

interface BookmarkButtonProps {
  saved: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Savolni saqlash tugmasi: bo'sh → aksent rang bilan to'lgan ikonka.
 * Saqlanganda kichik "pop" (prefers-reduced-motion'da o'chadi). 44×44 px.
 */
export function BookmarkButton({ saved, onToggle, className }: BookmarkButtonProps) {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const label = saved ? t.testSession.unbookmark : t.testSession.bookmark;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
        saved ? "bg-brand/10 text-brand hover:bg-brand/15" : "text-muted-foreground hover:bg-surface hover:text-foreground",
        className,
      )}
    >
      <motion.span
        // key almashganda animatsiya qayta ishga tushadi — faqat saqlanganda "pop".
        key={saved ? "on" : "off"}
        className="flex"
        initial={saved && !reduceMotion ? { scale: 0.6 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 14 }}
      >
        <BookmarkIcon className="size-5" fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      </motion.span>
    </button>
  );
}
