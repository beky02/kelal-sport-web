/**
 * Mock dataset, ported from the design project's `kelal-data.js`.
 *
 * Kept deliberately close to the design's own shapes so the two can be
 * compared line by line. `repository.ts` maps this onto the domain types the
 * UI consumes — nothing outside that file should import from here.
 *
 * Reference date: Mon 28 Sep 2026 = Meskerem 18, 2019 E.C.
 */
import type { Localized } from "@/types/common";

const t = (en: string, am?: string): Localized => ({ en, am: am ?? en });

/** Every fixture in this dataset sits on the reference date. */
export const REFERENCE_DATE = "2026-09-28";

/** Country code → flag file in /public/flags. */
export const FLAG_FILE: Record<string, string> = {
  ENG: "gb-eng",
  ETH: "et",
  ESP: "es",
  EUR: "eu",
  ITA: "it",
  GER: "de",
};

export const flagUrl = (code: string): string =>
  `/flags/${FLAG_FILE[code] ?? code}.svg`;

export const COUNTRIES = [
  {
    code: "ENG",
    name: t("England", "እንግሊዝ"),
    leagues: [
      { id: "epl", name: t("Premier League", "ፕሪሚየር ሊግ"), n: 10 },
      { id: "eng-champ", name: t("Championship", "ቻምፒየንሺፕ"), n: 12 },
    ],
  },
  {
    code: "ETH",
    name: t("Ethiopia", "ኢትዮጵያ"),
    leagues: [
      { id: "eth", name: t("Premier League", "ፕሪሚየር ሊግ"), n: 8 },
      { id: "eth-higher", name: t("Higher League", "ከፍተኛ ሊግ"), n: 6 },
    ],
  },
  {
    code: "ESP",
    name: t("Spain", "ስፔን"),
    leagues: [
      { id: "lal", name: t("LaLiga", "ላሊጋ"), n: 10 },
      { id: "lal2", name: t("LaLiga 2", "ላሊጋ 2"), n: 11 },
    ],
  },
  {
    code: "EUR",
    name: t("Europe", "አውሮፓ"),
    leagues: [
      { id: "ucl", name: t("Champions League", "ቻምፒየንስ ሊግ"), n: 18 },
      { id: "uel", name: t("Europa League", "ዩሮፓ ሊግ"), n: 16 },
    ],
  },
  {
    code: "ITA",
    name: t("Italy", "ጣሊያን"),
    leagues: [{ id: "ita", name: t("Serie A", "ሴሪ አ"), n: 10 }],
  },
  {
    code: "GER",
    name: t("Germany", "ጀርመን"),
    leagues: [{ id: "ger", name: t("Bundesliga", "ቡንደስሊጋ"), n: 9 }],
  },
] as const;

/** National sides are badged with a flag; clubs get tinted initials. */
export const NATIONAL_FLAG: Record<string, string> = {
  Ethiopia: "et",
  Ghana: "gh",
  Egypt: "eg",
  Senegal: "sn",
};

export const CLUB_COLOUR: Record<string, string> = {
  Arsenal: "#d61f26",
  Chelsea: "#1d4fb3",
  Liverpool: "#c8102e",
  Brighton: "#0057b8",
  "Man City": "#6cabdd",
  Newcastle: "#2b2b2b",
  "Saint George": "#e8b400",
  "Fasil Kenema": "#7b1f2a",
  "Ethiopian Coffee": "#6b3e1f",
  "Bahir Dar Kenema": "#1467a8",
  Barcelona: "#a50044",
  Sevilla: "#d4001a",
  "Real Madrid": "#ececec",
  Villarreal: "#ffe14d",
  Inter: "#0b3fa8",
  Torino: "#8a1538",
  Bayern: "#dc052d",
  Leipzig: "#0c2043",
};

/** Crests light enough to need dark text on them. */
export const LIGHT_CREST = new Set([
  "Man City",
  "Saint George",
  "Real Madrid",
  "Villarreal",
]);

export type RawStatus = "live" | "soon" | "up";

export interface RawMatch {
  id: string;
  home: Localized;
  away: Localized;
  status: RawStatus;
  /** Elapsed minute on a live match, e.g. `63'`. */
  minute?: string;
  homeScore?: number;
  awayScore?: number;
  /** Minutes to kickoff, when a countdown is warranted. */
  startsIn?: number;
  /** Kickoff HH:mm in East Africa Time. */
  time?: string;
  /** 1 / X / 2 — null where the price is closed. */
  odds: [number | null, number | null, number | null];
  /** Recent movement per 1 / X / 2. */
  movement?: Array<"up" | "down" | null>;
  /** Previous price per 1 / X / 2, where it moved. */
  previous?: Array<number | null>;
  /** Over / Under 2.5. */
  overUnder: [number | null, number | null];
  marketCount: number;
  suspended?: boolean;
}

