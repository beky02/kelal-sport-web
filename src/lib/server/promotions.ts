import "server-only";
import type {
  MyBonuses,
  Promotion,
  RedeemResult,
} from "@/features/promotions/types";
import {
  toMyBonuses,
  toPromotions,
  toRedeemResult,
} from "@/lib/api/mappers/promotions";
import { withSession, type Session, type SessionContext } from "./session";
import { unwrap, upstream, type RequestContext } from "./upstream";

/**
 * Promotions (C11 §6): the tenant's offers, anyone's to read, and the
 * signed-in player's bonus and promo codes. Refusals pass through as
 * `UpstreamError`, Problem intact.
 */

/**
 * The tenant's current offers (`GET /v1/promotions`), in the UI's language —
 * their titles and terms are the API's text. A public read: no player's token
 * goes with it, signed in or not.
 */
export async function loadPromotions(
  ctx: RequestContext,
): Promise<Promotion[]> {
  const { items } = unwrap(
    await upstream("Promotions", {
      tenant: ctx.tenant,
      lang: ctx.lang,
      prefer: ctx.prefer,
    }).GET("/v1/promotions"),
  );
  return toPromotions(items);
}

/** The player's bonus in progress and free bets (`GET /v1/me/bonuses`). */
export async function loadMyBonuses(
  ctx: SessionContext,
  session: Session,
): Promise<MyBonuses> {
  const bonuses = await withSession(ctx, session, (authorization) =>
    upstream("Promotions", { ...ctx, authorization }).GET("/v1/me/bonuses"),
  );
  return toMyBonuses(bonuses);
}

/**
 * Redeems a promo code for the signed-in player
 * (`POST /v1/promo-codes/redeem`). `Idempotency-Key` is the browser's — one
 * per intent, sent again only when that request had no answer — and goes
 * upstream unchanged; this never makes one.
 */
export async function redeemPromoCode(
  ctx: SessionContext,
  session: Session,
  code: string,
  idempotencyKey: string,
): Promise<RedeemResult> {
  const answer = await withSession(ctx, session, (authorization) =>
    upstream("Promotions", { ...ctx, authorization }).POST(
      "/v1/promo-codes/redeem",
      {
        // A required header parameter in the contract, so typed as one.
        params: { header: { "Idempotency-Key": idempotencyKey } },
        body: { code },
      },
    ),
  );
  return toRedeemResult(answer);
}
