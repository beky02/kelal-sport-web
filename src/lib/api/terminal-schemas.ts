/**
 * The shop terminal's runtime contracts (F8b), apart from `schemas.ts` so the
 * kiosk's bundle carries these and none of the player's: Zod schemas are
 * top-level calls a bundler can't drop, and `schemas.ts` holds every market,
 * slip, bet and booking schema (review Q3). Each carries `satisfies
 * z.ZodType<Domain>`, as there.
 */
import { z } from "zod";
import type {
  ActivationForm,
  TerminalActivation,
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
