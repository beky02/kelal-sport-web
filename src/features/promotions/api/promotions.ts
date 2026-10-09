import { apiClient } from "@/lib/api/client";
import {
  myBonusesSchema,
  promotionsSchema,
  redeemResultSchema,
} from "@/lib/api/promotion-schemas";
import type { MyBonuses, Promotion, RedeemResult } from "../types";

/**
 * How long one try to redeem a code may take — every request it makes —
 * before the page says it couldn't confirm it. Past this the player is
 * offered Try again, which sends the same code with the same key.
 */
export const redeemDeadline = (): AbortSignal => AbortSignal.timeout(30_000);

/** The tenant's offers, in the page's language (`/api/promotions`). */
export const getPromotions = (signal?: AbortSignal): Promise<Promotion[]> =>
  apiClient.get("/promotions", promotionsSchema, { signal });

/** The player's bonus in progress and free bets (`/api/me/bonuses`). */
export const getMyBonuses = (signal?: AbortSignal): Promise<MyBonuses> =>
  apiClient.get("/me/bonuses", myBonusesSchema, { signal });

/**
 * Redeems a promo code through `/api/promo-codes/redeem` (C11).
 *
 * `idempotencyKey` is one per intent (`promo.store.ts`): Try again sends the
 * same code with the same key, so the API answers as it did the first time
 * instead of redeeming it again.
 */
export const redeemPromoCode = (
  code: string,
  idempotencyKey: string,
  deadline: AbortSignal,
): Promise<RedeemResult> =>
  apiClient.post(
    "/promo-codes/redeem",
    redeemResultSchema,
    { code },
    { headers: { "Idempotency-Key": idempotencyKey }, signal: deadline },
  );
