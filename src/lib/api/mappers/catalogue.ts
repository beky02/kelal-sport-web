/**
 * Contract → domain, for the catalogue.
 *
 * The API speaks one language per request (`Accept-Language`) and names sports,
 * tournaments, markets and outcomes through the dictionary; the UI works in
 * `Localized` pairs and resolved labels. These functions are the only place the
 * two meet. They are pure — the server fetches both languages and hands them in
 * as a `Bilingual` pair — so the contract's own examples can test them.
 */
import type { components } from "@/lib/api/schema";
import type { Crest, Lang, Localized } from "@/types/common";
import type {
  Competition,
  CompetitionSummary,
  CountryWithLeagues,
} from "@/features/competitions/types";
import type {
  BoardSection,
  EventDetail,
  SportEvent,
  Team,
} from "@/features/events/types";
import type {
  Market,
  MarketGroup,
  MarketType,
  Outcome,
} from "@/features/markets/types";
import type { Sport } from "@/features/sports/types";
import type { SearchResults } from "@/features/search/types";
import { SPORT_ICONS } from "@/components/ui/sport-icons";
import { toEat } from "@/lib/i18n/dates";

type Schemas = components["schemas"];
export type Dictionary = Schemas["Dictionary"];
export type ApiEventSummary = Schemas["EventSummary"];
export type ApiEventDetail = Schemas["EventDetail"];
export type ApiMarket = Schemas["Market"];
export type ApiSportCount = Schemas["SportCount"];
export type ApiSearchResult = Schemas["SearchResult"];

/** The same response fetched once per language. */
export type Bilingual<T> = Record<Lang, T>;

/** Kickoff within this many minutes reads "Starts in n min". */
const STARTING_SOON_MINUTES = 60;

const localize = (
  en: string | undefined,
  am: string | undefined,
): Localized => ({
  en: en ?? am ?? "",
  am: am ?? en ?? "",
});

const EMPTY: Localized = { en: "", am: "" };

/** `1` and `2` read as the team, `X` as a draw — as the board has always shown. */
const DRAW: Localized = { en: "Draw", am: "አቻ" };

// ── dictionary lookups ───────────────────────────────────────────────────────

function index<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Indexed dictionary pair, built once per response and passed around. */
export interface Lookup {
  sports: Bilingual<Map<string, Dictionary["sports"][number]>>;
  tournaments: Bilingual<Map<string, Dictionary["tournaments"][number]>>;
  templates: Bilingual<Map<string, Dictionary["market_templates"][number]>>;
  groups: Bilingual<Map<string, string>>;
  /** Dictionary order of everything, from the English copy. */
  source: Dictionary;
}

export function lookup(dict: Bilingual<Dictionary>): Lookup {
  const per = <T>(pick: (d: Dictionary) => T): Bilingual<T> => ({
    en: pick(dict.en),
    am: pick(dict.am),
  });
  return {
    sports: per((d) => index(d.sports)),
    tournaments: per((d) => index(d.tournaments)),
    templates: per((d) => index(d.market_templates)),
    groups: per(
      (d) => new Map((d.market_groups ?? []).map((g) => [g.code, g.name])),
    ),
    source: dict.en,
  };
}

// ── sports ───────────────────────────────────────────────────────────────────

/** The URL carries `football`; the API carries `s_football`. */
export const sportSlug = (id: string): string => id.replace(/^s_/, "");
export const sportIdFromSlug = (slug: string): string => `s_${slug}`;

export function toSports(dict: Lookup, counts: ApiSportCount[]): Sport[] {
  const byId = index(counts);
  return [...dict.source.sports]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((sport) => ({
      id: sport.id,
      slug: sportSlug(sport.id),
      name: localize(sport.name, dict.sports.am.get(sport.id)?.name),
      eventCount: byId.get(sport.id)?.events_count ?? 0,
      // Release 1 is pre-match only (D8).
      liveCount: 0,
      iconPaths: SPORT_ICONS[sport.icon ?? ""] ?? SPORT_ICONS.default,
    }));
}

// ── competitions ─────────────────────────────────────────────────────────────

