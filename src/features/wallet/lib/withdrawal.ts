import { ApiError } from "@/lib/api/errors";
import type { MessageKey } from "@/lib/i18n";
import { compareMoney } from "@/lib/money";
import type {
  AmountRange,
  PaymentMethod,
  Withdrawal,
  WithdrawalDestination,
  WithdrawalRequest,
  WithdrawalStatus,
} from "../types";
import { amountProblem, nearestAllowedAmount } from "./amount";

/**
 * How often a withdrawal that moves on its own is read again — the rules
 * chain, then the provider's payout (C04 §8). The contract sets no figure.
 */
export const WITHDRAWAL_POLL_MS = 10_000;

/** …and one a person is reviewing, which takes hours rather than seconds. */
export const REVIEW_POLL_MS = 60_000;

const FINAL: readonly WithdrawalStatus[] = [
  "paid",
  "failed",
  "rejected",
  "cancelled",
];

/** The API has decided: paid, or the money is back in the balance. */
export const isFinal = (status: WithdrawalStatus): boolean =>
  FINAL.includes(status);

/** The contract: a withdrawal can be cancelled while `requested` or in `review`. */
export const isCancellable = (status: WithdrawalStatus): boolean =>
  status === "requested" || status === "review";

/**
 * How long until a withdrawal is read again, or false once the API has
 * decided. Not read yet — or the last read failed — is the short beat.
 */
export function pollInterval(
  withdrawal: Withdrawal | undefined,
): number | false {
  if (withdrawal === undefined) return WITHDRAWAL_POLL_MS;
  if (isFinal(withdrawal.status)) return false;
  return withdrawal.status === "review" ? REVIEW_POLL_MS : WITHDRAWAL_POLL_MS;
}

const sameDestination = (
  a: WithdrawalDestination,
  b: WithdrawalDestination,
): boolean =>
  a.kind === "saved"
    ? b.kind === "saved" && a.payoutAccountId === b.payoutAccountId
    : b.kind === "new" && a.account === b.account;

/** Two requests are the same withdrawal intent: the same method, account and amount. */
export const sameWithdrawal = (
  a: WithdrawalRequest,
  b: WithdrawalRequest,
): boolean =>
  a.method === b.method &&
  compareMoney(a.amount, b.amount) === 0 &&
  sameDestination(a.to, b.to);

/**
 * The review reasons this app can put in words. Anything else gets no line:
 * a raw code means nothing to a player, and C12's holds are named after AML
 * rules, which aren't theirs to read.
 */
const REVIEW_REASONS: Readonly<Record<string, MessageKey>> = {
  FIRST_WITHDRAWAL: "withdraw.reviewReason.FIRST_WITHDRAWAL",
};

export const reviewReasonKey = (reason: string | null): MessageKey | null =>
  reason !== null && Object.hasOwn(REVIEW_REASONS, reason)
    ? REVIEW_REASONS[reason]
    : null;

export type WithdrawalOutcome =
  | { kind: "unanswered" }
  | { kind: "session" }
  | { kind: "refused"; error: ApiError };

/**
 * What a failed attempt to request a withdrawal means.
 *
 * `unanswered`: nothing settled it — no response (a dropped connection, the
 * 30 s limit), a rate limit (429), a reply this app could not read, or any
 * 5xx but `REAL_MONEY_DISABLED`. A 502 is among them: the contract lists none
 * for a withdrawal, and only the same request with the same key may go again,
 * which can never ask for a second withdrawal. `session`: the session is gone
 * (the route handler has refreshed once already). `refused`: the API
 * answered; the next attempt is a new intent with a new key.
 */
export function withdrawalOutcome(error: unknown): WithdrawalOutcome {
  if (!(error instanceof ApiError) || error.status === 0) {
    return { kind: "unanswered" };
  }
  if (error.status === 401) return { kind: "session" };
  if (error.status === 429) return { kind: "unanswered" };
  if (error.status >= 500 && error.code !== "REAL_MONEY_DISABLED") {
    return { kind: "unanswered" };
  }
  return { kind: "refused", error };
}

export type CancelOutcome =
  | { kind: "unanswered" }
  | { kind: "session" }
  | { kind: "tooLate" }
  | { kind: "gone" }
  | { kind: "refused"; error: ApiError };

/**
 * What a cancel that didn't come back cancelled means. `tooLate`: the API
 * says it can no longer be cancelled — the status, read again, says why.
 * `gone`: not this player's, or no longer there. `unanswered`: it may have
 * gone through — the status, read again, says whether; cancelling again can
 * do no harm, as a withdrawal is only ever cancelled once. `refused`: any
 * other no, in the API's words.
 */
export function cancelOutcome(error: unknown): CancelOutcome {
  if (!(error instanceof ApiError) || error.status === 0) {
    return { kind: "unanswered" };
  }
  if (error.status === 401) return { kind: "session" };
  if (error.code === "PAY_WITHDRAWAL_NOT_CANCELLABLE") {
    return { kind: "tooLate" };
  }
  if (error.status === 404) return { kind: "gone" };
  if (error.status === 429 || error.status >= 500) {
    return { kind: "unanswered" };
  }
  return { kind: "refused", error };
}

