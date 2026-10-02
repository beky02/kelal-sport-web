/**
 * Runtime contracts for everything crossing the API boundary.
 *
 * Each schema carries a `satisfies z.ZodType<Domain>` assertion, so if a domain
 * interface and its schema ever drift the typecheck fails rather than the
 * validation silently narrowing at runtime.
 */
import { z } from "zod";
import type { Localized } from "@/types/common";
import type {
  Competition,
  CompetitionSummary,
  CountryWithLeagues,
  Region,
} from "@/features/competitions/types";
import type {
  BoardSection,
  EventDetail,
  SportEvent,
  Team,
} from "@/features/events/types";
import type { Market, MarketGroup, Outcome } from "@/features/markets/types";
import type { SearchResults } from "@/features/search/types";
import type { Sport } from "@/features/sports/types";
import type { Bet, Transaction } from "@/features/bets/types";
import type { BettingRules, PublicConfigView } from "@/features/config/types";
import type {
  Booking,
  BookingReceipt,
  BookingRequest,
} from "@/features/bookings/types";
import { BOOKING_CODE } from "@/features/bookings/lib/code";
import { compareMoney } from "@/lib/money";
import type {
  PaymentMethod,
  PaymentResult,
  WalletOverview,
} from "@/features/wallet/types";

export const localizedSchema = z.object({
  en: z.string(),
  am: z.string(),
}) satisfies z.ZodType<Localized>;

export const crestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("flag"), src: z.string() }),
  z.object({
    kind: z.literal("initials"),
    initials: z.string(),
    background: z.string(),
    foreground: z.string(),
  }),
  z.object({ kind: z.literal("none") }),
]);

export const sportSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: localizedSchema,
  eventCount: z.number().int().nonnegative(),
  liveCount: z.number().int().nonnegative(),
  iconPaths: z.array(z.string()).readonly(),
}) satisfies z.ZodType<Sport>;

export const regionSchema = z.object({
  code: z.string().nullable(),
  name: localizedSchema,
  flag: z.string().nullable(),
}) satisfies z.ZodType<Region>;

export const countryWithLeaguesSchema = z.object({
  code: z.string(),
  name: localizedSchema,
  flag: z.string().nullable(),
  leagues: z.array(
    z.object({
      id: z.string(),
      name: localizedSchema,
      eventCount: z.number().int().nonnegative(),
    }),
  ),
}) satisfies z.ZodType<CountryWithLeagues>;

export const competitionSchema = z.object({
  id: z.string(),
  sportId: z.string(),
  name: localizedSchema,
  round: localizedSchema,
  region: regionSchema,
}) satisfies z.ZodType<Competition>;

export const competitionSummarySchema = z.object({
  id: z.string(),
  name: localizedSchema,
  eventCount: z.number().int().nonnegative(),
  flag: z.string().nullable(),
}) satisfies z.ZodType<CompetitionSummary>;

export const teamSchema = z.object({
  id: z.string(),
  name: localizedSchema,
  crest: crestSchema,
}) satisfies z.ZodType<Team>;

export const eventSchema = z.object({
  id: z.string(),
  sportId: z.string(),
  competitionId: z.string(),
  home: teamSchema,
  away: teamSchema,
  status: z.enum(["scheduled", "starting_soon", "live", "finished"]),
  suspended: z.boolean(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kickoff: z.string().nullable(),
  minute: z.string().nullable(),
  score: z
    .object({ home: z.number().int(), away: z.number().int() })
    .nullable(),
  startsInMinutes: z.number().int().nullable(),
  marketCount: z.number().int().nonnegative(),
}) satisfies z.ZodType<SportEvent>;

/**
 * Odds stay the contract's decimal strings (FD4). A number arriving here is a
 * mapping bug we want to hear about, so this deliberately does not coerce.
 */
export const oddsSchema = z.string().regex(/^\d+(\.\d{1,3})?$/);

/** A decimal-string amount of money, `"1250.00"`. */
export const moneySchema = z.string().regex(/^-?\d+\.\d{2}$/);

export const outcomeSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: localizedSchema,
  odds: oddsSchema.nullable(),
  previousOdds: oddsSchema.nullable(),
  movement: z.enum(["up", "down"]).nullable(),
}) satisfies z.ZodType<Outcome>;

export const marketSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  templateId: z.string(),
  type: z.enum(["1x2", "ml", "dc", "ou", "btts", "hc", "cs", "other"]),
  category: z.string(),
  name: localizedSchema,
  title: localizedSchema,
  line: z.string().nullable(),
  status: z.enum(["open", "suspended"]),
  outcomes: z.array(outcomeSchema),
}) satisfies z.ZodType<Market>;

export const boardSectionSchema = z.object({
  competition: competitionSchema,
  events: z.array(
    z.object({
      event: eventSchema,
      markets: z.object({
        matchResult: marketSchema.nullable(),
        doubleChance: marketSchema.nullable(),
        totalGoals: marketSchema.nullable(),
      }),
    }),
  ),
}) satisfies z.ZodType<BoardSection>;

