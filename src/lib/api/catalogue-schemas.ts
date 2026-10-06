/**
 * The catalogue's runtime contracts: sports, competitions, fixtures, markets,
 * the board, a fixture's book and search (F0), in a module of their own so the
 * shop kiosk can check what it reads without loading every player schema
 * (F8b review Q3, F8ca).
 * `schemas.ts` re-exports them; nothing else changes for the player.
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

export const competitionSchema = z.object({
  id: z.string(),
  sportId: z.string(),
  name: localizedSchema,
  round: localizedSchema,
  region: regionSchema,
}) satisfies z.ZodType<Competition>;

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

export const competitionSummarySchema = z.object({
  id: z.string(),
  name: localizedSchema,
  eventCount: z.number().int().nonnegative(),
  flag: z.string().nullable(),
}) satisfies z.ZodType<CompetitionSummary>;

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
