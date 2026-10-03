import "server-only";
import { routes } from "@/config/routes";
import type {
  Deposit,
  DepositRequest,
  PaymentMethod,
} from "@/features/wallet/types";
import {
  toDeposit,
  toDepositRequest,
  toPaymentMethods,
} from "@/lib/api/mappers/payments";
import { allowedProviderUrl, ownedOrigin } from "./config";
import { withSession, type Session, type SessionContext } from "./session";
import { upstream } from "./upstream";

/**
 * The provider page a deposit may send the player to, as checked — or,
 * logged by its host alone (its path can carry the provider's session),
 * refused: a page the allow-list doesn't name is either a provider not
 * configured here or a response that should never have come back.
 */
function allowedRedirect(url: string): string | null {
  const allowed = allowedProviderUrl(url);
  if (allowed) return allowed;
  let host = "(not a URL)";
  try {
    host = new URL(url).host;
  } catch {
    // Logged as unparseable; nothing of it is repeated.
  }
  console.error(
    `Refused a deposit redirect to a host not on PAYMENT_REDIRECT_HOSTS: ${host}`,
  );
  return null;
}

/**
 * The methods `/v1/payment-methods` offers this player, with their limits, in
 * the UI's language (names are the API's). Availability changes when a
 * provider goes down, so this is never cached here.
 */
export async function loadPaymentMethods(
  ctx: SessionContext,
  session: Session,
): Promise<PaymentMethod[]> {
  const { items } = await withSession(ctx, session, (authorization) =>
    upstream("Payments", { ...ctx, authorization }).GET("/v1/payment-methods"),
  );
  return toPaymentMethods(items);
}

/**
 * Starts a deposit for the signed-in player (C04 §6).
 *
 * `Idempotency-Key` is the browser's — one per deposit intent, sent again only
 * when that request had no answer — and goes upstream unchanged; this never
 * makes one. An expired access token is refreshed and the POST sent again
 * once, with the same key, so a deposit that did start comes back as the same
 * deposit. Where the provider sends the player back is this site's own
 * address for the tenant — a host the tenant owns, never one a request merely
 * arrived on, nor anything the browser said; with no such host it is left to
 * the API. Refusals pass through as `UpstreamError`, Problem intact.
 */
export async function createDeposit(
  ctx: SessionContext,
  session: Session,
  request: DepositRequest,
  idempotencyKey: string,
): Promise<Deposit> {
  const origin = ownedOrigin(ctx.request.headers, ctx.tenant);
  const returnUrl = origin ? `${origin}${routes.depositReturn}` : null;
  const deposit = await withSession(ctx, session, (authorization) =>
    upstream("Payments", { ...ctx, authorization }).POST("/v1/deposits", {
      // A required header parameter in the contract, so typed as one.
      params: { header: { "Idempotency-Key": idempotencyKey } },
      body: toDepositRequest(request, returnUrl),
    }),
  );
  return toDeposit(deposit, allowedRedirect);
}

/** One of the player's deposits (`GET /v1/deposits/{id}`); another player's is the API's 404. */
export async function loadDeposit(
  ctx: SessionContext,
  session: Session,
  id: string,
): Promise<Deposit> {
  const deposit = await withSession(ctx, session, (authorization) =>
    upstream("Payments", { ...ctx, authorization }).GET("/v1/deposits/{id}", {
      params: { path: { id } },
    }),
  );
  return toDeposit(deposit, allowedRedirect);
}
