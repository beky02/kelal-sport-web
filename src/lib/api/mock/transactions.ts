/**
 * Wallet movements, ported from `Screen Bets.dc.html` — the wallet's mock
 * until F6 puts the transactions on the contract. (My bets left the mocks in
 * F5b: tickets come from `/v1/bets`.)
 */
import type { Transaction } from "@/features/bets/types";
import type { Localized } from "@/types/common";

const t = (en: string, am?: string): Localized => ({ en, am: am ?? en });

/** The winnings credited for a won ticket, as the wallet's mock shows them. */
const WON_TICKET_WINNINGS = "589.05";

/** Amounts are signed: negative leaves the wallet. */
export const TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    kind: "bet",
    status: "success",
    name: t("Bet stake · KS-260927-3381", "ውርርድ · KS-260927-3381"),
    meta: t("16:51"),
    amount: "-100.00",
    date: "2026-09-28",
  },
  {
    id: "tx-2",
    kind: "bet",
    status: "success",
    name: t("Bet stake · KS-260927-2954", "ውርርድ · KS-260927-2954"),
    meta: t("16:05"),
    amount: "-200.00",
    date: "2026-09-28",
  },
  {
    id: "tx-3",
    kind: "deposit",
    status: "success",
    name: t("Deposit · telebirr", "ገቢ · telebirr"),
    meta: t("14:02 · TX-8841-2207"),
    amount: "500.00",
    date: "2026-09-28",
  },
  {
    id: "tx-4",
    kind: "withdrawal",
    status: "pending",
    name: t("Withdrawal · CBE Birr", "ወጪ · CBE Birr"),
    meta: t("11:40 · TX-8839-1180"),
    amount: "-300.00",
    date: "2026-09-28",
  },
  {
    id: "tx-5",
    kind: "winnings",
    status: "success",
    name: t("Winnings · KS-260926-1177", "አሸናፊነት · KS-260926-1177"),
    meta: t("23:58 · after tax", "23:58 · ግብር ተቀንሷል"),
    amount: WON_TICKET_WINNINGS,
    date: "2026-09-27",
  },
  {
    id: "tx-6",
    kind: "deposit",
    status: "failed",
    name: t("Deposit · Chapa", "ገቢ · Chapa"),
    meta: t("19:15 · TX-8826-0412"),
    amount: "200.00",
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
