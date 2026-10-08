"use client";

import { CountBadge } from "@/components/ui/CountBadge";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useBetSlipStore, useSlipCounts } from "../stores/bet-slip.store";

/**
 * Slip 1 · Slip 2 · Slip 3 (F3c, the user's decision of 2026-10-08): three
 * separate slips a customer builds and switches between, each with its count.
 * The one pressed is on screen: taps go into it, and its picks are the ones
 * the prices show as picked. Shared by the player's slip and the kiosk's.
 */
export function SlipTabs() {
  const t = useTranslation();
  const active = useBetSlipStore((s) => s.active);
  const switchSlip = useBetSlipStore((s) => s.switchSlip);
  const counts = useSlipCounts();

  return (
    <div
      role="group"
      aria-label={t.t("betSlip.slipsAria")}
      className="grid grid-cols-3 gap-1.5 px-4 pt-2 pb-2.5"
    >
      {counts.map((count, n) => (
        <button
          key={n}
          type="button"
          aria-pressed={n === active}
          // "Slip 1, 2 selections": the badge's number never runs into the label.
          aria-label={t.t("betSlip.slipNAria", { n: n + 1, count })}
          onClick={() => switchSlip(n)}
          className="border-divider text-muted aria-pressed:border-accent aria-pressed:bg-raised aria-pressed:shadow-[inset_0_0_0_1px_var(--color-accent)] aria-pressed:text-text font-body flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-transparent text-[13px] font-bold"
        >
          {t.t("betSlip.slipN", { n: n + 1 })}
          {count > 0 && <CountBadge>{count}</CountBadge>}
        </button>
      ))}
    </div>
  );
}