/** Flag files shipped in `public/flags`. Add the SVG, then the code here. */
const FLAG_FILES = new Set([
  "de",
  "eg",
  "es",
  "et",
  "eu",
  "gb-eng",
  "gh",
  "it",
  "sn",
]);

/**
 * ISO 3166 alpha-2 → flag file. Great Britain's leagues are national ones, so
 * `GB` goes by the dictionary's category ("England") instead.
 */
export function flagFor(
  country: string | null | undefined,
  category?: string,
): string | null {
  if (!country) return null;
  const code = country.toLowerCase();
  const file = code === "gb" && category === "England" ? "gb-eng" : code;
  return FLAG_FILES.has(file) ? `/flags/${file}.svg` : null;
}

export function toCompetition(tournamentId: string, dict: Lookup): Competition {
  const en = dict.tournaments.en.get(tournamentId);
  const am = dict.tournaments.am.get(tournamentId);
  const country = en?.country ?? null;
  return {
    id: tournamentId,
    sportId: en?.sport_id ?? "",
    name: localize(en?.name ?? tournamentId, am?.name),
    // The contract has no rounds yet; the UI drops an empty one.
    round: EMPTY,
    region: {
      code: country,
      name: localize(en?.category ?? country ?? "", am?.category),
      flag: flagFor(country, en?.category),
    },
  };
}

function tournamentCounts(counts: ApiSportCount[]): Map<string, number> {
  return new Map(
    counts.flatMap((sport) =>
      (sport.tournaments ?? []).map((t) => [t.id, t.events_count] as const),
    ),
  );
}

/** Tournaments in dictionary order: by sport, then by the book's own sort. */
function orderedTournaments(dict: Lookup) {
  const sportSort = new Map(dict.source.sports.map((s) => [s.id, s.sort ?? 0]));
  return [...dict.source.tournaments].sort(
    (a, b) =>
      (sportSort.get(a.sport_id) ?? 0) - (sportSort.get(b.sport_id) ?? 0) ||
      (a.sort ?? 0) - (b.sort ?? 0),
  );
}

/** The book's top tournaments with fixtures on offer, in its own order. */
export function toTopCompetitions(
  dict: Lookup,
  counts: ApiSportCount[],
  limit = 5,
): CompetitionSummary[] {
  const n = tournamentCounts(counts);
  return orderedTournaments(dict)
    .filter((t) => (n.get(t.id) ?? 0) > 0)
    .slice(0, limit)
    .map((t) => ({
      id: t.id,
      name: localize(t.name, dict.tournaments.am.get(t.id)?.name),
      eventCount: n.get(t.id) ?? 0,
      flag: flagFor(t.country, t.category),
    }));
}

/** Countries A–Z, each with its tournaments. International ones are left out. */
export function toCountries(
  dict: Lookup,
  counts: ApiSportCount[],
): CountryWithLeagues[] {
  const n = tournamentCounts(counts);
  const countries = new Map<string, CountryWithLeagues>();

  for (const t of orderedTournaments(dict)) {
    if (!t.country) continue;
    const am = dict.tournaments.am.get(t.id);
    const country =
      countries.get(t.country) ??
      ({
        code: t.country,
        name: localize(t.category ?? t.country, am?.category),
        flag: flagFor(t.country, t.category),
        leagues: [],
      } satisfies CountryWithLeagues);
    country.leagues.push({
      id: t.id,
      name: localize(t.name, am?.name),
      eventCount: n.get(t.id) ?? 0,
    });
    countries.set(t.country, country);
  }

  return [...countries.values()].sort((a, b) =>
    a.name.en.localeCompare(b.name.en),
  );
}

// ── events ───────────────────────────────────────────────────────────────────

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * The contract carries no crests or club colours yet, so a club is badged with
 * its initials on neutral tokens. Data saver drops it entirely.
 */
function crestFor(name: string, dataSaver: boolean): Crest {
  if (dataSaver) return { kind: "none" };
  const words = name.split(/\s+/).filter(Boolean);
  const initials =
    words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2);
  return {
    kind: "initials",
    initials: initials.toUpperCase(),
    background: "var(--color-raised)",
    foreground: "var(--color-text)",
  };
}

