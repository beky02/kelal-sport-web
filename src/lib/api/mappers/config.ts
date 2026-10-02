import type { components } from "@/lib/api/schema";
import type { BettingRules, PublicConfigView } from "@/features/config/types";

type ApiRuleSet = components["schemas"]["RuleSet"];
type ApiPublicConfig = components["schemas"]["PublicConfig"];

/** `RuleSet` → the slip's rules. Amounts stay decimal strings (FD4). */
export function toBettingRules(r: ApiRuleSet): BettingRules {
  return {
    version: r.rules_version,
    quickStakes: r.quick_stakes ?? [],
    calc: {
      min_stake: r.min_stake,
      max_stake: r.max_stake,
      max_payout: r.max_payout,
      max_legs: r.max_legs,
      max_lines: r.max_lines,
      acca_bonus_table: r.acca_bonus_table,
      acca_bonus_min_leg_odds: r.acca_bonus_min_leg_odds,
      acca_bonus_max: r.acca_bonus_max,
      taxes: r.taxes,
      refund_stake_tax_on_void: r.refund_stake_tax_on_void ?? false,
    },
  };
}

/**
 * `/v1/config/public` → what the browser needs. A switch the tenant's config
 * doesn't mention stays on: only an explicit `false` turns a feature off.
 */
export function toPublicConfigView(config: ApiPublicConfig): PublicConfigView {
  return {
    betting: toBettingRules(config.betting),
    features: { bookingCodes: config.features.booking_codes !== false },
    legal: {
      termsVersion: config.legal?.terms_version?.trim() || null,
      minAge: config.legal?.min_age ?? null,
    },
  };
}
