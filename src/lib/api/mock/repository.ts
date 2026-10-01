/**
 * In-memory stand-in for the features not yet wired to the contract.
 *
 * The catalogue no longer comes from here: it goes through the route handlers
 * to the API, and Prism serves the contract's own examples locally. What is
 * left — bets, wallet, responsible gaming, session activity — moves to the
 * contract task by task (F4–F7), after which this folder is deleted.
 *
 * `listBoard` and `listMarkets` remain only as fixtures for the realtime tests,
 * which need live fixtures, scores and many lines per market — shapes the
 * Release 1 contract examples do not have.
 */
import { ApiError } from "@/lib/api/errors";
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
  remainingDepositAllowance,
  type PaymentMethod,
  type PaymentResult,
  type WalletMode,
  type WalletOverview,
} from "@/features/wallet/types";
import {
  type Bet,
  type BetCounts,
  type BetsTab,
  type Transaction,
  type TransactionKind,
} from "@/features/bets/types";
import { BETS, TRANSACTIONS, TRANSACTION_DAYS } from "./bets";
import { PAYMENT_METHODS, WALLET_OVERVIEW } from "./wallet";
import {
  CLUB_COLOUR,
  COUNTRIES,
  GROUPS,
  LIGHT_CREST,
  MARKET_MOVEMENT,
  MARKET_TEMPLATE,
  NATIONAL_FLAG,
  REFERENCE_DATE,
  flagUrl,
  type RawGroup,
  type RawMatch,
} from "./fixtures";

const t = (en: string, am?: string): Localized => ({ en, am: am ?? en });

