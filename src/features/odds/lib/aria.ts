import type { Translator } from "@/lib/i18n/use-translation";
import type { OddsMovement } from "@/features/markets/types";

/**
 * The accessible name for a price.
 *
 * A screen reader user hears this instead of seeing colour and arrows, so
 * everything the visual state conveys has to be in the text: which pick, at
 * what price, whether it just moved, and whether it is already in the slip.
 *
 *   "Man City – Newcastle: Man City 1.62, odds rising, in bet slip"
 */
export function oddsAriaLabel({
  context,
  outcome,
  odds,
  movement,
  selected,
  suspended,
  t,
}: {
  /** Usually the event name, so the price is not announced out of context. */
  context?: string;
  outcome: string;
  odds: number | null;
  movement: OddsMovement | null;
  selected: boolean;
  suspended: boolean;
  t: Translator;
}): string {
  const subject = [context, outcome].filter(Boolean).join(": ");

  if (suspended || odds === null) {
    return `${subject}, ${t.t("a11y.suspended")}`;
  }

  const parts = [`${subject} ${t.odds(odds)}`];
  if (movement === "up") parts.push(t.t("a11y.oddsRising"));
  if (movement === "down") parts.push(t.t("a11y.oddsFalling"));
  if (selected) parts.push(t.t("a11y.inBetSlip"));

  return parts.join(", ");
}
