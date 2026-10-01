"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import type { BetCounts, BetsTab } from "../types";

const TABS: BetsTab[] = ["open", "settled", "won", "lost"];

/** Open / Settled / Won / Lost, each with how many are in it. */
export function BetTabs({
  value,
  counts,
  onChange,
}: {
  value: BetsTab;
  counts: BetCounts;
  onChange: (tab: BetsTab) => void;
}) {
  const t = useTranslation();

  const label: Record<BetsTab, string> = {
    open: t.t("bets.tabOpen"),
    settled: t.t("bets.tabSettled"),
    won: t.t("bets.tabWon"),
    lost: t.t("bets.tabLost"),
  };

  return (
    <div className="border-divider grid grid-cols-4 border-b">
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          aria-current={tab === value ? "true" : undefined}
          onClick={() => onChange(tab)}
          className={cn(
            "font-display flex h-[46px] cursor-pointer items-center justify-center gap-1.5 border-b-2 bg-transparent text-sm",
            tab === value
              ? "border-accent text-text"
              : "text-muted hover:text-text border-transparent",
          )}
        >
          {label[tab]}
          <span className="font-body text-muted text-[11px] font-medium">
            {counts[tab]}
          </span>
        </button>
      ))}
    </div>
  );
}
