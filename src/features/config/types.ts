import type { RuleSetJson } from "@golden/slipcalc";
import type { OddsPolicy } from "@/features/bet-slip/types";

/**
 * The tenant's betting rules (D1.12), as the slip needs them.
 *
 * `calc` is slipcalc's own input — the contract's `RuleSet` minus what the
 * calculator does not read — kept in the contract's snake_case so nothing is
 * renamed on the way in and back on the way to slipcalc.
 */
export interface BettingRules {
  /** `rules_version`: the config version a bet is priced under. */
  version: number;
  /** Amounts that set the total stake in one tap (D7). */
  quickStakes: string[];
  /** Where the slip's odds-change setting starts (`default_odds_policy`, C08 §9). */
  defaultOddsPolicy: OddsPolicy;
  calc: RuleSetJson;
}

/** The tenant's switches the web app acts on (`PublicConfig.features`). */
export interface TenantFeatures {
  /** Book bet, load a code and `/b/{code}` (C09). */
  bookingCodes: boolean;
}

/** What the tenant's registration consent and age copy need (`PublicConfig.legal`). */
export interface TenantLegal {
  /**
   * The terms the phone step's consent accepts; registration sends it back
   * and the server refuses it once it is no longer current. Null when the
   * tenant has none configured.
   */
  termsVersion: string | null;
  /** The minimum age the age consent states; null when the config says none. */
  minAge: number | null;
}

/** What `/api/config` returns. F1 and F2a add branding and languages. */
export interface PublicConfigView {
  betting: BettingRules;
  features: TenantFeatures;
  legal: TenantLegal;
}