export const marketGroupSchema = z.object({
  code: z.string(),
  name: localizedSchema,
}) satisfies z.ZodType<MarketGroup>;

/** `null` when the fixture does not exist. */
export const eventDetailSchema = z
  .object({
    event: eventSchema,
    competition: competitionSchema,
    markets: z.array(marketSchema),
    groups: z.array(marketGroupSchema),
  })
  .nullable() satisfies z.ZodType<EventDetail | null>;

export const searchResultsSchema = z.object({
  leagues: z.array(
    z.object({
      competition: competitionSchema,
      eventCount: z.number().int().nonnegative(),
    }),
  ),
  events: z.array(
    z.object({ event: eventSchema, competition: competitionSchema }),
  ),
}) satisfies z.ZodType<SearchResults>;

const betLegSchema = z.object({
  market: localizedSchema,
  pick: localizedSchema,
  match: localizedSchema,
  odds: oddsSchema,
  status: z.enum(["open", "live", "won", "lost", "void"]),
  result: localizedSchema,
});

export const betSchema = z.object({
  id: z.string(),
  status: z.enum(["open", "won", "lost", "cashed"]),
  live: z.boolean(),
  placedAt: localizedSchema,
  stake: moneySchema,
  cashOutValue: moneySchema.nullable(),
  cashOutBlocked: z.boolean(),
  cashedOutAmount: moneySchema.nullable(),
  legs: z.array(betLegSchema).min(1),
}) satisfies z.ZodType<Bet>;

export const betListSchema = z.object({
  bets: z.array(betSchema),
  counts: z.object({
    open: z.number().int().nonnegative(),
    settled: z.number().int().nonnegative(),
    won: z.number().int().nonnegative(),
    lost: z.number().int().nonnegative(),
  }),
});

export const transactionSchema = z.object({
  id: z.string(),
  kind: z.enum(["deposit", "withdrawal", "bet", "winnings"]),
  status: z.enum(["success", "pending", "failed"]),
  name: localizedSchema,
  meta: localizedSchema,
  amount: moneySchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}) satisfies z.ZodType<Transaction>;

export const transactionDaysSchema = z.array(
  z.object({
    date: z.string(),
    label: localizedSchema,
    items: z.array(transactionSchema),
  }),
);

export const responsibleGamingStatusSchema = z.object({
  coolOffUntil: z.string().nullable(),
  selfExcludedUntil: z.string().nullable(),
});

export const sessionActivitySchema = z.object({
  staked: z.number(),
  won: z.number(),
  net: z.number(),
});

export const walletSchema = z.object({
  balance: z.number(),
  withdrawable: z.number(),
  currency: z.string(),
  dailyDepositLimit: z.number(),
  depositedToday: z.number(),
}) satisfies z.ZodType<WalletOverview>;

export const paymentMethodSchema = z.object({
  id: z.string(),
  name: z.string(),
  mono: z.string(),
  kind: z.enum(["mobile", "gateway"]),
  minAmount: z.number().nonnegative(),
  maxAmount: z.number().positive(),
  supportsWithdrawal: z.boolean(),
}) satisfies z.ZodType<PaymentMethod>;

export const paymentResultSchema = z.object({
  reference: z.string(),
  status: z.enum(["pending", "success", "failed"]),
  amount: z.number(),
  newBalance: z.number(),
}) satisfies z.ZodType<PaymentResult>;

export type BoardSectionDto = z.infer<typeof boardSectionSchema>;

/** A plain decimal string: a rate (`"0.15"`) or a percentage (`"8"`). */
const decimalSchema = z.string().regex(/^\d+(\.\d+)?$/);

export const bettingRulesSchema = z.object({
  version: z.number().int(),
  quickStakes: z.array(moneySchema),
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

export const publicConfigSchema = z.object({
  betting: bettingRulesSchema,
  features: z.object({ bookingCodes: z.boolean() }),
}) satisfies z.ZodType<PublicConfigView>;

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
  oddsAtCode: oddsSchema.nullable(),
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

/** Only http(s): the link is put in front of players and into share links. */
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

/**
 * What `/api/bookings` accepts from the browser; checked before anything is
 * sent on, and strict so nothing extra rides along.
 */
export const bookingRequestSchema = z.strictObject({
  betType: betTypeSchema,
  systemSizes: z.array(z.number().int().min(1).max(30)).max(30),
  outcomeIds: z.array(z.string().min(1).max(64)).min(1).max(30),
  // A hint for whoever loads the code: an amount, never zero or negative.
  stake: moneySchema
    .refine((stake) => compareMoney(stake, "0.00") > 0, "Not a stake")
    .nullable(),
}) satisfies z.ZodType<BookingRequest>;