export interface RawGroup {
  id: string;
  sportId: string;
  countryCode: string | null;
  country: Localized;
  league: Localized;
  round: Localized;
  matches: RawMatch[];
}

const BASE_GROUPS: RawGroup[] = [
  {
    id: "epl",
    sportId: "soccer",
    countryCode: "ENG",
    country: t("England", "እንግሊዝ"),
    league: t("Premier League", "ፕሪሚየር ሊግ"),
    round: t("Matchweek 6", "ሳምንት 6"),
    matches: [
      {
        id: "m1",
        home: t("Arsenal"),
        away: t("Chelsea"),
        status: "live",
        minute: "63'",
        homeScore: 1,
        awayScore: 0,
        odds: [1.45, 4.2, null],
        movement: ["up", "down", null],
        overUnder: [1.3, 3.4],
        marketCount: 41,
      },
      {
        id: "m2",
        home: t("Liverpool"),
        away: t("Brighton"),
        status: "soon",
        startsIn: 12,
        time: "17:00",
        odds: [1.52, 4.6, 5.75],
        overUnder: [1.55, 2.45],
        marketCount: 58,
      },
      {
        id: "m3",
        home: t("Man City"),
        away: t("Newcastle"),
        status: "up",
        time: "19:30",
        odds: [1.62, 4.1, 5.1],
        overUnder: [1.72, 2.08],
        marketCount: 58,
      },
    ],
  },
  {
    id: "eth",
    sportId: "soccer",
    countryCode: "ETH",
    country: t("Ethiopia", "ኢትዮጵያ"),
    league: t("Premier League", "ፕሪሚየር ሊግ"),
    round: t("Week 3", "ሳምንት 3"),
    matches: [
      {
        id: "m4",
        home: t("Saint George", "ቅዱስ ጊዮርጊስ"),
        away: t("Fasil Kenema", "ፋሲል ከነማ"),
        status: "up",
        time: "19:00",
        odds: [2.05, 3.05, 3.6],
        movement: [null, "up", null],
        previous: [null, 2.95, null],
        overUnder: [1.95, 1.85],
        marketCount: 34,
      },
      {
        id: "m5",
        home: t("Ethiopian Coffee", "ኢትዮጵያ ቡና"),
        away: t("Bahir Dar Kenema", "ባሕር ዳር ከነማ"),
        status: "up",
        time: "21:00",
        odds: [2.4, 2.95, 2.9],
        movement: [null, null, "down"],
        overUnder: [2.1, 1.72],
        marketCount: 34,
      },
    ],
  },
  {
    id: "ita",
    sportId: "soccer",
    countryCode: "ITA",
    country: t("Italy", "ጣሊያን"),
    league: t("Serie A", "ሴሪ አ"),
    round: t("Round 5", "5ኛ ዙር"),
    matches: [
      {
        id: "m10",
        home: t("Inter"),
        away: t("Torino"),
        status: "live",
        minute: "38'",
        homeScore: 0,
        awayScore: 0,
        odds: [1.7, 3.6, 5.4],
        movement: [null, "up", null],
        overUnder: [1.9, 1.9],
        marketCount: 36,
      },
    ],
  },
  {
    id: "ger",
    sportId: "soccer",
    countryCode: "GER",
    country: t("Germany", "ጀርመን"),
    league: t("Bundesliga", "ቡንደስሊጋ"),
    round: t("Matchday 5", "5ኛ ዙር"),
    matches: [
      {
        id: "m12",
        home: t("Bayern"),
        away: t("Leipzig"),
        status: "live",
        minute: "71'",
        homeScore: 2,
        awayScore: 1,
        odds: [null, null, null],
        overUnder: [null, null],
        marketCount: 22,
        suspended: true,
      },
    ],
  },
  {
    id: "lal",
    sportId: "soccer",
    countryCode: "ESP",
    country: t("Spain", "ስፔን"),
    league: t("LaLiga", "ላሊጋ"),
    round: t("Matchday 7", "ጨዋታ ቀን 7"),
    matches: [
      {
        id: "m6",
        home: t("Barcelona"),
        away: t("Sevilla"),
        status: "up",
        time: "22:00",
        odds: [1.38, 5.2, 7.4],
        overUnder: [1.48, 2.62],
        marketCount: 58,
      },
      {
        id: "m7",
        home: t("Real Madrid"),
        away: t("Villarreal"),
        status: "up",
        time: "22:00",
        odds: [1.55, 4.4, 5.6],
        overUnder: [1.6, 2.3],
        marketCount: 58,
      },
    ],
  },
  {
    id: "afc",
    sportId: "soccer",
    countryCode: null,
    country: t("Africa", "አፍሪካ"),
    league: t("AFCON 2027 qualifiers", "የአፍሪካ ዋንጫ 2027 ማጣሪያ"),
    round: t("Matchday 3", "3ኛ ዙር"),
    matches: [
      {
        id: "m8",
        home: t("Ethiopia", "ኢትዮጵያ"),
        away: t("Ghana", "ጋና"),
        status: "up",
        time: "18:00",
        odds: [4.1, 3.25, 1.92],
        overUnder: [2.35, 1.58],
        marketCount: 46,
      },
      {
        id: "m9",
        home: t("Egypt", "ግብፅ"),
        away: t("Senegal", "ሴኔጋል"),
        status: "up",
        time: "21:00",
        odds: [2.45, 2.9, 3.1],
        overUnder: [2.6, 1.48],
        marketCount: 46,
      },
    ],
  },
  {
    id: "uefa",
    sportId: "soccer",
    countryCode: "EUR",
    country: t("Europe", "አውሮፓ"),
    league: t("UEFA Champions League", "የዩሮፓ ቻምፒየንስ ሊግ"),
    round: t("Group stage", "የቡድን ዙር"),
    matches: [
      {
        id: "m13",
        home: t("Barcelona"),
        away: t("Bayern"),
        status: "live",
        minute: "58'",
        homeScore: 2,
        awayScore: 1,
        odds: [2.2, 3.4, 2.8],
        movement: ["up", null, "down"],
        overUnder: [2.15, 1.7],
        marketCount: 72,
      },
      {
        id: "m14",
        home: t("Liverpool"),
        away: t("Inter"),
        status: "live",
        minute: "66'",
        homeScore: 1,
        awayScore: 2,
        odds: [1.95, 3.5, 3.25],
        movement: [null, "up", "down"],
        overUnder: [2.45, 1.55],
        marketCount: 68,
      },
      {
        id: "m15",
        home: t("Real Madrid"),
        away: t("Leipzig"),
        status: "up",
        time: "20:45",
        odds: [1.58, 4.6, 6.25],
        overUnder: [1.8, 2.05],
        marketCount: 74,
      },
    ],
  },
  {
    id: "france",
    sportId: "soccer",
    countryCode: "EUR",
    country: t("Europe", "አውሮፓ"),
    league: t("Ligue 1", "ሊግ 1"),
    round: t("Round 8", "8ኛ ዙር"),
    matches: [
      {
        id: "m16",
        home: t("Chelsea"),
        away: t("Arsenal"),
        status: "live",
        minute: "49'",
        homeScore: 1,
        awayScore: 1,
        odds: [2.35, 3.2, 2.7],
        movement: ["down", "up", null],
        overUnder: [2.2, 1.68],
        marketCount: 63,
      },
      {
        id: "m17",
        home: t("Brighton"),
        away: t("Newcastle"),
        status: "soon",
        startsIn: 18,
        time: "18:30",
        odds: [2.15, 3.55, 3.1],
        overUnder: [2.35, 1.62],
        marketCount: 60,
      },
      {
        id: "m18",
        home: t("Villarreal"),
        away: t("Sevilla"),
        status: "up",
        time: "19:15",
        odds: [2.48, 3.15, 2.7],
        overUnder: [2.05, 1.8],
        marketCount: 64,
      },
    ],
  },
  {
    id: "africa-cup",
    sportId: "soccer",
    countryCode: null,
    country: t("Africa", "አፍሪካ"),
    league: t("CAF Champions League", "የካፍ ቻምፒየንስ ሊግ"),
    round: t("Semi-finals", "አጋማሽ ፍፃሜ"),
    matches: [
      {
        id: "m19",
        home: t("Saint George", "ቅዱስ ጊዮርጊስ"),
        away: t("Ethiopian Coffee", "ኢትዮጵያ ቡና"),
        status: "live",
        minute: "72'",
        homeScore: 2,
        awayScore: 0,
        odds: [1.65, 3.8, 5.1],
        movement: ["up", null, "down"],
        overUnder: [1.95, 1.85],
        marketCount: 71,
      },
      {
        id: "m20",
        home: t("Fasil Kenema", "ፋሲል ከነማ"),
        away: t("Bahir Dar Kenema", "ባሕር ዳር ከነማ"),
        status: "up",
        time: "19:45",
        odds: [2.12, 3.05, 3.35],
        overUnder: [2.25, 1.6],
        marketCount: 66,
      },
    ],
  },
  {
    id: "intl",
    sportId: "soccer",
    countryCode: "EUR",
    country: t("Europe", "አውሮፓ"),
    league: t("International friendlies", "ዓለም አቀፍ የማርካቶች"),
    round: t("Weekend fixtures", "የሳምንት ጨዋታዎች"),
    matches: [
      {
        id: "m21",
        home: t("England", "እንግሊዝ"),
        away: t("Italy", "ጣሊያን"),
        status: "soon",
        startsIn: 35,
        time: "20:15",
        odds: [2.55, 3.4, 2.9],
        overUnder: [2.7, 1.42],
        marketCount: 58,
      },
      {
        id: "m22",
        home: t("Spain", "ስፔን"),
        away: t("Germany", "ጀርመን"),
        status: "live",
        minute: "31'",
        homeScore: 0,
        awayScore: 1,
        odds: [2.15, 3.3, 2.95],
        movement: ["up", null, "down"],
        overUnder: [1.9, 1.96],
        marketCount: 70,
      },
    ],
  },
];

