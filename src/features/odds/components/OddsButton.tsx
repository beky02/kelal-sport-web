"use client";

import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { Market, Outcome } from "@/features/markets/types";
import {
  selectionFrom,
  useBetSlipStore,
  useIsSelected,
} from "@/features/bet-slip/stores/bet-slip.store";
import { useOddsLocked } from "@/features/system/hooks/use-odds-locked";
import { useUiStore } from "@/stores/ui.store";
import type { Localized } from "@/types/common";
import { oddsAriaLabel } from "../lib/aria";
import { OddsButtonView, type OddsButtonSize } from "./OddsButtonView";

export interface OddsButtonProps {
  market: Market;
  outcome: Outcome;
  /** Announced before the price so it is never read out of context. */
  eventName: Localized;
  /** Show the outcome's own label inside the button (lined markets). */
  showLabel?: boolean;
  size?: OddsButtonSize;
}

/**
 * A price wired to the slip.
 *
 * Subscribes only to its own selected flag, so a price moving anywhere else on
 * the board — or a pick being added three rows down — re-renders this button and
 * nothing around it. That granularity is what keeps a board of hundreds of
 * events responsive.
 *
 * It knows how to *select*, not how to bet: it hands a selection to the bet-slip
 * store and the slip owns everything after that.
 */
function OddsButtonImpl({
  market,
  outcome,
  eventName,
  showLabel = false,
  size = "md",
}: OddsButtonProps) {
  const t = useTranslation();

  const ref = useMemo(
    () => ({
      eventId: market.eventId,
      marketType: market.type,
      line: market.line,
      outcomeCode: outcome.code,
    }),
    [market.eventId, market.type, market.line, outcome.code],
  );

  const selected = useIsSelected(outcome.id);

  const toggleSelection = useBetSlipStore((s) => s.toggleSelection);
  const showSlipPanel = useUiStore((s) => s.setAsidePanel);

  // Offline or a responsible-gaming break locks every price, for reasons that
  // have nothing to do with this market.
  const locked = useOddsLocked();
  const suspended =
    locked || market.status === "suspended" || outcome.odds === null;

  const onClick = useCallback(() => {
    if (suspended || outcome.odds === null) return;

    toggleSelection(
      selectionFrom({
        outcomeId: outcome.id,
        ref,
        marketId: market.id,
        eventName,
        marketName: market.name,
        outcomeName: outcome.label,
        odds: outcome.odds,
      }),
    );
    // Make sure the slip is the visible panel, so the user sees what the tap
    // did. On a phone the sheet stays shut until they ask for it — the board
    // should not jump out from under a thumb mid-scroll.
    showSlipPanel("slip");
  }, [
    suspended,
    outcome.odds,
    outcome.label,
    toggleSelection,
    outcome.id,
    ref,
    market.id,
    market.name,
    eventName,
    showSlipPanel,
  ]);

  return (
    <OddsButtonView
      odds={suspended ? null : t.odds(outcome.odds!)}
      selected={selected}
      movement={outcome.movement}
      label={showLabel ? t.pick(outcome.label) : undefined}
      size={size}
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
}

/**
 * Memoised so a re-render of the surrounding row — a score arriving, a pick
 * added elsewhere on the same match — does not re-render every price on it.
 * `market` and `outcome` come straight from the query cache, which preserves
 * their identity across untouched updates.
 */
export const OddsButton = memo(OddsButtonImpl);