/** Keeps loading and skeleton states honest in development. */
const delay = (ms = 220) => new Promise<void>((r) => setTimeout(r, ms));

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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
    line,
    status: suspended ? "suspended" : "open",
    outcomes: prices.map(([code, odds], i): Outcome => ({
      id: `${id}:${code}`,
      code,
      label: labelOutcome(event, type, line, code),
      odds: suspended ? null : odds,
      previousOdds: previous[i] ?? null,
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

export interface BetList {
  bets: Bet[];
  /** Tab counts are of the whole book, not the filtered page. */
  counts: BetCounts;
}

export interface TransactionDay {
  date: string;
  label: Localized;
  items: Transaction[];
}

export interface ResponsibleGamingStatus {
  /** Human-readable end of an active break, or null if there is none. */
  coolOffUntil: string | null;
  selfExcludedUntil: string | null;
}

export interface SessionActivity {
  staked: number;
  won: number;
  /** Won minus staked. Negative is the usual case and is shown in the loss tint. */
  net: number;
}

/**
 * Cash-outs made during this session.
 *
 * The fixtures are constant; this overlays what the user has done to them, so a
 * bet cashed out stays cashed out while they navigate around. A real backend
 * holds this, obviously.
 */
const cashOuts = new Map<string, Bet>();

const withCashOuts = (): Bet[] =>
  BETS.map((bet) => cashOuts.get(bet.id) ?? bet);

/**
 * Responsible-gaming state for this session.
 *
 * Deliberately server-side, not a client store: a break the user can end by
 * refreshing the page is not a break. In production this comes from the account
 * on every load; here it lives in module state so it behaves the same way while
 * navigating.
 */
const responsibleGaming: ResponsibleGamingStatus = {
  coolOffUntil: null,
  selfExcludedUntil: null,
};

export const mockRepository = {
  async listBoard(
    filters: EventFilters = {},
    dataSaver = false,
  ): Promise<BoardSection[]> {
    await delay();
    const sportId = filters.sportId ?? "soccer";

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
            const event = toEvent(raw, group, dataSaver);
            return { event, markets: boardMarkets(event, raw) };
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
    const event = toEvent(raw, group, false);
    const dc = deriveDoubleChance(raw.odds);

    return MARKET_TEMPLATE.flatMap((template) => {
      const type = template.type as MarketType;
      const category = template.category as MarketCategory;

      /** This event's own prices where we have them, else the template's. */
      const pricesFor = (row: (typeof template.rows)[number]) => {
        if (type === "1x2") {
          return [
            ["1", raw.odds[0]],
            ["X", raw.odds[1]],
            ["2", raw.odds[2]],
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
            ["Over", raw.overUnder[0]],
            ["Under", raw.overUnder[1]],
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
          type === "1x2" ? (raw.movement ?? movement) : movement,
          type === "1x2" ? (raw.previous ?? []) : [],
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

  async listBets(tab: BetsTab): Promise<BetList> {
    await delay(180);
    const all = withCashOuts();

    const inTab = (bet: Bet) =>
      tab === "open"
        ? bet.status === "open"
        : tab === "settled"
          ? bet.status !== "open"
          : bet.status === tab;

    return {
      bets: all.filter(inTab),
      counts: {
        open: all.filter((b) => b.status === "open").length,
        settled: all.filter((b) => b.status !== "open").length,
        won: all.filter((b) => b.status === "won").length,
        lost: all.filter((b) => b.status === "lost").length,
      },
    };
  },

  async getBet(id: string): Promise<Bet | null> {
    await delay(140);
    return withCashOuts().find((bet) => bet.id === id) ?? null;
  },

  /**
   * Buys a bet back, in whole or in part.
   *
   * A full cash-out closes the ticket. A partial one pays out that share and
   * leaves the rest running on a proportionally smaller stake — which is what the
   * screen's own copy promises, so it has to be what actually happens.
   */
  async cashOut(id: string, fraction: number): Promise<Bet> {
    await delay(500);
    const bet = withCashOuts().find((b) => b.id === id);

    if (!bet) throw new ApiError("Bet not found", 404, "bet_not_found");
    if (bet.status !== "open")
      throw new ApiError("Bet is already settled", 409, "bet_settled");
    if (bet.cashOutBlocked || bet.cashOutValue === null)
      throw new ApiError("Cash out unavailable", 409, "cash_out_unavailable");

    const paid = bet.cashOutValue * fraction;

    const settled: Bet =
      fraction >= 1
        ? {
            ...bet,
            status: "cashed",
            cashOutValue: null,
            cashedOutAmount: paid,
          }
        : {
            ...bet,
            stake: bet.stake * (1 - fraction),
            cashOutValue: bet.cashOutValue * (1 - fraction),
            cashedOutAmount: (bet.cashedOutAmount ?? 0) + paid,
          };

    cashOuts.set(id, settled);
    return settled;
  },

  async listTransactions(
    kind?: TransactionKind | "all",
  ): Promise<TransactionDay[]> {
    await delay(160);

    const matches = (transaction: Transaction) => {
      if (!kind || kind === "all") return true;
      // "Bets" covers both the stake going out and the winnings coming back.
      if (kind === "bet")
        return transaction.kind === "bet" || transaction.kind === "winnings";
      return transaction.kind === kind;
    };

    return TRANSACTION_DAYS.map((day) => ({
      ...day,
      items: TRANSACTIONS.filter((x) => x.date === day.date && matches(x)),
    })).filter((day) => day.items.length > 0);
  },

  async getResponsibleGamingStatus(): Promise<ResponsibleGamingStatus> {
    await delay(80);
    return { ...responsibleGaming };
  },

  /**
   * Starts a break or a self-exclusion.
   *
   * One-way: there is no endpoint to end one early, because the whole value of
   * the tool is that it cannot be undone in a weak moment.
   */
  async startResponsibleGamingBreak(
    kind: "cool-off" | "self-exclusion",
    until: string,
  ): Promise<ResponsibleGamingStatus> {
    await delay(400);
    if (kind === "cool-off") responsibleGaming.coolOffUntil = until;
    else responsibleGaming.selfExcludedUntil = until;
    return { ...responsibleGaming };
  },

  async getWallet(): Promise<WalletOverview> {
    await delay(100);
    return WALLET_OVERVIEW;
  },

  async listPaymentMethods(mode: WalletMode): Promise<PaymentMethod[]> {
    await delay(100);
    return mode === "withdraw"
      ? PAYMENT_METHODS.filter((method) => method.supportsWithdrawal)
      : PAYMENT_METHODS;
  },

  /**
   * Starts a deposit or a withdrawal.
   *
   * Every limit is re-checked here, not just in the form: a client-side maximum
   * is a hint to the user, never a control. Deposits come back `pending` because
   * mobile money needs the customer to approve a prompt on their handset — the
   * money has not moved when this returns.
   */
  async createPayment(
    mode: WalletMode,
    methodId: string,
    amount: number,
  ): Promise<PaymentResult> {
    await delay(700);

    const method = PAYMENT_METHODS.find((m) => m.id === methodId);
    if (!method) throw new ApiError("Unknown method", 422, "unknown_method");
    if (mode === "withdraw" && !method.supportsWithdrawal)
      throw new ApiError(
        "Method cannot pay out",
        422,
        "withdrawal_unsupported",
      );

    if (amount < method.minAmount || amount > method.maxAmount)
      throw new ApiError("Amount outside limits", 422, "amount_out_of_range");

    if (mode === "withdraw" && amount > WALLET_OVERVIEW.withdrawable)
      throw new ApiError("More than withdrawable", 422, "exceeds_withdrawable");

    if (
      mode === "deposit" &&
      amount > remainingDepositAllowance(WALLET_OVERVIEW)
    )
      throw new ApiError("Daily limit reached", 422, "deposit_limit_reached");

    return {
      reference: `TX-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "pending",
      amount,
      newBalance:
        mode === "withdraw"
          ? WALLET_OVERVIEW.balance - amount
          : WALLET_OVERVIEW.balance + amount,
    };
  },

  /** Polls a payment the provider is still processing. */
  async getPaymentStatus(reference: string): Promise<PaymentResult["status"]> {
    await delay(900);
    // Deterministic from the reference so a given payment always resolves the
    // same way while testing: roughly one in five declines.
    const digits = reference.replace(/\D/g, "");
    return Number(digits.slice(-1)) % 5 === 0 ? "failed" : "success";
  },
};
