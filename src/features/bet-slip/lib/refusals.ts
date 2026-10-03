import type { RuleSetJson } from "@golden/slipcalc";
import { MONEY_PATTERN } from "@/lib/api/patterns";
import type { MessageKey } from "@/lib/i18n";
import type { PlaceRefusal } from "../types";
import { smallestStake } from "./calculate";

/** The fix a refusal offers, as data: the slip turns it into a button. */
export type RefusalFix =
  | { kind: "stake"; amount: string }
  | { kind: "deposit" }
  | { kind: "verify" }
  | { kind: "viewLimits" };

/**
 * A message and what fills its placeholders. Amounts stay decimal strings
 * here; the slip formats them for the language on screen.
 */
export interface RefusalText {
  key: MessageKey;
  amount?: string;
  n?: number | string;
  seconds?: number;
  date?: string;
}

export interface RefusalNotice {
  title: RefusalText;
  /** Our copy; for a code this app has none of, the API's own translated title. */
  body: RefusalText | { text: string };
  /** The API's `detail` as its own line — unless the body already says it. */
  detail: string | null;
  fix: RefusalFix | null;
}

export interface RefusalContext {
  /** Lines the slip places now: an engine minimum must clear every one (D1.3). */
  lines: number;
  rules: RuleSetJson | null;
  /** A pick the refusal re-priced waits for the player's yes: the odds alert says it. */
  pickChanged: boolean;
  /** A pick the refusal closed is marked suspended: that alert says it. */
  pickClosed: boolean;
  /**
   * This answered a Try again of the unconfirmed bet. Its refusal says
   * nothing about the first try, which may still have gone through: it is
   * titled as a Try again that didn't go through, never as a bet refused.
   */
  retried: boolean;
  /** When the player's break ends, already formatted; null when unknown. */
  breakUntil: string | null;
}

const NOT_PLACED: RefusalText = { key: "betSlip.placeFailed" };
const RETRY_REFUSED: RefusalText = { key: "betSlip.unconfirmed.retryRefused" };

/**
 * A limit the engine put on the stake — never one on a leg, a payout or a
 * liability — and only when it is an amount: the contract types it as any
 * string, and a stake is never set from one that isn't.
 */
function stakeLimit(refusal: PlaceRefusal): string | undefined {
  const limit = refusal.errors.find((e) => e.field === "stake")?.limit;
  return limit !== undefined && MONEY_PATTERN.test(limit) ? limit : undefined;
}

/**
 * What the slip says about the engine's refusal of a bet, by its Problem
 * `code` — never by its title, which is display text in whatever language the
 * API chose — with the fix where there is one (docs/design/05). Null when
 * another alert already says it.
 */
