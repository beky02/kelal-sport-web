"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import { STATUS_KEY } from "../lib/labels";
import type { LegResult, TicketStatus } from "../types";

const TONE: Record<TicketStatus, string> = {
  open: "border-accent text-accent bg-transparent",
  won: "bg-win-bg border-win text-win",
  paid: "bg-win-bg border-win text-win",
  lost: "bg-loss-bg border-loss text-loss",
  cashed_out: "bg-accent/15 border-accent text-accent",
  void: "border-divider text-muted bg-transparent",
  cancelled: "border-divider text-muted bg-transparent",
  expired: "border-divider text-muted bg-transparent",
};

/**
 * A ticket's state at a glance.
 *
 * Colour follows the one convention in the product — green won, red lost,
 * accent for anything still in play, muted for a bet that didn't stand — and
 * the word is there too, because colour alone cannot carry a result.
 */
export function BetStatusBadge({ status }: { status: TicketStatus }) {
  const t = useTranslation();
  return (
    <span
      className={cn(
        "label-caps rounded-full border px-2.5 py-[3px] whitespace-nowrap",
        TONE[status],
      )}
    >
      {t.t(STATUS_KEY[status])}
    </span>
  );
}

/** Marks each leg's own result beside it; the result is in words next to it. */
export function LegDot({ result }: { result: LegResult }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2.5 shrink-0 rounded-full border-[1.5px]",
        result === "open" && "border-accent bg-transparent",
        result === "win" && "border-win bg-win",
        result === "half_win" && "border-win bg-win-bg",
        result === "lose" && "border-loss bg-loss",
        result === "half_lose" && "border-loss bg-loss-bg",
        result === "void" && "border-muted border-dashed",
      )}
    />
  );
}
