/**
 * Promotions (C11, F7ca): the tenant's offers, the player's bonus and free
 * bets, and what redeeming a promo code answered. Money and odds stay the
 * contract's decimal strings (FD4); nothing here is computed in the browser.
 */

/** One of the tenant's offers (`Promotion`), in the language it was read in. */
export interface Promotion {
  id: string;
  title: string;
  summary: string;
  /** The offer's terms as the API wrote them (Markdown, shown as text); null when none. */
  terms: string | null;
  /** An https image for the offer, or null. */
  imageUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** The offer is taken up by typing a promo code. */
  requiresCode: boolean;
}

/** The player's bonus in progress (`MyBonuses.active`): the API's figures. */
export interface ActiveBonus {
  id: string;
  /** The offer it came from, when the API names it. */
  title: string | null;
  amount: string;
  wageringRequired: string;
  wageringDone: string;
  expiresAt: string;
}

/** A free bet the player holds, with the conditions the API set on it. */
export interface FreeBet {
  id: string;
  stake: string;
  minLegs: number;
  /** Each pick's odds must be at least this; null when there is no such condition. */
  minLegOdds: string | null;
  /** The bet's total odds must be at least this; null when there is no such condition. */
  minTotalOdds: string | null;
  expiresAt: string;
}

/** `/api/me/bonuses`. */
export interface MyBonuses {
  active: ActiveBonus | null;
  freeBets: FreeBet[];
}

/**
 * What a redeemed code did: its reward is in (`granted`), or it applies to the
 * next deposit (`pending_deposit`). `message` is the API's own words.
 */
export interface RedeemResult {
  result: "granted" | "pending_deposit";
  message: string | null;
}
