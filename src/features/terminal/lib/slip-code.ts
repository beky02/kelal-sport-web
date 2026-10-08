import type { BetSlipTotals } from "@/features/bet-slip/lib/calculate";
import type { BetSelection } from "@/features/bet-slip/types";
import { bookingRequestFrom } from "@/features/bookings/lib/request";
import { ApiError } from "@/lib/api/errors";
import { MONEY_PATTERN, ODDS_PATTERN } from "@/lib/api/patterns";
import type { MessageKey } from "@/lib/i18n";
import type { SlipCodeRequest, TerminalInfo } from "../types";

/**
 * Get code on the shop kiosk (F8cc, C19 §4.2), as pure rules: what the slip
 * sends, what a refusal says and offers, and how long things last.
 */

/**
 * The slip as a slip code, or null when it can't be one — by Book bet's rule
 * (`bookingRequestFrom`, the user's decision of 2026-10-08): live picks, no
 * two of one match, and slipcalc happy with the stake; under the shop's
 * minimum there is no code, over the maximum the picks go without the stake.
 * Each pick goes with the odds the kiosk shows, for the counter's "changed"
 * flag (C19 §14) — when they are the contract's shape; never made up.
 */
export function slipCodeRequestFrom(slip: {
  selections: readonly BetSelection[];
  totals: BetSlipTotals;
  stake: string;
}): SlipCodeRequest | null {
  const booking = bookingRequestFrom(slip);
  if (!booking) return null;
  const odds = new Map(
    slip.selections.map((s) => [s.outcomeId, s.currentOdds]),
  );
  return {
    betType: booking.betType,
    systemSizes: booking.systemSizes,
    legs: booking.outcomeIds.map((outcomeId) => {
      const shown = odds.get(outcomeId) ?? "";
      return { outcomeId, odds: ODDS_PATTERN.test(shown) ? shown : null };
    }),
    stakeHint: booking.stake,
  };
}

/** What a refused Get code does, by the Problem's `code` — never its title. */
export type SlipCodeRefusal =
  /** The terminal's 30 codes per 10 minutes are spent: wait `retryAfter` seconds. */
  | { kind: "paused"; retryAfter: number | null }
  /** The stake hint was refused: say so, and offer `amount` as a tap. */
  | {
      kind: "stake";
      key: "betSlip.errors.stakeTooLowBody" | "betSlip.errors.stakeTooHighBody";
      amount: string;
    }
  /** These picks can't be sold now: mark them, and the slip says why. */
  | { kind: "legs"; refused: "started" | "suspended"; outcomeIds: string[] }
  /** The terminal itself was refused: its status is read again and decides. */
  | { kind: "status"; key: MessageKey }
  | { kind: "message"; key: MessageKey };

const FAILED = { kind: "message", key: "terminal.code.failed" } as const;
const CANNOT = { kind: "message", key: "terminal.code.cannot" } as const;

/**
 * What to tell the customer when Get code fails, and the fix where there is
 * one (F8cc decision 10). A stake limit is offered only when it is the
 * stake's (`stake_hint`, as request 015 proposes, or `stake`, as the shared
 * example has it) and an amount. A started or suspended leg is named by its
 * place in the request that was sent (`legs[1].outcome_id`).
 */
export function slipCodeRefusal(
  error: unknown,
  request: SlipCodeRequest,
): SlipCodeRefusal {
  if (!(error instanceof ApiError)) return FAILED;
  if (error.code === "RETAIL_SHOP_CLOSED") {
    return { kind: "status", key: "terminal.closed.title" };
  }
  if (
    error.status === 401 ||
    error.code === "RETAIL_DEVICE_NOT_ALLOWED" ||
    error.code === "device_key_missing"
  ) {
    return { kind: "status", key: "terminal.code.failed" };
  }
  switch (error.code) {
    case "RATE_LIMITED":
      return { kind: "paused", retryAfter: error.retryAfter };
    case "BET_STAKE_TOO_LOW":
    case "BET_STAKE_TOO_HIGH": {
      const limit = error.errors.find(
        (e) => e.field === "stake_hint" || e.field === "stake",
      )?.limit;
      if (!limit || !MONEY_PATTERN.test(limit)) return CANNOT;
      return {
        kind: "stake",
        key:
          error.code === "BET_STAKE_TOO_LOW"
            ? "betSlip.errors.stakeTooLowBody"
            : "betSlip.errors.stakeTooHighBody",
        amount: limit,
      };
    }
    case "BET_EVENT_STARTED":
    case "BET_MARKET_SUSPENDED": {
      const outcomeIds = error.errors.flatMap((e) => {
        const index = /^legs\[(\d+)\]/.exec(e.field ?? "")?.[1];
        const leg =
          index === undefined ? undefined : request.legs[Number(index)];
        return leg ? [leg.outcomeId] : [];
      });
      if (outcomeIds.length === 0) return CANNOT;
      return {
        kind: "legs",
        refused: error.code === "BET_EVENT_STARTED" ? "started" : "suspended",
        outcomeIds,
      };
    }
  }
  // Not reached, or the server failed: the same slip may go again, with its key.
  if (error.retryable) return FAILED;
  return CANNOT;
}

/** C19 §4.2 and §11: 90 s without a touch resets the screen. */
export const IDLE_RESET_SECONDS = 90;
/** C19 §4.2: the code stays on screen for 60 s. */
export const CODE_DISPLAY_SECONDS = 60;
/** The longest a timer can wait; past it, `setTimeout` fires at once. */
const MAX_TIMER_MS = 2 ** 31 - 1;

const ms = (seconds: number | null, fallback: number) =>
  Math.min(
    (seconds !== null && seconds > 0 ? seconds : fallback) * 1000,
    MAX_TIMER_MS,
  );

/** The terminal's idle and display times, or C19's without them. */
export const kioskTimings = (terminal: TerminalInfo | null) => ({
  idleMs: ms(terminal?.idleResetSeconds ?? null, IDLE_RESET_SECONDS),
  codeMs: ms(terminal?.codeDisplaySeconds ?? null, CODE_DISPLAY_SECONDS),
});

/**
 * When Get code may go again after a 429: `Retry-After` seconds from `now` on
 * this PC's clock, as a duration — so a PC whose clock is wrong waits just as
 * long. No wait without one, or with none left.
 */
export const pausedUntil = (
  retryAfter: number | null,
  now: number,
): number | null =>
  retryAfter !== null && retryAfter > 0 ? now + retryAfter * 1000 : null;

/** The wait left, `seconds`, in whole minutes rounded up ("back in 4 min"). */
export const minutesLeft = (seconds: number) => Math.ceil(seconds / 60);
