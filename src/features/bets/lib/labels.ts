import type { MessageKey } from "@/lib/i18n";
import type { Translator } from "@/lib/i18n/use-translation";
import type { Bet, LegResult, TicketStatus } from "../types";

/** A ticket's status in words: colour alone never carries it. */
export const STATUS_KEY: Record<TicketStatus, MessageKey> = {
  open: "bets.status.open",
  won: "bets.status.won",
  lost: "bets.status.lost",
  void: "bets.status.void",
  cashed_out: "bets.status.cashed_out",
  cancelled: "bets.status.cancelled",
  paid: "bets.status.paid",
  expired: "bets.status.expired",
};

/** A leg's result in words, beside its dot. */
export const RESULT_KEY: Record<LegResult, MessageKey> = {
  open: "bets.result.open",
  win: "bets.result.win",
  lose: "bets.result.lose",
  // A void leg counts as odds 1.00 (D1.5), which is worth saying.
  void: "bets.voidLeg",
  half_win: "bets.result.half_win",
  half_lose: "bets.result.half_lose",
};

/**
 * A bet as the slip names it — "Single", "Singles · 3 bets", "Multiple · 2
 * picks", "System 2/3 · 3 bets" — from the API's own type, sizes and line
 * count (F5a's labels).
 */
export function betKindLabel(
  bet: Pick<Bet, "betType" | "systemSizes" | "lines" | "legs">,
  t: Translator,
): string {
  const n = bet.legs.length;
  switch (bet.betType) {
    case "multiple":
      return t.t("betSlip.multipleLabel", { n });
    case "system":
      return t.t("betSlip.systemLabel", {
        k: bet.systemSizes.join(t.t("booking.sizesSeparator")),
        n,
        c: bet.lines,
      });
    case "single":
      return bet.lines > 1
        ? t.t("betSlip.singlesLabel", { n: bet.lines })
        : t.t("betSlip.single");
  }
}