export const LIVE_SIMULATION_GROUPS: RawGroup[] = [
  {
    id: "sim-live",
    sportId: "soccer",
    countryCode: "ENG",
    country: t("England", "እንግሊዝ"),
    league: t("Live simulation", "የቀጥታ ማስመሰያ"),
    round: t("Realtime", "ቀጥታ"),
    matches: [
      {
        id: "sim-1",
        home: t("Arsenal"),
        away: t("Liverpool"),
        status: "live",
        minute: "54'",
        homeScore: 2,
        awayScore: 2,
        odds: [2.24, 3.55, 2.9],
        movement: ["up", null, "down"],
        overUnder: [2.25, 1.65],
        marketCount: 81,
      },
      {
        id: "sim-2",
        home: t("Chelsea"),
        away: t("Man City"),
        status: "live",
        minute: "61'",
        homeScore: 1,
        awayScore: 0,
        odds: [2.65, 3.25, 2.15],
        movement: [null, "up", "down"],
        overUnder: [1.95, 1.88],
        marketCount: 76,
      },
      {
        id: "sim-3",
        home: t("Newcastle"),
        away: t("Brighton"),
        status: "live",
        minute: "45'",
        homeScore: 1,
        awayScore: 1,
        odds: [1.95, 3.45, 3.1],
        movement: ["up", null, "down"],
        overUnder: [2.1, 1.72],
        marketCount: 70,
      },
    ],
  },
  {
    id: "sim-italy",
    sportId: "soccer",
    countryCode: "ITA",
    country: t("Italy", "ጣሊያን"),
    league: t("Live simulation", "የቀጥታ ማስመሰያ"),
    round: t("Realtime", "ቀጥታ"),
    matches: [
      {
        id: "sim-4",
        home: t("Inter"),
        away: t("Torino"),
        status: "live",
        minute: "71'",
        homeScore: 2,
        awayScore: 1,
        odds: [1.72, 3.65, 4.6],
        movement: ["up", null, "down"],
        overUnder: [2.35, 1.56],
        marketCount: 68,
      },
    ],
  },
  {
    id: "sim-spain",
    sportId: "soccer",
    countryCode: "ESP",
    country: t("Spain", "ስፔን"),
    league: t("Live simulation", "የቀጥታ ማስመሰያ"),
    round: t("Realtime", "ቀጥታ"),
    matches: [
      {
        id: "sim-5",
        home: t("Barcelona"),
        away: t("Real Madrid"),
        status: "live",
        minute: "66'",
        homeScore: 1,
        awayScore: 2,
        odds: [2.35, 3.3, 2.25],
        movement: [null, "up", "down"],
        overUnder: [2.2, 1.7],
        marketCount: 78,
      },
    ],
  },
  {
    id: "sim-africa",
    sportId: "soccer",
    countryCode: null,
    country: t("Africa", "አፍሪካ"),
    league: t("Live simulation", "የቀጥታ ማስመሰያ"),
    round: t("Realtime", "ቀጥታ"),
    matches: [
      {
        id: "sim-6",
        home: t("Ethiopia", "ኢትዮጵያ"),
        away: t("Ghana", "ጋና"),
        status: "live",
        minute: "57'",
        homeScore: 1,
        awayScore: 1,
        odds: [3.4, 3.15, 2.2],
        movement: ["down", "up", null],
        overUnder: [2.45, 1.52],
        marketCount: 73,
      },
    ],
  },
  {
    id: "sim-france",
    sportId: "soccer",
    countryCode: "EUR",
    country: t("Europe", "አውሮፓ"),
    league: t("Live simulation", "የቀጥታ ማስመሰያ"),
    round: t("Realtime", "ቀጥታ"),
    matches: [
      {
        id: "sim-7",
        home: t("Chelsea"),
        away: t("Sevilla"),
        status: "live",
        minute: "77'",
        homeScore: 2,
        awayScore: 0,
        odds: [1.9, 3.7, 4.2],
        movement: ["up", null, "down"],
        overUnder: [2.65, 1.46],
        marketCount: 69,
      },
    ],
  },
  {
    id: "sim-germany",
    sportId: "soccer",
    countryCode: "GER",
    country: t("Germany", "ጀርመን"),
    league: t("Live simulation", "የቀጥታ ማስመሰያ"),
    round: t("Realtime", "ቀጥታ"),
    matches: [
      {
        id: "sim-8",
        home: t("Bayern"),
        away: t("Leipzig"),
        status: "live",
        minute: "82'",
        homeScore: 3,
        awayScore: 1,
        odds: [1.42, 4.85, 6.9],
        movement: ["up", null, "down"],
        overUnder: [2.8, 1.38],
        marketCount: 74,
      },
    ],
  },
  {
    id: "sim-ethio",
    sportId: "soccer",
    countryCode: "ETH",
    country: t("Ethiopia", "ኢትዮጵያ"),
    league: t("Live simulation", "የቀጥታ ማስመሰያ"),
    round: t("Realtime", "ቀጥታ"),
    matches: [
      {
        id: "sim-9",
        home: t("Saint George", "ቅዱስ ጊዮርጊስ"),
        away: t("Fasil Kenema", "ፋሲል ከነማ"),
        status: "live",
        minute: "68'",
        homeScore: 1,
        awayScore: 1,
        odds: [2.5, 3.05, 2.7],
        movement: [null, "up", "down"],
        overUnder: [2.1, 1.75],
        marketCount: 72,
      },
    ],
  },
];

