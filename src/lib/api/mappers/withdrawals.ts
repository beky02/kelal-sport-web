import {
  PAYMENT_METHOD_CODES,
  type PaymentMethodCode,
  type PayoutAccount,
  type PayoutAccountRequest,
  type Withdrawal,
  type WithdrawalRequest,
} from "@/features/wallet/types";
import type { components } from "@/lib/api/schema";

type ApiPayoutAccount = components["schemas"]["PayoutAccount"];
type ApiPayoutAccountCreate = components["schemas"]["PayoutAccountCreate"];
type ApiWithdrawal = components["schemas"]["Withdrawal"];
type ApiWithdrawalRequest = components["schemas"]["WithdrawalRequest"];

const isMethodCode = (code: string): code is PaymentMethodCode =>
  (PAYMENT_METHOD_CODES as readonly string[]).includes(code);

/** One saved account as the screens show it: the number only ever masked. */
export const toPayoutAccount = (account: ApiPayoutAccount): PayoutAccount => ({
  id: account.id,
  provider: account.provider,
  accountMasked: account.account_masked,
  holderName: account.holder_name ?? null,
  verified: account.verified,
  createdAt: account.created_at,
});

/**
 * `/v1/me/payout-accounts` → the player's saved accounts. One on a method the
 * contract adds after this build is left out: a withdrawal is sent with one
 * of the contract's methods, so it could not be used anyway.
 */
export const toPayoutAccounts = (
  items: readonly ApiPayoutAccount[],
): PayoutAccount[] =>
  items
    .filter((account) => isMethodCode(account.provider))
    .map(toPayoutAccount);

/** A new payout account as the API takes it. */
export const toPayoutAccountCreate = (
  request: PayoutAccountRequest,
): ApiPayoutAccountCreate => ({
  provider: request.provider,
  account_ref: request.account,
});

/**
 * The player's withdrawal as the API takes it: a saved account by its id —
 * the contract's preferred form — or a new number as `account`, never both.
 */
export function toWithdrawalRequest(
  request: WithdrawalRequest,
): ApiWithdrawalRequest {
  const { method, amount, to } = request;
  return to.kind === "saved"
    ? { method, amount, payout_account_id: to.payoutAccountId }
    : { method, amount, account: to.account };
}

/**
 * A withdrawal as the screens show it. The amount is the API's string; what
 * the API didn't send — the account, the reasons, when it was paid — is null.
 */
export const toWithdrawal = (withdrawal: ApiWithdrawal): Withdrawal => ({
  id: withdrawal.id,
  method: withdrawal.method,
  amount: withdrawal.amount,
  status: withdrawal.status,
  accountMasked: withdrawal.account_masked ?? null,
  reviewReason: withdrawal.review_reason ?? null,
  rejectionReason: withdrawal.rejection_reason ?? null,
  createdAt: withdrawal.created_at,
  paidAt: withdrawal.paid_at ?? null,
});
