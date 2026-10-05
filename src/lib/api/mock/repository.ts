/**
 * In-memory stand-in for the features not yet wired to the contract.
 *
 * The catalogue, auth, bookings and bets no longer come from here: they go
 * through the route handlers to the API, and Prism serves the contract's own
 * examples locally, as do the wallet's balances and history, payment methods,
 * deposits, payout accounts and withdrawals, and — since F7a — limits, breaks
 * and self-exclusion. What is left — session activity (F7b) — moves to the
 * contract next, after which this folder is deleted (F7d).
 *
 * `listBoard` and `listMarkets` remain only as fixtures for the realtime tests,
 * which need live fixtures, scores and many lines per market — shapes the
 * Release 1 contract examples do not have.
 */
import type { Crest, Localized } from "@/types/common";
import type { Competition } from "@/features/competitions/types";
import type {
  BoardMarkets,
  BoardSection,
  EventFilters,
  SportEvent,
  Team,
} from "@/features/events/types";
import type {
  Market,
  MarketCategory,
  MarketType,
  Outcome,
} from "@/features/markets/types";
import {
  CLUB_COLOUR,
  COUNTRIES,
  GROUPS,
  LIGHT_CREST,
  MARKET_MOVEMENT,
  MARKET_TEMPLATE,
  NATIONAL_FLAG,
  REFERENCE_DATE,
  advanceLiveMatchState,
  flagUrl,
  type RawGroup,
  type RawMatch,
} from "./fixtures";

const t = (en: string, am?: string): Localized => ({ en, am: am ?? en });

const normalizeSportId = (sportId?: string): string => {
  if (!sportId) return "soccer";
  const slug = sportId.replace(/^s_/, "");
  return slug === "football" || slug === "soccer" ? "soccer" : sportId;
};

/** Keeps loading and skeleton states honest in development. */
const delay = (ms = 220) => new Promise<void>((r) => setTimeout(r, ms));

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const liveSnapshot = (raw: RawMatch): RawMatch => {
  if (raw.status !== "live" || !raw.id.startsWith("sim-")) return raw;

  const tick = Math.max(1, Math.floor(Date.now() / 7000) % 5);
  return advanceLiveMatchState(raw, tick);
};

// ── teams ───────────────────────────────────────────────────────────────────

function crestFor(name: Localized, dataSaver: boolean): Crest {
  if (dataSaver) return { kind: "none" };

  const flag = NATIONAL_FLAG[name.en];
  if (flag) return { kind: "flag", src: `/flags/${flag}.svg` };

  const initials = name.en.replace(/[^A-Z]/g, "").slice(0, 2) || name.en[0];
  return {
    kind: "initials",
    initials,
    background: CLUB_COLOUR[name.en] ?? "#566172",
    foreground: LIGHT_CREST.has(name.en) ? "#10141a" : "#ffffff",
  };
}

const toTeam = (name: Localized, dataSaver: boolean): Team => ({
  id: slug(name.en),
  name,
  crest: crestFor(name, dataSaver),
});

// ── events ──────────────────────────────────────────────────────────────────

function toEvent(
  raw: RawMatch,
  group: RawGroup,
  dataSaver: boolean,
): SportEvent {
  return {
    id: raw.id,
    sportId: group.sportId,
    competitionId: group.id,
    home: toTeam(raw.home, dataSaver),
    away: toTeam(raw.away, dataSaver),
    status:
      raw.status === "live"
        ? "live"
        : raw.status === "soon"
          ? "starting_soon"
          : "scheduled",
    suspended: raw.suspended ?? false,
    startDate: REFERENCE_DATE,
    kickoff: raw.time ?? null,
    minute: raw.minute ?? null,
    score:
      raw.homeScore === undefined || raw.awayScore === undefined
        ? null
        : { home: raw.homeScore, away: raw.awayScore },
    startsInMinutes: raw.startsIn ?? null,
    marketCount: raw.marketCount,
  };
}

function toCompetition(group: RawGroup): Competition {
  const country = group.countryCode
    ? COUNTRIES.find((c) => c.code === group.countryCode)
    : undefined;

  return {
    id: group.id,
    sportId: group.sportId,
    name: group.league,
    round: group.round,
    region: {
      code: group.countryCode,
      // The group always names its region, so a continental competition reads
      // "Africa · AFCON 2027 qualifiers" rather than repeating itself.
      name: country?.name ?? group.country,
      flag: group.countryCode ? flagUrl(group.countryCode) : null,
    },
  };
}

