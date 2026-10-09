import type {
  ActiveBonus,
  FreeBet,
  MyBonuses,
  Promotion,
  RedeemResult,
} from "@/features/promotions/types";
import type { components, paths } from "@/lib/api/schema";

type ApiPromotion = components["schemas"]["Promotion"];
type ApiMyBonuses = components["schemas"]["MyBonuses"];
type ApiRedeemResult =
  paths["/v1/promo-codes/redeem"]["post"]["responses"]["200"]["content"]["application/json"];

/**
 * Promotions (C11). Pure: contract shape in, domain type out. Money stays the
 * API's decimal strings (FD4); what the API left out stays `null` — never
 * guessed.
 */

/** Text the API sent, or null for none — an empty string says nothing. */
const text = (value: string | null | undefined): string | null =>
  value?.trim() ? value : null;

/**
 * An offer's image, only from an absolute `https:` URL: anything else — plain
 * HTTP, a script or data URL, a path on this site — is no image at all.
 */
function httpsImage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * The tenant's offers (`/v1/promotions`), in the API's order. The rule's
 * `code` (`WELCOME_100`) is the operator's, not something the player types, so
 * it goes no further.
 */
export const toPromotions = (items: ApiPromotion[]): Promotion[] =>
  items.map((offer) => ({
    id: offer.id,
    title: offer.title,
    summary: offer.summary,
    terms: text(offer.terms_md),
    imageUrl: httpsImage(offer.image_url),
    startsAt: offer.starts_at ?? null,
    endsAt: offer.ends_at ?? null,
    requiresCode: offer.requires_code ?? false,
  }));

function toActiveBonus(
  active: NonNullable<ApiMyBonuses["active"]>,
): ActiveBonus {
  return {
    id: active.id,
    title: text(active.title),
    amount: active.amount,
    wageringRequired: active.wagering_required,
    wageringDone: active.wagering_done,
    expiresAt: active.expires_at,
  };
}

/** The player's bonus in progress and free bets (`/v1/me/bonuses`): the API's figures. */
export function toMyBonuses(bonuses: ApiMyBonuses): MyBonuses {
  return {
    active: bonuses.active ? toActiveBonus(bonuses.active) : null,
    freeBets: bonuses.free_bets.map((bet): FreeBet => ({
      id: bet.id,
      stake: bet.stake,
      minLegs: bet.min_legs,
      minLegOdds: text(bet.min_leg_odds),
      minTotalOdds: text(bet.min_total_odds),
      expiresAt: bet.expires_at,
    })),
  };
}

/** What `POST /v1/promo-codes/redeem` answered, its message the API's own words. */
export const toRedeemResult = (answer: ApiRedeemResult): RedeemResult => ({
  result: answer.result,
  message: text(answer.message),
});