const toTeam = (
  en: string,
  am: string | undefined,
  dataSaver: boolean,
): Team => ({
  id: slug(en),
  name: localize(en, am),
  crest: crestFor(en, dataSaver),
});

export function toEvent(
  pair: Bilingual<ApiEventSummary | ApiEventDetail>,
  now: Date,
  dataSaver: boolean,
): SportEvent {
  const { en, am } = pair;
  const { date, time } = toEat(en.start_time);
  const minutes = Math.round(
    (Date.parse(en.start_time) - now.getTime()) / 60_000,
  );
  const soon =
    en.status === "not_started" &&
    minutes > 0 &&
    minutes <= STARTING_SOON_MINUTES;

  return {
    id: en.id,
    sportId: en.sport_id,
    competitionId: en.tournament_id,
    home: toTeam(en.home, am.home, dataSaver),
    away: toTeam(en.away, am.away, dataSaver),
    status:
      en.status === "live"
        ? "live"
        : en.status === "not_started" || en.status === "suspended"
          ? soon
            ? "starting_soon"
            : "scheduled"
          : "finished",
    // Postponed, cancelled and abandoned fixtures take no bets either.
    suspended: !["not_started", "live"].includes(en.status),
    startDate: date,
    kickoff: time,
    minute: null,
    score: null,
    startsInMinutes: soon ? minutes : null,
    marketCount: en.markets_count,
  };
}

// ── markets ──────────────────────────────────────────────────────────────────

const MARKET_TYPE: Record<string, MarketType> = {
  m_1x2: "1x2",
  m_ml: "ml",
  m_dc: "dc",
  m_total: "ou",
  m_btts: "btts",
  m_hcp: "hc",
  m_cs: "cs",
};

/** Short codes the board, slip and realtime messages key on. */
const OUTCOME_CODE: Record<string, string> = {
  o_1: "1",
  o_x: "X",
  o_2: "2",
  o_home: "1",
  o_away: "2",
  o_1x: "1X",
  o_12: "12",
  o_x2: "X2",
  o_over: "Over",
  o_under: "Under",
  o_yes: "Yes",
  o_no: "No",
  o_h1: "1",
  o_h2: "2",
};

/** `-1` → `+1`, `1.5` → `-1.5`: the other side of a handicap line. */
const negate = (value: string) =>
  value.startsWith("-") ? `+${value.slice(1)}` : `-${value.replace(/^\+/, "")}`;
const signed = (value: string) =>
  value.startsWith("-") || value.startsWith("+") ? value : `+${value}`;

/**
 * Fills a dictionary template: `Total {total}` with `{total: "2.5"}` →
 * `Total 2.5`; `{+hcp}` and `{-hcp}` are the signed line and its opposite.
 */
export function fillTemplate(
  template: string,
  specifiers: Record<string, string>,
): string {
  return template.replace(
    /\{([+-]?)(\w+)\}/g,
    (match, sign: string, key: string) => {
      const value = specifiers[key];
      if (value === undefined) return match;
      if (sign === "+") return signed(value);
      if (sign === "-") return negate(value);
      return value;
    },
  );
}

/** `"2.10"` → `2.1`. Display only — the slip does its maths on the strings. */
function parseOdds(odds: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(odds)) return null;
  const value = Number(odds);
  return value > 1 ? value : null;
}

