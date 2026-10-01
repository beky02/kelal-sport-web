import type { Localized } from "@/types/common";

export type BetStatus = "open" | "won" | "lost" | "cashed";

/** A leg's own outcome. `void` means the fixture fell through and it prices at 1.00. */
export type LegStatus = "open" | "live" | "won" | "lost" | "void";

export interface BetLeg {
  market: Localized;
  pick: Localized;
  match: Localized;
  odds: number;
  status: LegStatus;
  /** Score, kickoff or "Postponed" — whatever explains the leg's state. */
  result: Localized;
}

export interface Bet {
  /** The ticket id, e.g. `KS-260927-3381`. */
  id: string;
  status: BetStatus;
  /** At least one leg is in play. Drives the LIVE badge on an open bet. */
  live: boolean;
  placedAt: Localized;
  stake: number;
  /** What the book currently offers to buy the bet back for. Null when closed. */
  cashOutValue: number | null;
  /** Trading is suspended on a leg, so cash out is off. */
  cashOutBlocked: boolean;
  /** What was actually paid on a cashed-out bet. */
  cashedOutAmount: number | null;
  legs: BetLeg[];
}

export type BetsTab = "open" | "settled" | "won" | "lost";

export interface BetCounts {
  open: number;
  settled: number;
  won: number;
  lost: number;
}

export type TransactionKind = "deposit" | "withdrawal" | "bet" | "winnings";
export type TransactionStatus = "success" | "pending" | "failed";

export interface Transaction {
  id: string;
  kind: TransactionKind;
  status: TransactionStatus;
  name: Localized;
  /** Time and reference, already formatted. */
  meta: Localized;
  /** Signed: negative leaves the wallet. */
  amount: number;
  /** ISO date, for grouping into days. */
  date: string;
}

/** The product of every leg — a void leg contributes 1.00 and so drops out. */
export const totalOdds = (legs: readonly BetLeg[]): number =>
  legs.reduce((product, leg) => product * leg.odds, 1);

/** An open bet with a live leg badges as LIVE rather than merely Open. */
export const displayStatus = (bet: Bet): BetStatus | "live" =>
  bet.status === "open" && bet.live ? "live" : bet.status;
