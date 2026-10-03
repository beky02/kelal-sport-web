import "server-only";
import type { BetReceipt, PlaceBetRequest } from "@/features/bet-slip/types";
import type { Bet, BetPage, BetsTab } from "@/features/bets/types";
import {
  toBet,
  toBetPage,
  toBetReceipt,
  toPlaceBetRequest,
} from "@/lib/api/mappers/bets";
import { withSession, type Session, type SessionContext } from "./session";
import { both, upstream } from "./upstream";

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

/**
 * One page of the player's bets (`GET /v1/bets`), names in both languages.
 *
 * The two reads go out together: an expired token is refreshed once for both
 * (`withSession` shares the refresh), so a refresh token is never replayed.
 */
export async function loadMyBets(
  ctx: SessionContext,
  session: Session,
  query: { status: BetsTab; cursor: string | null },
): Promise<BetPage> {
  const pair = await both((lang) =>
    withSession({ ...ctx, lang }, session, (authorization) =>
      upstream("Bets", { ...ctx, lang, authorization }).GET("/v1/bets", {
        params: {
          query: {
            status: query.status,
            ...(query.cursor ? { cursor: query.cursor } : {}),
          },
        },
      }),
    ),
  );
  return toBetPage(pair);
}

/** One of the player's bets (`GET /v1/bets/{id}`); another player's is the API's 404. */
export async function loadMyBet(
  ctx: SessionContext,
  session: Session,
  id: string,
): Promise<Bet> {
  const pair = await both((lang) =>
    withSession({ ...ctx, lang }, session, (authorization) =>
      upstream("Bets", { ...ctx, lang, authorization }).GET("/v1/bets/{id}", {
        params: { path: { id } },
      }),
    ),
  );
  return toBet(pair);
}
