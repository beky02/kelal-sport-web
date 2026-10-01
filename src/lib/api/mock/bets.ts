/**
 * Placed bets and wallet movements, ported from `Screen Bets.dc.html`.
 *
 * Covers the states the screen has to handle: open, live, cash-out suspended,
 * won, won with a void leg, lost, and cashed out.
 */
import { BETTING } from "@/config/constants";
import { settleBet } from "@/features/bet-slip/lib/calculate";
import { totalOdds, type Bet, type Transaction } from "@/features/bets/types";
import type { Localized } from "@/types/common";

const t = (en: string, am?: string): Localized => ({ en, am: am ?? en });

const MATCH_RESULT = t("Match result", "የጨዋታ ውጤት");
const OVER_UNDER = t("Over / Under", "ከ / በታች");

export const BETS: Bet[] = [
  {
    id: "KS-260927-3381",
    status: "open",
    live: false,
    placedAt: t("Today 16:51", "ዛሬ 16:51"),
    stake: 100,
    cashOutValue: 142.3,
    cashOutBlocked: false,
    cashedOutAmount: null,
    legs: [
      {
        market: MATCH_RESULT,
        pick: t("Man City"),
        match: t("Man City – Newcastle"),
        odds: 1.62,
        status: "open",
        result: t("19:30 EAT"),
      },
      {
        market: MATCH_RESULT,
        pick: t("Draw", "አቻ"),
        match: t("Saint George – Fasil Kenema", "ቅዱስ ጊዮርጊስ – ፋሲል ከነማ"),
        odds: 3.05,
        status: "open",
        result: t("19:00 EAT"),
      },
      {
        market: MATCH_RESULT,
        pick: t("Barcelona"),
        match: t("Barcelona – Sevilla"),
        odds: 1.38,
        status: "open",
        result: t("22:00 EAT"),
      },
    ],
  },
  {
    id: "KS-260927-2954",
    status: "open",
    live: true,
    placedAt: t("Today 16:05", "ዛሬ 16:05"),
    stake: 200,
    cashOutValue: 268.4,
    cashOutBlocked: false,
    cashedOutAmount: null,
    legs: [
      {
        market: MATCH_RESULT,
        pick: t("Arsenal"),
        match: t("Arsenal – Chelsea"),
        odds: 1.85,
        status: "live",
        result: t("1–0 · 63'"),
      },
    ],
  },
  {
    id: "KS-260928-0712",
    status: "open",
    live: true,
    placedAt: t("Today 15:40", "ዛሬ 15:40"),
    stake: 100,
    cashOutValue: null,
    // A leg's market is suspended, so the book will not quote a buy-back.
    cashOutBlocked: true,
    cashedOutAmount: null,
    legs: [
      {
        market: MATCH_RESULT,
        pick: t("Bayern"),
        match: t("Bayern – Leipzig"),
        odds: 1.45,
        status: "live",
        result: t("2–1 · 71'"),
      },
      {
        market: MATCH_RESULT,
        pick: t("Inter"),
        match: t("Inter – Torino"),
        odds: 1.7,
        status: "live",
        result: t("0–0 · 38'"),
      },
    ],
  },
  {
    id: "KS-260926-1177",
    status: "won",
    live: false,
    placedAt: t("Sat 26 Sep 21:10", "ቅዳሜ 21:10"),
    stake: 150,
    cashOutValue: null,
    cashOutBlocked: false,
    cashedOutAmount: null,
    legs: [
      {
        market: MATCH_RESULT,
        pick: t("Liverpool"),
        match: t("Liverpool – Everton"),
        odds: 1.75,
        status: "won",
        result: t("2–1"),
      },
      {
        market: OVER_UNDER,
        pick: t("Over 2.5", "ከ2.5 በላይ"),
        match: t("Liverpool – Everton"),
        odds: 2.64,
        status: "won",
        result: t("3 goals", "3 ጎሎች"),
      },
    ],
  },
  {
    id: "KS-260926-0391",
    status: "won",
    live: false,
    placedAt: t("Sat 26 Sep 17:20", "ቅዳሜ 17:20"),
    stake: 100,
    cashOutValue: null,
    cashOutBlocked: false,
    cashedOutAmount: null,
    legs: [
      {
        market: MATCH_RESULT,
        pick: t("Saint George", "ቅዱስ ጊዮርጊስ"),
        match: t("Saint George – Hawassa City", "ቅዱስ ጊዮርጊስ – ሀዋሳ ከተማ"),
        odds: 1.8,
        status: "won",
        result: t("2–0"),
      },
      // Postponed: priced at 1.00 so it neither wins nor loses the ticket.
      {
        market: MATCH_RESULT,
        pick: t("Fasil Kenema", "ፋሲል ከነማ"),
        match: t("Fasil Kenema – Wolkite City", "ፋሲል ከነማ – ወልቂጤ ከተማ"),
        odds: 1.0,
        status: "void",
        result: t("Postponed", "ተራዝሟል"),
      },
    ],
  },
  {
    id: "KS-260925-0840",
    status: "lost",
    live: false,
    placedAt: t("Fri 25 Sep 18:30", "ዓርብ 18:30"),
    stake: 100,
    cashOutValue: null,
    cashOutBlocked: false,
    cashedOutAmount: null,
    legs: [
      {
        market: MATCH_RESULT,
        pick: t("Draw", "አቻ"),
        match: t(
          "Ethiopian Coffee – Bahir Dar Kenema",
          "ኢትዮጵያ ቡና – ባሕር ዳር ከነማ",
        ),
        odds: 3.1,
        status: "lost",
        result: t("2–0"),
      },
    ],
  },
  {
    id: "KS-260924-6612",
    status: "cashed",
    live: false,
    placedAt: t("Thu 24 Sep 20:00", "ሐሙስ 20:00"),
    stake: 80,
    cashOutValue: null,
    cashOutBlocked: false,
    cashedOutAmount: 96,
    legs: [
      {
        market: MATCH_RESULT,
        pick: t("Real Madrid"),
        match: t("Real Madrid – Getafe"),
        odds: 1.4,
        status: "won",
        result: t("1–0"),
      },
      {
        market: MATCH_RESULT,
        pick: t("Inter"),
        match: t("Inter – Torino"),
        odds: 1.55,
        status: "lost",
        result: t("1–1"),
      },
    ],
  },
];

