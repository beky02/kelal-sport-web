import "server-only";
import type {
  PayoutAccount,
  PayoutAccountRequest,
  Withdrawal,
  WithdrawalRequest,
} from "@/features/wallet/types";
import {
  toPayoutAccount,
  toPayoutAccountCreate,
  toPayoutAccounts,
  toWithdrawal,
  toWithdrawalRequest,
} from "@/lib/api/mappers/withdrawals";
import { withSession, type Session, type SessionContext } from "./session";
import { upstream } from "./upstream";

/**
 * Money out (C04 §5–§8): the player's payout accounts and their withdrawals,
 * each call made for the signed-in player with their session. Refusals pass
 * through as `UpstreamError`, Problem intact. Account numbers are never
 * logged here: they are the player's.
 */

/** The player's saved payout accounts (`GET /v1/me/payout-accounts`). */
export async function loadPayoutAccounts(
  ctx: SessionContext,
  session: Session,
): Promise<PayoutAccount[]> {
  const { items } = await withSession(ctx, session, (authorization) =>
    upstream("Payments", { ...ctx, authorization }).GET(
      "/v1/me/payout-accounts",
    ),
  );
  return toPayoutAccounts(items);
}

/** Saves a payout account for the player (`POST /v1/me/payout-accounts`). */
export async function addPayoutAccount(
  ctx: SessionContext,
  session: Session,
  request: PayoutAccountRequest,
): Promise<PayoutAccount> {
  const account = await withSession(ctx, session, (authorization) =>
    upstream("Payments", { ...ctx, authorization }).POST(
      "/v1/me/payout-accounts",
      { body: toPayoutAccountCreate(request) },
    ),
  );
  return toPayoutAccount(account);
}

/** Removes one of the player's payout accounts; another player's is the API's 404. */
export async function removePayoutAccount(
  ctx: SessionContext,
  session: Session,
  id: string,
): Promise<void> {
  await withSession(ctx, session, (authorization) =>
    upstream("Payments", { ...ctx, authorization }).DELETE(
      "/v1/me/payout-accounts/{id}",
      { params: { path: { id } } },
    ),
  );
}

/**
 * Requests a withdrawal for the signed-in player (C04 §6).
 *
 * `Idempotency-Key` is the browser's — one per withdrawal intent, sent again
 * only when that request had no answer — and goes upstream unchanged; this
 * never makes one. An expired access token is refreshed and the POST sent
 * again once, with the same key, so a withdrawal that was accepted comes back
 * as the same withdrawal, never a second.
 */
export async function createWithdrawal(
  ctx: SessionContext,
  session: Session,
  request: WithdrawalRequest,
  idempotencyKey: string,
): Promise<Withdrawal> {
  const withdrawal = await withSession(ctx, session, (authorization) =>
    upstream("Payments", { ...ctx, authorization }).POST("/v1/withdrawals", {
      // A required header parameter in the contract, so typed as one.
      params: { header: { "Idempotency-Key": idempotencyKey } },
      body: toWithdrawalRequest(request),
    }),
  );
  return toWithdrawal(withdrawal);
}

/** One of the player's withdrawals (`GET /v1/withdrawals/{id}`); another player's is the API's 404. */
export async function loadWithdrawal(
  ctx: SessionContext,
  session: Session,
  id: string,
): Promise<Withdrawal> {
  const withdrawal = await withSession(ctx, session, (authorization) =>
    upstream("Payments", { ...ctx, authorization }).GET(
      "/v1/withdrawals/{id}",
      { params: { path: { id } } },
    ),
  );
  return toWithdrawal(withdrawal);
}

/**
 * Cancels a withdrawal while it is `requested` or in `review`
 * (`DELETE /v1/withdrawals/{id}`): the answer is the cancelled withdrawal,
 * its money back in cash. Too late is the API's 409
 * `PAY_WITHDRAWAL_NOT_CANCELLABLE`.
 */
export async function cancelWithdrawal(
  ctx: SessionContext,
  session: Session,
  id: string,
): Promise<Withdrawal> {
  const withdrawal = await withSession(ctx, session, (authorization) =>
    upstream("Payments", { ...ctx, authorization }).DELETE(
      "/v1/withdrawals/{id}",
      { params: { path: { id } } },
    ),
  );
  return toWithdrawal(withdrawal);
}