export const buildLiveSimulationGroups = (): RawGroup[] =>
  LIVE_SIMULATION_GROUPS.map((group) => ({
    ...group,
    matches: group.matches.map((match) => ({
      ...match,
      odds: [...match.odds] as [number | null, number | null, number | null],
      overUnder: [...match.overUnder] as [number | null, number | null],
      movement: match.movement ? [...match.movement] : undefined,
      previous: match.previous ? [...match.previous] : undefined,
    })),
  }));

export function advanceLiveMatchState(match: RawMatch, tick = 1): RawMatch {
  if (match.status !== "live") return { ...match };

  const minuteValue = Number.parseInt(
    match.minute?.replace(/[^\d]/g, "") ?? "0",
    10,
  );
  const nextMinute = Math.min(90, minuteValue + 2 * tick);
  const next: RawMatch = {
    ...match,
    minute: `${nextMinute}'`,
    previous: match.odds.map((value) =>
      value === null ? null : Number(value.toFixed(2)),
    ),
  };

  const pulse = ((match.id.charCodeAt(0) + tick * 7) % 9) / 100;
  next.odds = match.odds.map((value, index) => {
    if (value === null) return null;

    const bias = [0.028, -0.022, 0.031][index] ?? 0.02;
    const updated = value * (1 + bias + pulse * (index === 1 ? 0.5 : 1));
    return Number(Math.max(1.05, updated).toFixed(2));
  }) as [number | null, number | null, number | null];

  next.movement = next.odds.map((value, index) => {
    const previousValue = match.odds[index];
    if (value === null || previousValue === null) return null;
    return value > previousValue ? "up" : value < previousValue ? "down" : null;
  }) as Array<"up" | "down" | null>;

  const totalGoals = (match.homeScore ?? 0) + (match.awayScore ?? 0);
  const scoreBias = (match.id.charCodeAt(1) + tick * 3) % 5;
  const homeGoalShift = scoreBias === 0 || scoreBias === 2 ? 1 : 0;
  const awayGoalShift = scoreBias === 1 || scoreBias === 3 ? 1 : 0;

  next.homeScore = (match.homeScore ?? 0) + homeGoalShift;
  next.awayScore = (match.awayScore ?? 0) + awayGoalShift;
  next.overUnder = [
    Number(
      Math.max(
        1.05,
        (match.overUnder[0] ?? 1.8) + (totalGoals > 2 ? 0.12 : -0.08),
      ).toFixed(2),
    ),
    Number(
      Math.max(
        1.05,
        (match.overUnder[1] ?? 1.8) + (totalGoals > 2 ? -0.1 : 0.08),
      ).toFixed(2),
    ),
  ] as [number | null, number | null];

  return next;
}