// ── markets ─────────────────────────────────────────────────────────────────

/**
 * Double chance derived from the 1X2 prices, with the book's margin applied:
 * a 0.97 overround and a 1.01 floor. Mirrors `dcOdds` in the design.
 */
function deriveDoubleChance(
  odds: RawMatch["odds"],
): [number | null, number | null, number | null] {
  const pair = (a: number | null, b: number | null) =>
    a && b
      ? Math.round(Math.max(1.01, 0.97 / (1 / a + 1 / b)) * 100) / 100
      : null;
  return [
    pair(odds[0], odds[1]),
    pair(odds[0], odds[2]),
    pair(odds[1], odds[2]),
  ];
}

/** Resolves an outcome code into something a person can read. */
function labelOutcome(
  event: Pick<SportEvent, "home" | "away">,
  type: MarketType,
  line: string | null,
  code: string,
): Localized {
  if (type === "1x2" || type === "hc") {
    const base =
      code === "1"
        ? event.home.name
        : code === "2"
          ? event.away.name
          : t("Draw", "አቻ");
    return type === "hc"
      ? { en: `${base.en} (${line})`, am: `${base.am} (${line})` }
      : base;
  }
  if (type === "ou") {
    return code === "Over"
      ? t(`Over ${line}`, `ከ${line} በላይ`)
      : t(`Under ${line}`, `ከ${line} በታች`);
  }
  if (type === "btts") return code === "Yes" ? t("Yes", "አዎ") : t("No", "አይ");
  if (type === "cs" && code === "Other") return t("Any other score", "ሌላ ውጤት");
  return t(code);
}

const marketId = (eventId: string, type: MarketType, line: string | null) =>
  `${eventId}:${type}:${line ?? ""}`;

/**
 * Fixture prices are written as numbers for readability; the domain carries the
 * contract's decimal strings (FD4), so they are spelled out here, once.
 */
const priceText = (odds: number | null): string | null =>
  odds === null ? null : odds.toFixed(2);

function buildMarket(
  event: SportEvent,
  raw: RawMatch,
  type: MarketType,
  category: MarketCategory,
  name: Localized,
  line: string | null,
  prices: Array<[string, number | null]>,
  movement: Array<"up" | "down" | null> = [],
  previous: Array<number | null> = [],
): Market {
  const suspended = raw.suspended ?? false;
  const id = marketId(event.id, type, line);
  return {
    id,
    eventId: event.id,
    templateId: `m_${type}`,
    type,
    category,
    name,
    title: name,
    line,
    status: suspended ? "suspended" : "open",
    outcomes: prices.map(([code, odds], i): Outcome => ({
      id: `${id}:${code}`,
      code,
      label: labelOutcome(event, type, line, code),
      odds: suspended ? null : priceText(odds),
      previousOdds: priceText(previous[i] ?? null),
      movement: suspended ? null : (movement[i] ?? null),
    })),
  };
}

function boardMarkets(event: SportEvent, raw: RawMatch): BoardMarkets {
  const dc = deriveDoubleChance(raw.odds);
  return {
    matchResult: buildMarket(
      event,
      raw,
      "1x2",
      "main",
      t("Match result", "የጨዋታ ውጤት"),
      null,
      [
        ["1", raw.odds[0]],
        ["X", raw.odds[1]],
        ["2", raw.odds[2]],
      ],
      raw.movement ?? [],
      raw.previous ?? [],
    ),
    doubleChance: buildMarket(
      event,
      raw,
      "dc",
      "main",
      t("Double chance", "ድርብ ዕድል"),
      null,
      [
        ["1X", dc[0]],
        ["12", dc[1]],
        ["X2", dc[2]],
      ],
    ),
    totalGoals: buildMarket(
      event,
      raw,
      "ou",
      "goals",
      t("Total goals", "ጠቅላላ ጎል"),
      "2.5",
      [
        ["Over", raw.overUnder[0]],
        ["Under", raw.overUnder[1]],
      ],
    ),
  };
}

