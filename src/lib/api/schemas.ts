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
import type { Bet, BetLeg, BetPage, Transaction } from "@/features/bets/types";
import type { BetReceipt, PlaceBetRequest } from "@/features/bet-slip/types";
import type { BettingRules, PublicConfigView } from "@/features/config/types";
import type {
  Booking,
  BookingReceipt,
  BookingRequest,
} from "@/features/bookings/types";
import { BOOKING_CODE } from "@/features/bookings/lib/code";
import type { TicketCheck } from "@/features/tickets/types";
import type {
  FaydaChallengeView,
  FaydaStartForm,
  FaydaVerifyForm,
  KycResultView,
  LoginForm,
  LoginResult,
  OtpChallengeView,
  OtpRequestForm,
  PasswordResetForm,
  Player,
  PlayerSummary,
  RegisterForm,
  RegisterResult,
  SessionView,
} from "@/features/auth/types";
import { isIsoDate } from "@/features/auth/lib/birth-date";
import { toE164 } from "@/features/auth/lib/phone";
import { compareMoney } from "@/lib/money";
import { MONEY_PATTERN, ODDS_PATTERN, TICKET_NUMBER_PATTERN } from "./patterns";
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

// ── My bets (F5b) ───────────────────────────────────────────────────────────

/** The contract's `BetStatus` and `LegResult`. */
export const betStatusSchema = z.enum([
  "open",
  "won",
  "lost",
  "void",
  "cashed_out",
  "cancelled",
]);
export const legResultSchema = z.enum([
  "open",
  "win",
  "lose",
  "void",
  "half_win",
  "half_lose",
]);

const betLegSchema = z.object({
  outcomeId: z.string().min(1),
  fixtureId: z.string().min(1),
  match: localizedSchema,
  market: localizedSchema,
  pick: localizedSchema,
  startTime: z.string(),
  odds: z.string().regex(ODDS_PATTERN),
  result: legResultSchema,
}) satisfies z.ZodType<BetLeg>;

/** A ticket as `/api/bets` answers it: the API's figures, in its own patterns. */
export const betSchema = z.object({
  id: z.string().min(1),
  ticketId: z.string().regex(TICKET_NUMBER_PATTERN),
  status: betStatusSchema,
  betType: z.enum(["single", "multiple", "system"]),
  systemSizes: z.array(z.number().int().positive()),
  lines: z.number().int().positive(),
  stake: z.string().regex(MONEY_PATTERN),
  stakeBonus: z.string().regex(MONEY_PATTERN).nullable(),
  stakeTax: z.string().regex(MONEY_PATTERN),
  // Not the per-leg Odds pattern: the product of an accumulator's odds runs to
  // eight digits and more (D1.11; golden CAP_DEFAULT_HUGE_ODDS).
  totalOdds: oddsSchema.nullable(),
  potentialPayout: z.string().regex(MONEY_PATTERN),
  accaBonus: z.string().regex(MONEY_PATTERN),
  payout: z.string().regex(MONEY_PATTERN).nullable(),
  winTax: z.string().regex(MONEY_PATTERN).nullable(),
  legs: z.array(betLegSchema).min(1),
  placedAt: z.string(),
  settledAt: z.string().nullable(),
}) satisfies z.ZodType<Bet>;

export const betPageSchema = z.object({
  items: z.array(betSchema),
  nextCursor: z.string().min(1).nullable(),
}) satisfies z.ZodType<BetPage>;

/**
 * The public check's ticket. It never passes through `apiClient` — the page
 * is rendered on the server — so the loader checks it here: an answer that
 * isn't a ticket is a failure, not a broken page.
 */