/**
 * The winnings credited for a settled ticket, derived rather than typed in.
 *
 * A hardcoded figure here would sooner or later disagree with the ticket's own
 * breakdown, and a wallet line that does not match the bet it came from is the
 * kind of discrepancy users escalate.
 */
function winningsFor(betId: string): number {
  const bet = BETS.find((b) => b.id === betId)!;
  return settleBet(bet.stake, totalOdds(bet.legs), {
    stakeTax: BETTING.stakeTaxRate,
    winTax: BETTING.winTaxRate,
    maxWinPerTicket: BETTING.maxWinPerTicket,
  }).payout;
}

/** Amounts are signed: negative leaves the wallet. */
export const TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    kind: "bet",
    status: "success",
    name: t("Bet stake · KS-260927-3381", "ውርርድ · KS-260927-3381"),
    meta: t("16:51"),
    amount: -100,
    date: "2026-09-28",
  },
  {
    id: "tx-2",
    kind: "bet",
    status: "success",
    name: t("Bet stake · KS-260927-2954", "ውርርድ · KS-260927-2954"),
    meta: t("16:05"),
    amount: -200,
    date: "2026-09-28",
  },
  {
    id: "tx-3",
    kind: "deposit",
    status: "success",
    name: t("Deposit · telebirr", "ገቢ · telebirr"),
    meta: t("14:02 · TX-8841-2207"),
    amount: 500,
    date: "2026-09-28",
  },
  {
    id: "tx-4",
    kind: "withdrawal",
    status: "pending",
    name: t("Withdrawal · CBE Birr", "ወጪ · CBE Birr"),
    meta: t("11:40 · TX-8839-1180"),
    amount: -300,
    date: "2026-09-28",
  },
  {
    id: "tx-5",
    kind: "winnings",
    status: "success",
    name: t("Winnings · KS-260926-1177", "አሸናፊነት · KS-260926-1177"),
    meta: t("23:58 · after tax", "23:58 · ግብር ተቀንሷል"),
    amount: winningsFor("KS-260926-1177"),
    date: "2026-09-27",
  },
  {
    id: "tx-6",
    kind: "deposit",
    status: "failed",
    name: t("Deposit · Chapa", "ገቢ · Chapa"),
    meta: t("19:15 · TX-8826-0412"),
    amount: 200,
    date: "2026-09-27",
  },
];

/** Day headings the transactions list groups under. */
export const TRANSACTION_DAYS: Array<{ date: string; label: Localized }> = [
  { date: "2026-09-28", label: t("Today · Mon 28 Sep", "ዛሬ · ሰኞ መስከረም 18") },
  {
    date: "2026-09-27",
    label: t("Yesterday · Sun 27 Sep", "ትናንት · እሑድ መስከረም 17"),
  },
];