// ── queries ─────────────────────────────────────────────────────────────────

export interface SessionActivity {
  staked: number;
  won: number;
  /** Won minus staked. Negative is the usual case and is shown in the loss tint. */
  net: number;
}

export const mockRepository = {
  async listBoard(
    filters: EventFilters = {},
    dataSaver = false,
  ): Promise<BoardSection[]> {
    await delay();
    const sportId = normalizeSportId(filters.sportId);

    return GROUPS.filter(
      (g) =>
        g.sportId === sportId &&
        (!filters.competitionId || g.id === filters.competitionId),
    )
      .map((group) => {
        const matches = group.matches.filter((m) => {
          if (filters.live) return m.status === "live";
          if (filters.filter === "upcoming") return m.status !== "live";
          return true;
        });

        return {
          competition: toCompetition(group),
          events: matches.map((raw) => {
            const snapshot = liveSnapshot(raw);
            const event = toEvent(snapshot, group, dataSaver);
            return { event, markets: boardMarkets(event, snapshot) };
          }),
        };
      })
      .filter((section) => section.events.length > 0);
  },

  async listMarkets(eventId: string): Promise<Market[]> {
    await delay(200);
    let found: { raw: RawMatch; group: RawGroup } | null = null;
    for (const group of GROUPS) {
      const raw = group.matches.find((m) => m.id === eventId);
      if (raw) found = { raw, group };
    }
    if (!found) return [];

    const { raw, group } = found;
    const snapshot = liveSnapshot(raw);
    const event = toEvent(snapshot, group, false);
    const dc = deriveDoubleChance(snapshot.odds);

    return MARKET_TEMPLATE.flatMap((template) => {
      const type = template.type as MarketType;
      const category = template.category as MarketCategory;

      /** This event's own prices where we have them, else the template's. */
      const pricesFor = (row: (typeof template.rows)[number]) => {
        if (type === "1x2") {
          return [
            ["1", snapshot.odds[0]],
            ["X", snapshot.odds[1]],
            ["2", snapshot.odds[2]],
          ] as Array<[string, number | null]>;
        }
        if (type === "dc") {
          return [
            ["1X", dc[0]],
            ["12", dc[1]],
            ["X2", dc[2]],
          ] as Array<[string, number | null]>;
        }
        if (type === "ou" && row.line === "2.5") {
          return [
            ["Over", snapshot.overUnder[0]],
            ["Under", snapshot.overUnder[1]],
          ] as Array<[string, number | null]>;
        }
        return row.outcomes.map(
          ([code, odds]) => [code, odds] as [string, number | null],
        );
      };

      const movementFor = (
        row: (typeof template.rows)[number],
        count: number,
      ) =>
        Array.from(
          { length: count },
          (_, i) => MARKET_MOVEMENT[`${type}|${row.line ?? ""}|${i}`] ?? null,
        );

      // A line makes a market: Over/Under 2.5 and Over/Under 3.5 are two
      // markets, and each handicap is its own. Rows without a line are one
      // market laid out over several rows — correct score is a single market
      // with fifteen outcomes, not five markets that would collide on id.
      const lined = template.rows.some((row) => row.line !== null);

      if (lined) {
        return template.rows.map((row) => {
          const prices = pricesFor(row);
          return buildMarket(
            event,
            raw,
            type,
            category,
            template.name,
            row.line,
            prices,
            movementFor(row, prices.length),
          );
        });
      }

      const prices = template.rows.flatMap(pricesFor);
      const movement = template.rows.flatMap((row) =>
        movementFor(row, pricesFor(row).length),
      );

      return [
        buildMarket(
          event,
          raw,
          type,
          category,
          template.name,
          null,
          prices,
          type === "1x2" ? (snapshot.movement ?? movement) : movement,
          type === "1x2" ? (snapshot.previous ?? []) : [],
        ),
      ];
    });
  },

  /**
   * This session's activity, for the reality check.
   *
   * Server-owned: the client cannot be trusted to total up what someone has
   * staked, and the whole point of a reality check is that the figure is true.
   */
  async getSessionActivity(): Promise<SessionActivity> {
    await delay(100);
    return { staked: 350, won: 120, net: -230 };
  },
};
