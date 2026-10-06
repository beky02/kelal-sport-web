"use client";

import { memo, useCallback, useMemo } from "react";
import { Lock } from "lucide-react";
import { TeamCrest } from "@/components/ui/TeamCrest";
import {
  selectionFrom,
  useBetSlipStore,
  useEventHasSelection,
  useIsSelected,
} from "@/features/bet-slip/stores/bet-slip.store";
import type { BoardEvent } from "@/features/events/types";
import type { Market, Outcome } from "@/features/markets/types";
import { oddsAriaLabel } from "@/features/odds/lib/aria";
import { OddsButtonView } from "@/features/odds/components/OddsButtonView";
import { formatShortDate } from "@/lib/i18n/dates";
import { formatKickoff } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import type { Localized } from "@/types/common";

/**
 * One match on the kiosk's board (F8ca): when, who, and the 1X2 prices — the
 * market every row carries (double chance and total goals wait for contract
 * request 001). Memoised, and each price subscribes to its own selected
 * flag, as on the player's board, so a pick re-renders one button.
 */
function KioskEventRowImpl({ row }: { row: BoardEvent }) {
  const t = useTranslation();
  const { clock, calendar } = useLocale();
  const { event, markets } = row;
  const inSlip = useEventHasSelection(event.id);

  // Stable: a prop of every price below, and the name the slip shows.
  const eventName = useMemo<Localized>(
    () => ({
      en: `${event.home.name.en} – ${event.away.name.en}`,
      am: `${event.home.name.am} – ${event.away.name.am}`,
    }),
    [event.home.name, event.away.name],
  );
  const market = markets.matchResult;

  return (
    <li
      className={cn(
        "border-divider grid gap-3 border-t px-4 py-4 first:border-t-0 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-center",
        inSlip && "bg-sel-row",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {/* When it starts, East Africa Time (D7), as the player's row says it. */}
        <span className="text-muted numeric text-sm">
          {[
            formatShortDate(event.startDate, calendar),
            event.kickoff && formatKickoff(event.kickoff, t.lang, clock),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {[event.home, event.away].map((team) => (
          <span
            key={team.id}
            className="flex min-w-0 items-center gap-2 text-lg font-bold"
          >
            <TeamCrest crest={team.crest} size={22} />
            <span className="truncate">{t.pick(team.name)}</span>
          </span>
        ))}
      </div>

      {event.suspended ? (
        <p className="text-muted flex min-h-14 items-center justify-center gap-2 rounded-md border border-dashed text-base">
          <Lock className="size-5" aria-hidden />
          {t.t("board.suspended")}
        </p>
      ) : market ? (
        <div className="grid grid-cols-3 gap-2">
          {market.outcomes.map((outcome) => (
            <KioskOddsButton
              key={outcome.id}
              market={market}
              outcome={outcome}
              eventName={eventName}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted flex min-h-14 items-center justify-center text-base">
          –
        </p>
      )}
    </li>
  );
}

export const KioskEventRow = memo(KioskEventRowImpl);

/**
 * A price wired to the slip, in the kiosk's size: the outcome's code beside
 * it (1, X, 2), its full name in the accessible label. A suspended market or
 * a price the API left out is locked.
 */
const KioskOddsButton = memo(function KioskOddsButton({
  market,
  outcome,
  eventName,
}: {
  market: Market;
  outcome: Outcome;
  eventName: Localized;
}) {
  const t = useTranslation();
  const selected = useIsSelected(outcome.id);
  const toggleSelection = useBetSlipStore((s) => s.toggleSelection);
  const suspended = market.status === "suspended" || outcome.odds === null;

  const onClick = useCallback(() => {
    if (suspended || outcome.odds === null) return;
    toggleSelection(
      selectionFrom({
        outcomeId: outcome.id,
        ref: {
          eventId: market.eventId,
          marketType: market.type,
          line: market.line,
          outcomeCode: outcome.code,
        },
        marketId: market.id,
        eventName,
        marketName: market.name,
        outcomeName: outcome.label,
        odds: outcome.odds,
      }),
    );
  }, [suspended, outcome, market, eventName, toggleSelection]);

  return (
    <OddsButtonView
      size="lg"
      odds={suspended ? null : t.odds(outcome.odds!)}
      selected={selected}
      movement={outcome.movement}
      label={outcome.code}
      onClick={onClick}
      ariaLabel={oddsAriaLabel({
        context: t.pick(eventName),
        outcome: t.pick(outcome.label),
        odds: outcome.odds,
        movement: outcome.movement,
        selected,
        suspended,
        t,
      })}
    />
  );
});