/** A message and what fills it. Amounts stay decimal strings until shown. */
export interface WithdrawalText {
  key: MessageKey;
  /** A method's name, as the API gives it. */
  method?: string;
  amount?: string;
  min?: string;
  max?: string;
}

/** What a refusal offers, as data: the confirm step turns each into a button. */
export type WithdrawalFix =
  | { kind: "chooseMethod" }
  | { kind: "chooseAccount" }
  | { kind: "amount"; amount: string }
  | { kind: "changeAmount" }
  | { kind: "retry" }
  | { kind: "verify" }
  | { kind: "keepWagering" }
  | { kind: "help" };

export interface WithdrawalNotice {
  title: WithdrawalText;
  /** Our copy; for a code this app has none of, the API's own translated title. */
  body: WithdrawalText | { text: string };
  /** The API's `detail`, as its own line. */
  detail: string | null;
  /** The first is the main action. */
  fixes: WithdrawalFix[];
}

/**
 * What the wallet says about a refused withdrawal, by its Problem `code` —
 * never by its title — with the fix where there is one (docs/design/05). A
 * refused Try again is titled as one: it says nothing about the first try,
 * which may still have gone through, so it never offers a new withdrawal of
 * the same amount — Try again, with the first try's key, stays the way on.
 */
export function withdrawalRefusal(
  error: ApiError,
  ctx: {
    method: PaymentMethod;
    /** The method's withdrawal limits. */
    range: AmountRange;
    /** The amount that was refused, in the contract's form. */
    amount: string;
    /** The cash balance as the API last sent it: what can be withdrawn. */
    cash: string;
    /** It answered a Try again of an unanswered withdrawal. */
    retried: boolean;
  },
): WithdrawalNotice {
  const problem = error.details as { detail?: unknown } | null | undefined;
  const detail = typeof problem?.detail === "string" ? problem.detail : null;
  const method = ctx.method.name;
  const notice = (
    title: WithdrawalText,
    body: WithdrawalNotice["body"],
    fixes: WithdrawalFix[] = [],
  ): WithdrawalNotice => ({
    title: ctx.retried ? { key: "withdraw.refused.retryTitle" } : title,
    body,
    detail,
    // After a refused Try again the main button is that Try again.
    fixes: ctx.retried ? fixes.filter((fix) => fix.kind !== "retry") : fixes,
  });

  switch (error.code) {
    case "KYC_REQUIRED":
      return notice(
        { key: "withdraw.refused.kycTitle" },
        { key: "withdraw.refused.kyc" },
        [{ kind: "verify" }],
      );

    case "PAY_ACTIVE_BONUS_WAGERING":
      // BON-07's Confirm forfeit waits for contract request 008.
      return notice(
        { key: "withdraw.refused.bonusTitle" },
        { key: "withdraw.refused.bonus" },
        [{ kind: "keepWagering" }],
      );

    case "PAY_AMOUNT_OUT_OF_RANGE": {
      const nearest = nearestAllowedAmount(
        error,
        ctx.range,
        ctx.amount,
        ctx.cash,
      );
      // The method's range explains it only when the amount is outside it;
      // otherwise another limit applied, and the API's words say which.
      const outside = amountProblem(ctx.amount, ctx.range) !== null;
      return notice(
        { key: "withdraw.refused.amountTitle" },
        outside
          ? {
              key: "withdraw.refused.amount",
              method,
              min: ctx.range.min,
              max: ctx.range.max,
            }
          : { text: error.message },
        nearest
          ? [{ kind: "amount", amount: nearest }, { kind: "changeAmount" }]
          : [{ kind: "changeAmount" }],
      );
    }

    case "WALLET_INSUFFICIENT_FUNDS":
      return notice(
        { key: "withdraw.refused.fundsTitle" },
        { key: "withdraw.refused.funds" },
        [{ kind: "changeAmount" }],
      );

    case "RG_SELF_EXCLUDED":
    case "RG_COOLING_OFF":
      // RG-02 says a self-excluded player's funds stay withdrawable, so this
      // never calls withdrawals paused: support helps with this one.
      return notice(
        { key: "withdraw.refused.breakTitle" },
        { key: "withdraw.refused.break" },
        [{ kind: "help" }],
      );

    case "REAL_MONEY_DISABLED":
      return notice(
        { key: "withdraw.refused.realMoneyTitle" },
        { key: "withdraw.refused.realMoney" },
      );

    case "PAY_METHOD_UNAVAILABLE":
      return notice(
        { key: "withdraw.refused.methodTitle" },
        { key: "withdraw.refused.method", method },
        [{ kind: "chooseMethod" }],
      );

    default: {
      // A code this app has no words for: the API's own (translated) title,
      // and the fix for the field its errors name.
      const fields = new Set(error.errors.map((e) => e.field));
      return notice(
        { key: "withdraw.refused.otherTitle" },
        { text: error.message },
        fields.has("payout_account_id") || fields.has("account")
          ? [{ kind: "chooseAccount" }]
          : fields.has("amount")
            ? [{ kind: "changeAmount" }]
            : [{ kind: "retry" }],
      );
    }
  }
}
