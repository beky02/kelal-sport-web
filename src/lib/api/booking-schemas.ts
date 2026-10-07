/** Booking boundary schemas, kept out of the player-wide schema bundle. */
import { z } from "zod";
import type {
  Booking,
  BookingReceipt,
  BookingRequest,
} from "@/features/bookings/types";
import { BOOKING_CODE } from "@/features/bookings/lib/code";
import { compareMoney } from "@/lib/money";
import { localizedSchema, oddsSchema } from "./catalogue-schemas";
import { ODDS_PATTERN } from "./patterns";

const moneySchema = z.string().regex(/^-?\d+\.\d{2}$/, { abort: true });
const betTypeSchema = z.enum(["single", "multiple", "system"]);

/** The contract's booking-code alphabet (Crockford base32). */
export const bookingCodeSchema = z.string().regex(BOOKING_CODE);

const bookingLegSchema = z.object({
  outcomeId: z.string(),
  eventId: z.string().nullable(),
  eventName: localizedSchema.nullable(),
  marketId: z.string().nullable(),
  marketName: localizedSchema.nullable(),
  outcomeName: localizedSchema.nullable(),
  startTime: z.string().nullable(),
  odds: oddsSchema.nullable(),
  oddsAtCode: z.string().regex(ODDS_PATTERN).nullable(),
  unavailable: z
    .enum([
      "EVENT_STARTED",
      "MARKET_SUSPENDED",
      "MARKET_CLOSED",
      "NOT_FOUND",
      "UNPRICED",
      "INCOMPLETE",
    ])
    .nullable(),
});

export const bookingSchema = z.object({
  code: bookingCodeSchema,
  betType: betTypeSchema,
  systemSizes: z.array(z.number().int().positive()),
  stakeHint: moneySchema.nullable(),
  expiresAt: z.string(),
  legs: z.array(bookingLegSchema),
}) satisfies z.ZodType<Booking>;

const shareUrlSchema = z
  .string()
  .url()
  .refine((url) => /^https?:\/\//i.test(url), "Not an http(s) link");

export const bookingReceiptSchema = z.object({
  code: bookingCodeSchema,
  expiresAt: z.string(),
  shareUrl: shareUrlSchema,
  issuedAt: z.string(),
}) satisfies z.ZodType<BookingReceipt>;

export const bookingRequestSchema = z.strictObject({
  betType: betTypeSchema,
  systemSizes: z.array(z.number().int().min(1).max(30)).max(30),
  outcomeIds: z.array(z.string().min(1).max(64)).min(1).max(30),
  stake: moneySchema
    .refine((stake) => compareMoney(stake, "0.00") > 0, "Not a stake")
    .nullable(),
}) satisfies z.ZodType<BookingRequest>;
