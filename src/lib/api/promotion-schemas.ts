/**
 * The promotion schemas (F7ca): what this app's promotion routes answer, and
 * the one body the browser may send them. Each carries `satisfies
 * z.ZodType<Domain>`, as `schemas.ts` does, so a schema and its interface
 * cannot drift.
 */
import { z } from "zod";
import type {
  ActiveBonus,
  FreeBet,
  MyBonuses,
  Promotion,
  RedeemResult,
} from "@/features/promotions/types";
import { moneySchema } from "./money-schema";

const timestampSchema = z.iso.datetime({ offset: true });

export const promotionSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  terms: z.string().nullable(),
  imageUrl: z.url({ protocol: /^https$/ }).nullable(),
  startsAt: timestampSchema.nullable(),
  endsAt: timestampSchema.nullable(),
  requiresCode: z.boolean(),
}) satisfies z.ZodType<Promotion>;

/** `/api/promotions`. */
export const promotionsSchema = z.array(promotionSchema);

const activeBonusSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  amount: moneySchema,
  wageringRequired: moneySchema,
  wageringDone: moneySchema,
  expiresAt: timestampSchema,
}) satisfies z.ZodType<ActiveBonus>;

const freeBetSchema = z.object({
  id: z.string(),
  stake: moneySchema,
  minLegs: z.number().int().nonnegative(),
  minLegOdds: z.string().nullable(),
  minTotalOdds: z.string().nullable(),
  expiresAt: timestampSchema,
}) satisfies z.ZodType<FreeBet>;

/** `/api/me/bonuses`. */
export const myBonusesSchema = z.object({
  active: activeBonusSchema.nullable(),
  freeBets: z.array(freeBetSchema),
}) satisfies z.ZodType<MyBonuses>;

/** `/api/promo-codes/redeem`'s answer. */
export const redeemResultSchema = z.object({
  result: z.enum(["granted", "pending_deposit"]),
  message: z.string().nullable(),
}) satisfies z.ZodType<RedeemResult>;

/**
 * The body `/api/promo-codes/redeem` takes: the contract's `{ code }`, at most
 * 32 characters (its `maxLength`), and nothing else. The contract sets no
 * alphabet, so none is set here; the browser trims what was typed.
 */
export const redeemCodeSchema = z
  .object({ code: z.string().min(1).max(32) })
  .strict();
