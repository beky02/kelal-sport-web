import { ApiError } from "@/lib/api/errors";
import { MONEY_PATTERN } from "@/lib/api/patterns";
import type { MessageKey } from "@/lib/i18n";
import { compareMoney, toSantim } from "@/lib/money";
import type {
  Deposit,
  DepositRequest,
  DepositStatus,
  PaymentMethod,
} from "../types";
import { amountProblem } from "./amount";

/** How often a deposit that is still going is read again (the contract: 3 s). */
export const DEPOSIT_POLL_MS = 3_000;

const FINAL: readonly DepositStatus[] = ["completed", "failed", "expired"];

/** The API has decided: the money arrived, or it never will. */
export const isFinal = (status: DepositStatus): boolean =>
  FINAL.includes(status);

/**
 * Whether a deposit is still worth reading again: not yet read, or still
 * going with something the player can do or wait for. A payment this site
 * can't finish (`unsupported`) is not polled — the screen asks for another
 * method instead.
 */
export const shouldPoll = (deposit: Deposit | undefined): boolean =>
  deposit === undefined ||
  (!isFinal(deposit.status) && deposit.nextAction?.type !== "unsupported");

/** Two requests are the same deposit intent: the same method and amount. */
export const sameDeposit = (a: DepositRequest, b: DepositRequest): boolean =>
  a.method === b.method && compareMoney(a.amount, b.amount) === 0;

export type DepositOutcome =
  | { kind: "unanswered" }
  | { kind: "session" }
  | { kind: "refused"; error: ApiError };

/**
 * What a failed attempt to start a deposit means.
 *
 * `unanswered`: nothing settled it — no response (a dropped connection, the
 * 30 s limit), a 5xx without a code that decides it, a rate limit (429), or a
 * reply this app could not read; the deposit may exist, so only the same
 * request with the same key may go again. `session`: the session is gone (the route handler
 * has refreshed once already). `refused`: the API answered — a 4xx,
 * `PAY_PROVIDER_ERROR` (the provider failed and the API says so) or
 * `REAL_MONEY_DISABLED`; the next attempt is a new intent with a new key.
 */
export function depositOutcome(error: unknown): DepositOutcome {
  if (!(error instanceof ApiError) || error.status === 0) {
    return { kind: "unanswered" };
  }
  if (error.status === 401) return { kind: "session" };
  // "Not now" says nothing about whether this key already started one.
  if (error.status === 429) return { kind: "unanswered" };
  if (
    error.status >= 500 &&
    error.code !== "PAY_PROVIDER_ERROR" &&
    error.code !== "REAL_MONEY_DISABLED"
  ) {
    return { kind: "unanswered" };
  }
  return { kind: "refused", error };
}

/** A message and what fills it. Amounts stay decimal strings until shown. */
export interface DepositText {
  key: MessageKey;
  /** A method's name, as the API gives it. */
  method?: string;
  amount?: string;
  min?: string;
  max?: string;
  /** A date already formatted for the player. */
  date?: string;
}

/** What a refusal offers, as data: the confirm step turns each into a button. */
export type DepositFix =
  | { kind: "chooseMethod" }
  | { kind: "amount"; amount: string }
  | { kind: "changeAmount" }
  | { kind: "retry" }
  | { kind: "viewLimits" }
  | { kind: "verify" };

export interface DepositNotice {
  title: DepositText;
  /** Our copy; for a code this app has none of, the API's own translated title. */
  body: DepositText | { text: string };
  /** The API's `detail`, as its own line. */
  detail: string | null;
  /** The first is the main action. */
  fixes: DepositFix[];
}

const distance = (a: string, b: string): bigint => {
  const d = toSantim(a) - toSantim(b);
  return d < 0n ? -d : d;
};

/**
 * The amount to offer when the API refuses one as out of range: of the
 * limits it gives for the amount, the one nearest the refused amount — the
 * side it fell on — and only one this method takes; else the method's own
 * limit on that side. Null when neither applies.
 */
