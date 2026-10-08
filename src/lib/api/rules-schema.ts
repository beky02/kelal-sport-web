/**
 * The tenant's rule set as `/api/config` and `/api/terminal/config` return it
 * (`BettingRules`), apart from `schemas.ts` so the kiosk can check its shop
 * rules (`retail_betting`, F8cb) without the player's schema module — as
 * `money-schema.ts` is. `schemas.ts` re-exports it.
 */
import { z } from "zod";
import type { BettingRules } from "@/features/config/types";
import { oddsSchema } from "./catalogue-schemas";
import { moneySchema } from "./money-schema";

/** A plain decimal string: a rate (`"0.15"`) or a percentage (`"8"`). */
const decimalSchema = z.string().regex(/^\d+(\.\d+)?$/);

export const oddsPolicySchema = z.enum(["none", "higher", "any"]);

export const bettingRulesSchema = z.object({
  version: z.number().int(),
  quickStakes: z.array(moneySchema),
  defaultOddsPolicy: oddsPolicySchema,
  calc: z.object({
    min_stake: moneySchema,
    max_stake: moneySchema,
    max_payout: moneySchema,
    max_legs: z.number().int().positive(),
    max_lines: z.number().int().positive(),
    acca_bonus_table: z.array(
      z.object({ min_legs: z.number().int(), pct: decimalSchema }),
    ),
    acca_bonus_min_leg_odds: oddsSchema,
    acca_bonus_max: moneySchema,
    taxes: z.array(
      z.object({
        code: z.string(),
        base: z.enum(["stake", "gross_win", "net_win", "profit"]),
        rate: decimalSchema,
        threshold: moneySchema.optional(),
        deduct_from: z.enum(["stake", "payout", "operator"]),
      }),
    ),
    refund_stake_tax_on_void: z.boolean().optional(),
  }),
}) satisfies z.ZodType<BettingRules>;