export const ticketCheckSchema = z.object({
  ticketId: z.string().regex(TICKET_NUMBER_PATTERN),
  status: z.enum([...betStatusSchema.options, "paid", "expired"]),
  betType: z.enum(["single", "multiple", "system"]),
  placedAt: z.string(),
  settledAt: z.string().nullable(),
  stake: z.string().regex(MONEY_PATTERN),
  payout: z.string().regex(MONEY_PATTERN).nullable(),
  legs: z
    .array(
      z.object({
        match: localizedSchema,
        market: localizedSchema,
        pick: localizedSchema,
        odds: z.string().regex(ODDS_PATTERN),
        result: legResultSchema,
      }),
    )
    .min(1),
}) satisfies z.ZodType<TicketCheck>;

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

export const publicConfigSchema = z.object({
  betting: bettingRulesSchema,
  features: z.object({ bookingCodes: z.boolean() }),
  legal: z.object({
    termsVersion: z.string().nullable(),
    minAge: z.number().int().positive().nullable(),
  }),
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

// ── placing a bet (F5a) ─────────────────────────────────────────────────────

/** The contract's `Odds` and `Money` patterns: what may be sent upstream. */
const contractOddsSchema = z.string().regex(ODDS_PATTERN);
const contractMoneySchema = z.string().regex(MONEY_PATTERN);

/**
 * What `/api/bets` accepts from the browser — strict, within the contract's
 * bounds, checked before anything is sent on. Amounts and odds must already be
 * in the contract's form: nothing is reformatted on the way to the engine.
 */
export const placeBetRequestSchema = z
  .strictObject({
    betType: betTypeSchema,
    systemSizes: z.array(z.number().int().min(1).max(30)).max(30),
    legs: z
      .array(
        z.strictObject({
          outcomeId: z.string().min(1).max(64),
          odds: contractOddsSchema,
        }),
      )
      .min(1)
      .max(30),
    stake: contractMoneySchema.refine(
      (stake) => compareMoney(stake, "0.00") > 0,
      "Not a stake",
    ),
    oddsPolicy: oddsPolicySchema,
  })
  .refine(
    (r) => new Set(r.legs.map((leg) => leg.outcomeId)).size === r.legs.length,
    "The same pick twice",
  )
  .refine(
    (r) => (r.betType === "system") === r.systemSizes.length > 0,
    "Sizes are for a system bet",
  ) satisfies z.ZodType<PlaceBetRequest>;

/** `/api/bets`'s answer: the engine's ticket. No balance, no token. */
export const betReceiptSchema = z.object({
  id: z.string().min(1),
  ticketId: z.string().regex(TICKET_NUMBER_PATTERN),
  placedAt: z.string(),
  betType: betTypeSchema,
  systemSizes: z.array(z.number().int().positive()),
  lines: z.number().int().positive(),
  legCount: z.number().int().positive(),
  stake: moneySchema,
  stakeTax: moneySchema,
  totalOdds: oddsSchema.nullable(),
  accaBonus: moneySchema,
  potentialPayout: moneySchema,
}) satisfies z.ZodType<BetReceipt>;

// ── session (F4a) ───────────────────────────────────────────────────────────

const langSchema = z.enum(["en", "am"]);

const kycStatusSchema = z.enum([
  "unverified",
  "pending",
  "verified",
  "rejected",
  "needs_info",
  "expired",
]);

export const playerSchema = z.object({
  id: z.string(),
  phone: z.string(),
  fullName: z.string(),
  dateOfBirth: z.string().nullable(),
  language: langSchema,
  status: z.enum(["active", "suspended", "self_excluded", "closed"]),
  kycStatus: kycStatusSchema,
  marketingConsent: z.boolean().nullable(),
  createdAt: z.string().nullable(),
  canWithdraw: z.boolean().nullable(),
  flags: z.object({
    realityCheckMinutes: z.number().int().nullable(),
    excludedUntil: z.string().nullable(),
  }),
}) satisfies z.ZodType<Player>;

/** `/api/me`: who is signed in, or nobody. */
export const sessionViewSchema = z.object({
  player: playerSchema.nullable(),
}) satisfies z.ZodType<SessionView>;

export const playerSummarySchema = z.object({
  id: z.string(),
  phone: z.string(),
  fullName: z.string().nullable(),
  kycStatus: kycStatusSchema,
  language: langSchema.nullable(),
}) satisfies z.ZodType<PlayerSummary>;

/** `/api/auth/login`'s answer. No token can pass this schema. */
export const loginResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), player: playerSummarySchema }),
  z.object({
    status: z.literal("otp_required"),
    challengeId: z.string(),
    expiresIn: z.number().int().nullable(),
  }),
]) satisfies z.ZodType<LoginResult>;