export const GROUPS: RawGroup[] = [
  ...BASE_GROUPS,
  ...buildLiveSimulationGroups(),
];

/** Market template for the event detail page, keyed by market type. */
export const MARKET_TEMPLATE = [
  {
    type: "1x2",
    category: "main",
    name: t("Match result (1X2)", "የጨዋታ ውጤት (1X2)"),
    rows: [
      {
        line: null,
        outcomes: [
          ["1", 1.62],
          ["X", 4.1],
          ["2", 5.1],
        ],
      },
    ],
  },
  {
    type: "dc",
    category: "main",
    name: t("Double chance", "ድርብ ዕድል"),
    rows: [
      {
        line: null,
        outcomes: [
          ["1X", 1.18],
          ["12", 1.24],
          ["X2", 2.25],
        ],
      },
    ],
  },
  {
    type: "ou",
    category: "goals",
    name: t("Over / Under", "ከ / በታች"),
    rows: [
      {
        line: "0.5",
        outcomes: [
          ["Over", 1.06],
          ["Under", 9.5],
        ],
      },
      {
        line: "1.5",
        outcomes: [
          ["Over", 1.25],
          ["Under", 3.8],
        ],
      },
      {
        line: "2.5",
        outcomes: [
          ["Over", 1.72],
          ["Under", 2.08],
        ],
      },
      {
        line: "3.5",
        outcomes: [
          ["Over", 2.65],
          ["Under", 1.45],
        ],
      },
      {
        line: "4.5",
        outcomes: [
          ["Over", 4.5],
          ["Under", null],
        ],
      },
    ],
  },
  {
    type: "btts",
    category: "goals",
    name: t("Both teams to score", "ሁለቱም ያገባሉ"),
    rows: [
      {
        line: null,
        outcomes: [
          ["Yes", 1.7],
          ["No", 2.1],
        ],
      },
    ],
  },
  {
    type: "hc",
    category: "hc",
    name: t("Handicap", "ሃንዲካፕ"),
    rows: [
      {
        line: "−1",
        outcomes: [
          ["1", 2.55],
          ["X", 3.9],
          ["2", 2.35],
        ],
      },
      {
        line: "−2",
        outcomes: [
          ["1", 4.6],
          ["X", 4.9],
          ["2", 1.52],
        ],
      },
      {
        line: "+1",
        outcomes: [
          ["1", 1.14],
          ["X", 7.2],
          ["2", 10.5],
        ],
      },
    ],
  },
  {
    type: "cs",
    category: "cs",
    name: t("Correct score", "ትክክለኛ ውጤት"),
    rows: [
      {
        line: null,
        outcomes: [
          ["1–0", 7.5],
          ["0–0", 13],
          ["0–1", 19],
        ],
      },
      {
        line: null,
        outcomes: [
          ["2–0", 7],
          ["1–1", 9],
          ["1–2", 17],
        ],
      },
      {
        line: null,
        outcomes: [
          ["2–1", 8],
          ["2–2", 17],
          ["0–2", 34],
        ],
      },
      {
        line: null,
        outcomes: [
          ["3–0", 10],
          ["3–3", 51],
          ["1–3", 41],
        ],
      },
      {
        line: null,
        outcomes: [
          ["3–1", 11],
          ["Other", 6.5],
          ["2–3", 36],
        ],
      },
    ],
  },
] as const;

/** `type|line|outcomeIndex` → recent movement, for the detail page. */
export const MARKET_MOVEMENT: Record<string, "up" | "down"> = {
  "ou|2.5|0": "up",
  "hc|−1|2": "down",
  "btts||0": "up",
};

export const MARKET_NAME_SHORT = {
  "1x2": t("Match result", "የጨዋታ ውጤት"),
} as const;

/** Signed-in demo account. The backend owns this in production. */
export const DEMO_ACCOUNT = { balance: 1250, currency: "ETB" } as const;
