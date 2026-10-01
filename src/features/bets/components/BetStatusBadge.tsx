"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import type { Bet } from "../types";
import { displayStatus } from "../types";

const TONE: Record<string, string> = {
  won: "bg-win-bg border-win text-win",
  lost: "bg-loss-bg border-loss text-loss",
  cashed: "bg-accent/15 border-accent text-accent",
  live: "bg-live border-live text-white",
  open: "border-accent text-accent bg-transparent",
};

/**
 * A ticket's state at a glance.
 *
 * Colour follows the one convention in the product — green won, red lost, accent
 * for anything still in play — and the word is there too, because colour alone
 * cannot carry a result.
 */
export function BetStatusBadge({ bet }: { bet: Bet }) {
  const t = useTranslation();
  const status = displayStatus(bet);

  const label = {
    open: t.t("bets.statusOpen"),
    live: t.t("bets.statusLive"),
    won: t.t("bets.statusWon"),
    lost: t.t("bets.statusLost"),
    cashed: t.t("bets.statusCashed"),
  }[status];

  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-[3px] text-[10px] font-bold tracking-[0.06em] whitespace-nowrap uppercase",
        TONE[status],
      )}
    >
      {label}
    </span>
  );
}

/** Marks each leg's own outcome beside it. */
export function LegDot({ status }: { status: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2.5 shrink-0 rounded-full border-[1.5px]",
        status === "void" && "border-muted border-dashed",
        status === "won" && "border-win bg-win",
        status === "lost" && "border-loss bg-loss",
        status === "live" && "border-accent bg-accent",
        status === "open" && "border-accent bg-transparent",
      )}
    />
  );
}