const phoneFieldSchema = z
  .string()
  .max(20)
  .refine((phone) => toE164(phone) !== null, "Not an Ethiopian mobile number");

/** The contract's six-digit SMS code. */
const codeSchema = z.string().regex(/^\d{6}$/);
const idSchema = z.string().min(1).max(64);

/**
 * What `/api/auth/login` accepts from the browser; checked before anything is
 * sent on, and strict so nothing extra rides along.
 */
export const loginFormSchema = z.strictObject({
  phone: phoneFieldSchema,
  password: z.string().min(1).max(128),
  challengeId: idSchema.optional(),
  otp: codeSchema.optional(),
}) satisfies z.ZodType<LoginForm>;

// ── registration, reset, KYC (F4b) ──────────────────────────────────────────

/** `/api/auth/otp`'s answer: a code on its way. */
export const otpChallengeSchema = z.object({
  challengeId: z.string(),
  expiresIn: z.number().int(),
  resendAfter: z.number().int(),
}) satisfies z.ZodType<OtpChallengeView>;

/** `/api/auth/register`'s answer. No token can pass this schema. */
export const registerResultSchema = z.object({
  player: playerSummarySchema,
}) satisfies z.ZodType<RegisterResult>;

/** `/api/kyc/fayda/otp`'s answer. */
export const faydaChallengeSchema = z.object({
  caseId: z.string(),
  otpSentTo: z.string(),
  expiresIn: z.number().int(),
}) satisfies z.ZodType<FaydaChallengeView>;

/** `/api/kyc/fayda/verify`'s answer: Fayda's verdict. */
export const kycResultSchema = z.object({
  status: z.enum(["verified", "pending", "needs_info", "rejected"]),
  reasonCode: z
    .enum([
      "NAME_MISMATCH",
      "DOB_MISMATCH",
      "DOC_UNREADABLE",
      "UNDERAGE",
      "OTHER",
    ])
    .nullable(),
}) satisfies z.ZodType<KycResultView>;

/**
 * What the F4b route handlers accept from the browser — strict, within the
 * contract's bounds, checked before anything is sent on. Prism answers a body
 * it cannot validate with an unrelated example, and the real API should never
 * see one this app could have refused.
 */
export const otpRequestFormSchema = z.strictObject({
  phone: phoneFieldSchema,
  // The login code comes from login's own 202, never from here.
  purpose: z.enum(["register", "reset"]),
}) satisfies z.ZodType<OtpRequestForm>;

export const registerFormSchema = z.strictObject({
  challengeId: idSchema,
  otp: codeSchema,
  fullName: z.string().trim().min(3).max(100),
  dateOfBirth: z.string().refine((value) => isIsoDate(value), "Not a date"),
  password: z.string().min(8).max(128),
  // The consent the phone step required, and the terms version it showed.
  acceptTerms: z.literal(true),
  termsVersion: z.string().max(64),
}) satisfies z.ZodType<RegisterForm>;

export const passwordResetFormSchema = z.strictObject({
  challengeId: idSchema,
  otp: codeSchema,
  newPassword: z.string().min(8).max(128),
}) satisfies z.ZodType<PasswordResetForm>;

export const faydaStartFormSchema = z.strictObject({
  // The contract's bounds; the ID step itself asks for the 12-digit FIN.
  faydaNumber: z.string().regex(/^[A-Za-z0-9]{12,16}$/),
}) satisfies z.ZodType<FaydaStartForm>;

export const faydaVerifyFormSchema = z.strictObject({
  caseId: idSchema,
  otp: codeSchema,
}) satisfies z.ZodType<FaydaVerifyForm>;
