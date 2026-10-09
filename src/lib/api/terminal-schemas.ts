/**
 * The shop terminal's runtime contracts (F8b), apart from `schemas.ts` so the
 * kiosk's bundle carries these and none of the player's: Zod schemas are
 * top-level calls a bundler can't drop, and `schemas.ts` holds every market,
 * slip, bet and booking schema (review Q3). Each carries `satisfies
 * z.ZodType<Domain>`, as there.
 */
import { z } from "zod";
import type { components } from "@/lib/api/schema";
import { compareMoney } from "@/lib/money";
import { MONEY_PATTERN, ODDS_PATTERN } from "./patterns";
import { bettingRulesSchema } from "./rules-schema";
import type {
  ActivationForm,
  SlipCodeReceipt,
  TerminalActivation,
  TerminalConfigView,
  TerminalInfo,
  TerminalStatus,
  TokenRotation,
} from "@/features/terminal/types";

/** The contract's activation code: 8 Crockford base32 characters. */
export const ACTIVATION_CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/**
 * A P-256 public key as WebCrypto exports it (SPKI, 91 bytes) in base64: the
 * fixed header naming the curve, then the point. Nothing else is a device key.
 */
export const P256_SPKI_BASE64 =
  /^MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE[A-Za-z0-9+/]{86}==$/;

/** What `/api/terminal/activate` accepts — strict, checked before anything is sent on. */
export const activationFormSchema = z.strictObject({
  activationCode: z.string().regex(ACTIVATION_CODE),
  devicePublicKey: z.string().regex(P256_SPKI_BASE64),
}) satisfies z.ZodType<ActivationForm>;

/** `/api/terminal/activate`'s answer. No token can pass this schema. */
export const terminalActivationSchema = z.strictObject({
  id: z.string(),
  label: z.string().nullable(),
  shop: z.strictObject({ code: z.string(), name: z.string() }),
}) satisfies z.ZodType<TerminalActivation>;

const terminalInfoSchema = z.strictObject({
  id: z.string(),
  label: z.string().nullable(),
  shop: z.strictObject({
    code: z.string(),
    name: z.string(),
    openNow: z.boolean(),
  }),
  idleResetSeconds: z.number().int().nullable(),
  codeDisplaySeconds: z.number().int().nullable(),
}) satisfies z.ZodType<TerminalInfo>;

/** `/api/terminal/status`'s answer. */
export const terminalStatusSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("inactive"),
    reason: z.enum(["new", "expired"]),
  }),
  z.strictObject({
    state: z.literal("active"),
    terminal: terminalInfoSchema,
    rotateDue: z.boolean(),
  }),
  z.strictObject({
    state: z.literal("blocked"),
    reason: z.enum(["revoked", "device_not_allowed"]),
  }),
]) satisfies z.ZodType<TerminalStatus>;

/** `/api/terminal/token`'s answer: the token was replaced, and nothing of it shown. */
export const tokenRotationSchema = z.strictObject({
  rotated: z.literal(true),
}) satisfies z.ZodType<TokenRotation>;

/** `/api/terminal/config`'s answer: the kiosk's switches and languages (F8ca). */
export const terminalConfigSchema = z.strictObject({
  retail: z.boolean(),
  bookingCodes: z.boolean(),
  languages: z.array(z.enum(["en", "am"])).min(1),
  defaultLanguage: z.enum(["en", "am"]),
  rules: bettingRulesSchema.nullable(),
}) satisfies z.ZodType<TerminalConfigView>;

/**
 * An outcome id as the slip-code route forwards it: opaque (D3), of URL-safe
 * ASCII, so the text the browser signed is the text that goes on, byte for
 * byte (F8cc decision 4).
 */
const OUTCOME_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * What `/api/terminal/slip-codes` forwards (F8cc): the contract's
 * `SlipCodeCreate`, strict, every field ASCII — checked before anything goes
 * upstream. A stake hint is an amount above zero.
 */
export const slipCodeCreateSchema = z.strictObject({
  bet_type: z.enum(["single", "multiple", "system"]),
  system_sizes: z.array(z.number().int().min(1).max(30)).max(30).optional(),
  legs: z
    .array(
      z.strictObject({
        outcome_id: z.string().regex(OUTCOME_ID),
        odds: z.string().regex(ODDS_PATTERN).optional(),
      }),
    )
    .min(1)
    .max(30),
  stake_hint: z
    .string()
    .regex(MONEY_PATTERN, { abort: true })
    .refine((stake) => compareMoney(stake, "0.00") > 0, "Not a stake")
    .optional(),
}) satisfies z.ZodType<components["schemas"]["SlipCodeCreate"]>;

/** `/api/terminal/slip-codes`'s answer: the code to show (F8cc). */
export const slipCodeReceiptSchema = z.strictObject({
  code: z.string().regex(/^\d{8}$/),
  display: z.string().min(1).max(32),
  expiresAt: z.string(),
  qr: z.string().min(1).max(2048),
}) satisfies z.ZodType<SlipCodeReceipt>;