function nearestAmount(
  error: ApiError,
  method: PaymentMethod,
  amount: string,
): string | null {
  const limits = error.errors
    .filter((e) => e.field === "amount")
    .map((e) => e.limit)
    .filter(
      (limit): limit is string =>
        limit !== undefined &&
        MONEY_PATTERN.test(limit) &&
        compareMoney(limit, amount) !== 0 &&
        amountProblem(limit, method.deposit) === null,
    )
    .sort((a, b) => {
      const da = distance(a, amount);
      const db = distance(b, amount);
      return da < db ? -1 : da > db ? 1 : 0;
    });
  if (limits.length > 0) return limits[0];
  if (compareMoney(amount, method.deposit.min) < 0) return method.deposit.min;
  if (compareMoney(amount, method.deposit.max) > 0) return method.deposit.max;
  return null;
}

/**
 * What the wallet says about a refused deposit, by its Problem `code` — never
 * by its title, which is display text in whatever language the API chose —
 * with the fix where there is one (docs/design/05). A refused Try again is
 * titled as one: it says nothing about the first try, which may still have
 * started, so it never offers a new deposit of the same amount — Try again,
 * with the first try's key, stays the way on.
 */
export function depositRefusal(
  error: ApiError,
  ctx: {
    method: PaymentMethod;
    /** The amount that was refused, in the contract's form. */
    amount: string;
    /** When the player's break ends, already formatted; null when unknown. */
    breakUntil: string | null;
    /** It answered a Try again of an unanswered deposit. */
    retried: boolean;
  },
): DepositNotice {
  const problem = error.details as { detail?: unknown } | null | undefined;
  const detail = typeof problem?.detail === "string" ? problem.detail : null;
  const method = ctx.method.name;
  const notice = (
    title: DepositText,
    body: DepositNotice["body"],
    fixes: DepositFix[] = [],
  ): DepositNotice => ({
    title: ctx.retried ? { key: "deposit.refused.retryTitle" } : title,
    body,
    detail,
    // After a refused Try again the main button is that Try again.
    fixes: ctx.retried ? fixes.filter((fix) => fix.kind !== "retry") : fixes,
  });

  switch (error.code) {
    case "PAY_METHOD_UNAVAILABLE":
      return notice(
        { key: "deposit.refused.methodTitle" },
        { key: "deposit.refused.method", method },
        [{ kind: "chooseMethod" }],
      );

    case "PAY_AMOUNT_OUT_OF_RANGE": {
      const nearest = nearestAmount(error, ctx.method, ctx.amount);
      // The method's range explains it only when the amount is outside it;
      // otherwise another limit applied, and the API's words say which.
      const outside = amountProblem(ctx.amount, ctx.method.deposit) !== null;
      return notice(
        { key: "deposit.refused.amountTitle" },
        outside
          ? {
              key: "deposit.refused.amount",
              method,
              min: ctx.method.deposit.min,
              max: ctx.method.deposit.max,
            }
          : { text: error.message },
        nearest
          ? [{ kind: "amount", amount: nearest }, { kind: "changeAmount" }]
          : [{ kind: "changeAmount" }],
      );
    }

    case "PAY_PROVIDER_ERROR":
      return notice(
        { key: "deposit.refused.providerTitle" },
        { key: "deposit.refused.provider", method },
        [{ kind: "retry" }, { kind: "chooseMethod" }],
      );

    case "RG_LIMIT_REACHED":
      return notice(
        { key: "deposit.refused.limitTitle" },
        { key: "deposit.refused.limit" },
        [{ kind: "viewLimits" }],
      );

    case "RG_SELF_EXCLUDED":
    case "RG_COOLING_OFF":
      return notice(
        { key: "deposit.refused.breakTitle" },
        ctx.breakUntil
          ? { key: "deposit.refused.breakUntil", date: ctx.breakUntil }
          : { key: "deposit.refused.break" },
      );

    case "KYC_REQUIRED":
      return notice(
        { key: "deposit.refused.kycTitle" },
        { key: "deposit.refused.kyc" },
        [{ kind: "verify" }],
      );

    case "REAL_MONEY_DISABLED":
      return notice(
        { key: "deposit.refused.realMoneyTitle" },
        { key: "deposit.refused.realMoney" },
      );

    default:
      // A code this app has no words for: the API's own (translated) title.
      return notice(
        { key: "deposit.refused.otherTitle" },
        { text: error.message },
        error.errors.some((e) => e.field === "amount")
          ? [{ kind: "changeAmount" }]
          : [{ kind: "retry" }],
      );
  }
}