export function toMarket(
  eventId: string,
  market: ApiMarket,
  dict: Lookup,
  teams: { home: Localized; away: Localized },
): Market {
  const en = dict.templates.en.get(market.template_id);
  const am = dict.templates.am.get(market.template_id);
  const type = MARKET_TYPE[market.template_id] ?? "other";
  const open = market.status === "active";
  const fill = (name: string | undefined) =>
    name === undefined ? undefined : fillTemplate(name, market.specifiers);

  const label = (tpl: string): Localized => {
    if (type === "1x2" || type === "ml") {
      if (tpl === "o_1" || tpl === "o_home") return teams.home;
      if (tpl === "o_2" || tpl === "o_away") return teams.away;
      if (tpl === "o_x") return DRAW;
    }
    return localize(
      fill(en?.outcomes.find((o) => o.id === tpl)?.name) ??
        OUTCOME_CODE[tpl] ??
        tpl,
      fill(am?.outcomes.find((o) => o.id === tpl)?.name),
    );
  };

  return {
    id: market.id,
    eventId,
    templateId: market.template_id,
    type,
    category: en?.group ?? "main",
    name: localize(fill(en?.name) ?? market.template_id, fill(am?.name)),
    line: market.specifiers.total ?? market.specifiers.hcp ?? null,
    status: open ? "open" : "suspended",
    outcomes: market.outcomes.map((outcome): Outcome => ({
      id: outcome.id,
      code: OUTCOME_CODE[outcome.tpl] ?? outcome.tpl,
      label: label(outcome.tpl),
      odds: open && outcome.active ? parseOdds(outcome.odds) : null,
      previousOdds: null,
      movement: null,
    })),
  };
}

/** Dictionary order for a fixture's markets: by template sort, then line. */
function marketOrder(dict: Lookup) {
  const sort = new Map(
    dict.source.market_templates.map((t) => [t.id, t.sort ?? 0]),
  );
  return (a: Market, b: Market) =>
    (sort.get(a.templateId) ?? 0) - (sort.get(b.templateId) ?? 0) ||
    Number(a.line ?? 0) - Number(b.line ?? 0);
}

// ── screens ──────────────────────────────────────────────────────────────────

/**
 * The board: fixtures grouped by tournament, in the order the API returned
 * them. Only the main market comes with `/v1/events`, so the double-chance
 * and total-goals columns stay empty until the contract carries them.
 */
export function toBoard(
  pages: Bilingual<ApiEventSummary[]>,
  dict: Lookup,
  now: Date,
  dataSaver: boolean,
): BoardSection[] {
  const amById = index(pages.am);
  const sections = new Map<string, BoardSection>();

  for (const en of pages.en) {
    const event = toEvent({ en, am: amById.get(en.id) ?? en }, now, dataSaver);
    const section =
      sections.get(en.tournament_id) ??
      ({
        competition: toCompetition(en.tournament_id, dict),
        events: [],
      } satisfies BoardSection);
    section.events.push({
      event,
      markets: {
        matchResult: en.main
          ? toMarket(en.id, en.main, dict, {
              home: event.home.name,
              away: event.away.name,
            })
          : null,
        doubleChance: null,
        totalGoals: null,
      },
    });
    sections.set(en.tournament_id, section);
  }

  return [...sections.values()];
}

export function toEventDetail(
  pair: Bilingual<ApiEventDetail>,
  dict: Lookup,
  now: Date,
  dataSaver: boolean,
): EventDetail {
  const event = toEvent(pair, now, dataSaver);
  const teams = { home: event.home.name, away: event.away.name };
  const groups: MarketGroup[] = pair.en.groups_available.map((code) => ({
    code,
    name: localize(dict.groups.en.get(code) ?? code, dict.groups.am.get(code)),
  }));

  return {
    event,
    competition: toCompetition(pair.en.tournament_id, dict),
    markets: pair.en.markets
      .map((market) => toMarket(event.id, market, dict, teams))
      .sort(marketOrder(dict)),
    groups,
  };
}

export function toSearchResults(
  pair: Bilingual<ApiSearchResult>,
  dict: Lookup,
  counts: ApiSportCount[],
  now: Date,
  dataSaver: boolean,
): SearchResults {
  const n = tournamentCounts(counts);
  const amEvents = index(pair.am.events);
  return {
    leagues: pair.en.tournaments.map((t) => ({
      competition: toCompetition(t.id, dict),
      eventCount: n.get(t.id) ?? 0,
    })),
    events: pair.en.events.map((en) => ({
      event: toEvent({ en, am: amEvents.get(en.id) ?? en }, now, dataSaver),
      competition: toCompetition(en.tournament_id, dict),
    })),
  };
}
