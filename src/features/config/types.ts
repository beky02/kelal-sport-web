import type { RuleSetJson } from "@golden/slipcalc";

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
  calc: RuleSetJson;
}

/** What `/api/config` returns. F1 and F2a add branding and languages. */
export interface PublicConfigView {
  betting: BettingRules;
}
