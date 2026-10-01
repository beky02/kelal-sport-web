/**
 * Mock dataset, ported from the design project's `kelal-data.js`.
 *
 * Kept deliberately close to the design's own shapes so the two can be
 * compared line by line. `repository.ts` maps this onto the domain types the
 * UI consumes — nothing outside that file should import from here.
 *
 * Reference date: Mon 28 Sep 2026 = Meskerem 18, 2019 E.C.
 */
import type { Lang, Localized } from "@/types/common";

const t = (en: string, am?: string): Localized => ({ en, am: am ?? en });

/** Circle path shared by the ball sports. */
const CIRCLE = "M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20";

export const SPORT_ICONS = {
  soccer: [
    CIRCLE,
    "m12 7 4.5 3.3-1.7 5.2H9.2l-1.7-5.2z",
    "M12 2v5",
    "m21.5 9.5-5 .8",
    "m2.5 9.5 5 .8",
    "m18 20-3.2-4.5",
    "m6 20 3.2-4.5",
  ],
  basketball: [
    CIRCLE,
    "M4.9 4.9c4 4 4 10.2 0 14.2",
    "M19.1 4.9c-4 4-4 10.2 0 14.2",
    "M2 12h20",
    "M12 2v20",
  ],
  tennis: [CIRCLE, "M6 5.3a9 9 0 0 1 0 13.4", "M18 5.3a9 9 0 0 0 0 13.4"],
  volleyball: [
    CIRCLE,
    "M11.1 7.1a16.55 16.55 0 0 1 10.9 4",
    "M12 12a12.6 12.6 0 0 1-8.7 5",
    "M16.8 13.6a16.55 16.55 0 0 1-9 7.5",
    "M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10",
    "M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5",
  ],
  tableTennis: [
    "M14.5 15.5a6.5 6.5 0 1 0-6-6z",
    "m14.5 15.5 5 5a1.4 1.4 0 0 0 2-2l-5-5",
    "M19.5 5a1.5 1.5 0 1 0 0 .01",
  ],
  iceHockey: ["M4 3l8 12h6a2 2 0 0 1 0 4H10.5L3 8", "M16 21h5"],
} as const;

export const SPORTS = [
  {
    id: "soccer",
    slug: "football",
    name: t("Soccer", "እግር ኳስ"),
    total: 612,
    live: 3,
    icon: SPORT_ICONS.soccer,
  },
  {
    id: "basketball",
    slug: "basketball",
    name: t("Basketball", "ቅርጫት ኳስ"),
    total: 84,
    live: 4,
    icon: SPORT_ICONS.basketball,
  },
  {
    id: "tennis",
    slug: "tennis",
    name: t("Tennis", "ቴኒስ"),
    total: 142,
    live: 6,
    icon: SPORT_ICONS.tennis,
  },
  {
    id: "volleyball",
    slug: "volleyball",
    name: t("Volleyball", "መረብ ኳስ"),
    total: 38,
    live: 1,
    icon: SPORT_ICONS.volleyball,
  },
  {
    id: "table-tennis",
    slug: "table-tennis",
    name: t("Table tennis", "የጠረጴዛ ቴኒስ"),
    total: 210,
    live: 9,
    icon: SPORT_ICONS.tableTennis,
  },
  {
    id: "ice-hockey",
    slug: "ice-hockey",
    name: t("Ice hockey", "የበረዶ ሆኪ"),
    total: 26,
    live: 0,
    icon: SPORT_ICONS.iceHockey,
  },
] as const;

/** Six days from the reference date, in both calendars. */
/** Every fixture in this dataset sits on the reference date. */
export const REFERENCE_DATE = "2026-09-28";

export const DATES: Array<{
  iso: string;
  label: Record<Lang, [string, string]>;
}> = [
  {
    iso: "2026-09-28",
    label: { en: ["Today", "28 Sep"], am: ["ዛሬ", "መስ 18"] },
  },
  {
    iso: "2026-09-29",
    label: { en: ["Tue", "29 Sep"], am: ["ማክሰኞ", "መስ 19"] },
  },
  { iso: "2026-09-30", label: { en: ["Wed", "30 Sep"], am: ["ረቡዕ", "መስ 20"] } },
  { iso: "2026-10-01", label: { en: ["Thu", "1 Oct"], am: ["ሐሙስ", "መስ 21"] } },
  { iso: "2026-10-02", label: { en: ["Fri", "2 Oct"], am: ["ዓርብ", "መስ 22"] } },
  { iso: "2026-10-03", label: { en: ["Sat", "3 Oct"], am: ["ቅዳሜ", "መስ 23"] } },
];

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

export const GROUPS: RawGroup[] = [
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
