import "server-only";
import type { BetReceipt, PlaceBetRequest } from "@/features/bet-slip/types";
import { toBetReceipt, toPlaceBetRequest } from "@/lib/api/mappers/bets";
import { withSession, type Session, type SessionContext } from "./session";
import { upstream } from "./upstream";

/**
 * Places a bet for the signed-in player (C08 §7).
 *
 * `Idempotency-Key` is the browser's — made once per intent, sent again only
 * when that same request had no answer — and goes upstream unchanged; this
 * never makes one. An expired access token is refreshed and the POST sent
 * again once, with the same key, so a bet that did reach the engine comes back
 * as the same ticket rather than a second stake. Refusals pass through as
 * `UpstreamError`, Problem intact (`BET_ODDS_CHANGED` with `errors[].current`).
 */
export async function placeBet(
  ctx: SessionContext,
  session: Session,
  request: PlaceBetRequest,
  idempotencyKey: string,
): Promise<BetReceipt> {
  const placed = await withSession(ctx, session, (authorization) =>
    upstream("Bets", { ...ctx, authorization }).POST("/v1/bets", {
      // A required header parameter in the contract, so typed as one.
      params: { header: { "Idempotency-Key": idempotencyKey } },
      body: toPlaceBetRequest(request),
    }),
  );
  return toBetReceipt(placed);
}
