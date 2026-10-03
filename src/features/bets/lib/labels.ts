import type { MessageKey } from "@/lib/i18n";
import type { Translator } from "@/lib/i18n/use-translation";
import type { Bet, BetType, LegResult, TicketStatus } from "../types";

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
 * count (F5a's labels). The public check knows neither sizes nor lines: its
 * system bet is "System", and its singles are counted by leg.
 */
export function betKindLabel(
  bet: {
    betType: BetType;
    legCount: number;
    systemSizes?: number[];
    lines?: number;
  },
  t: Translator,
): string {
  const n = bet.legCount;
  switch (bet.betType) {
    case "multiple":
      return t.t("betSlip.multipleLabel", { n });
    case "system":
      return bet.systemSizes?.length && bet.lines !== undefined
        ? t.t("betSlip.systemLabel", {
            k: bet.systemSizes.join(t.t("booking.sizesSeparator")),
            n,
            c: bet.lines,
          })
        : t.t("betSlip.system");
    case "single": {
      const lines = bet.lines ?? n;
      return lines > 1
        ? t.t("betSlip.singlesLabel", { n: lines })
        : t.t("betSlip.single");
    }
  }
}

/** A ticket from My bets, as `betKindLabel` takes it. */
export const kindOf = (bet: Bet) => ({
  betType: bet.betType,
  legCount: bet.legs.length,
  systemSizes: bet.systemSizes,
  lines: bet.lines,
});