export function refusalNotice(
  refusal: PlaceRefusal,
  ctx: RefusalContext,
): RefusalNotice | null {
  // A refused Try again is one whatever the reason; the reason is the body.
  const notice = (
    title: RefusalText,
    body: RefusalNotice["body"],
    fix: RefusalFix | null = null,
  ): RefusalNotice => ({
    title: ctx.retried ? RETRY_REFUSED : title,
    body,
    detail: refusal.detail,
    fix,
  });

  switch (refusal.code) {
    case "BET_ODDS_CHANGED":
      // A Try again's refusal is said as one. A first try's re-priced pick
      // waits for Accept, and the odds alert says the bet wasn't placed.
      if (ctx.retried) {
        return notice(NOT_PLACED, { key: "betSlip.unconfirmed.oddsChanged" });
      }
      if (ctx.pickChanged) return null;
      return notice(NOT_PLACED, { key: "betSlip.refused.oddsUnknown" });

    case "BET_EVENT_STARTED":
    case "BET_MARKET_SUSPENDED":
      if (ctx.retried) {
        return notice(NOT_PLACED, { key: "betSlip.unconfirmed.closed" });
      }
      if (ctx.pickClosed) return null;
      return notice(NOT_PLACED, { key: "betSlip.refused.closedUnknown" });

    case "BET_STAKE_TOO_LOW":
    case "BET_STAKE_TOO_HIGH": {
      const low = refusal.code === "BET_STAKE_TOO_LOW";
      const title: RefusalText = {
        key: low
          ? "betSlip.errors.stakeTooLowTitle"
          : "betSlip.errors.stakeTooHighTitle",
      };
      const limit = stakeLimit(refusal);
      if (!limit) {
        return notice(title, {
          key: low ? "betSlip.refused.stakeLow" : "betSlip.refused.stakeHigh",
        });
      }
      // A maximum splits under itself; a minimum must clear every line.
      const amount = low ? smallestStake(limit, ctx.lines) : limit;
      return {
        ...notice(
          title,
          {
            key: low
              ? "betSlip.errors.stakeTooLowBody"
              : "betSlip.errors.stakeTooHighBody",
            amount,
          },
          { kind: "stake", amount },
        ),
        // The body states the limit; the API's sentence would repeat it.
        detail: null,
      };
    }

    case "BET_LIMIT_EXCEEDED": {
      // TD-01: a trader limit or a liability. Only a limit on the stake is a
      // stake the player can set.
      const limit = stakeLimit(refusal);
      return limit
        ? notice(
            { key: "betSlip.refused.limitTitle" },
            { key: "betSlip.refused.limitWith", amount: limit },
            { kind: "stake", amount: limit },
          )
        : notice(
            { key: "betSlip.refused.limitTitle" },
            { key: "betSlip.refused.limit" },
          );
    }

    case "WALLET_INSUFFICIENT_FUNDS":
      return notice(
        { key: "betSlip.alerts.insufficientTitle" },
        { key: "betSlip.refused.insufficient" },
        { kind: "deposit" },
      );

    case "BET_RELATED_SELECTIONS":
      return notice(NOT_PLACED, { key: "betSlip.alerts.conflictBody" });

    case "BET_TOO_MANY_LEGS":
    case "BET_TOO_MANY_LINES": {
      const legs = refusal.code === "BET_TOO_MANY_LEGS";
      const n = legs ? ctx.rules?.max_legs : ctx.rules?.max_lines;
      if (n === undefined) {
        return notice(NOT_PLACED, { key: "betSlip.placeFailedBody" });
      }
      return notice(NOT_PLACED, {
        key: legs
          ? "betSlip.errors.tooManyLegsBody"
          : "betSlip.errors.tooManyLinesBody",
        n,
      });
    }

    case "KYC_REQUIRED":
      return notice(
        { key: "betSlip.refused.kycTitle" },
        { key: "betSlip.refused.kyc" },
        { kind: "verify" },
      );

    case "RG_LIMIT_REACHED":
      return notice(
        { key: "betSlip.refused.rgLimitTitle" },
        { key: "betSlip.refused.rgLimit" },
        { kind: "viewLimits" },
      );

    case "RG_SELF_EXCLUDED":
    case "RG_COOLING_OFF":
      // Nothing to offer: a break cannot be ended from here.
      return notice(
        { key: "betSlip.refused.breakTitle" },
        ctx.breakUntil
          ? { key: "betSlip.refused.breakUntil", date: ctx.breakUntil }
          : { key: "betSlip.refused.break" },
      );

    case "REAL_MONEY_DISABLED":
      return notice(NOT_PLACED, { key: "betSlip.refused.realMoney" });

    case "RATE_LIMITED":
      return notice(
        NOT_PLACED,
        refusal.retryAfter !== null
          ? {
              key: "betSlip.refused.rateLimitedSeconds",
              seconds: refusal.retryAfter,
            }
          : { key: "betSlip.refused.rateLimited" },
      );

    default:
      // A code this app has no copy of shows the API's own, translated
      // title. An answer that wasn't a Problem (a proxy's error page) has
      // only this app's technical message, which no player should read.
      return notice(
        NOT_PLACED,
        refusal.code !== "http_error" && refusal.title
          ? { text: refusal.title }
          : { key: "betSlip.placeFailedBody" },
      );
  }
}
