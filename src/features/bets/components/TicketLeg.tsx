"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import type { Localized } from "@/types/common";
import { RESULT_KEY } from "../lib/labels";
import type { LegResult } from "../types";
import { LegDot } from "./BetStatusBadge";

/**
 * One leg of a ticket in full, drawn the same in My bets and on the public
 * check: market, pick, match, its result in words — or, while it is open and
 * its kick-off is known, the kick-off — and the odds taken.
 */
export function TicketLeg({
  leg,
  kickoff,
}: {
  leg: {
    market: Localized;
    pick: Localized;
    match: Localized;
    odds: string;
    result: LegResult;
  };
  /** The kick-off as text, for a leg that hasn't been played. */
  kickoff?: string;
}) {
  const t = useTranslation();
  return (
    <li className="border-divider grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2.5 border-b py-2.5">
      <LegDot result={leg.result} />
      <div className="min-w-0">
        <div className="text-muted text-[11px]">{t.pick(leg.market)}</div>
        <div className="font-semibold">{t.pick(leg.pick)}</div>
        <div className="text-muted text-[11px]">
          {t.pick(leg.match)} ·{" "}
          {leg.result === "open" && kickoff
            ? kickoff
            : t.t(RESULT_KEY[leg.result])}
        </div>
      </div>
      <span
        className={cn(
          "numeric font-bold",
          leg.result === "void" ? "text-muted" : "text-text",
        )}
      >
        {t.odds(leg.odds)}
      </span>
    </li>
  );
}
