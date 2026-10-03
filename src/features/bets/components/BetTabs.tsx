"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import type { BetsTab } from "../types";

const TABS: BetsTab[] = ["open", "settled"];

/**
 * Open / Settled — the contract's own filter on My bets. No counts: the list
 * is paged and carries no totals (contract request 007).
 */
export function BetTabs({
  value,
  onChange,
}: {
  value: BetsTab;
  onChange: (tab: BetsTab) => void;
}) {
  const t = useTranslation();

  const label: Record<BetsTab, string> = {
    open: t.t("bets.tabOpen"),
    settled: t.t("bets.tabSettled"),
  };

  return (
    <div className="border-divider grid grid-cols-2 border-b">
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          aria-pressed={tab === value}
          onClick={() => onChange(tab)}
          className={cn(
            "font-display flex h-[46px] cursor-pointer items-center justify-center border-b-2 bg-transparent text-sm",
            tab === value
              ? "border-accent text-text"
              : "text-muted hover:text-text border-transparent",
          )}
        >
          {label[tab]}
        </button>
      ))}
    </div>
  );
}
