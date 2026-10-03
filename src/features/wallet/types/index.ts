/** Where a payment goes. Mobile money dominates here; gateways cover cards. */
export type PaymentMethodKind = "mobile" | "gateway";

export interface PaymentMethod {
  id: string;
  /** Brand name, not translated. */
  name: string;
  /** Two or three characters for the tile. */
  mono: string;
  kind: PaymentMethodKind;
  minAmount: number;
  maxAmount: number;
  /** Whether money can be sent back out through it. */
  supportsWithdrawal: boolean;
}

export type WalletMode = "deposit" | "withdraw";

export type WalletStep =
  "home" | "method" | "amount" | "confirm" | "pending" | "success" | "failed";

/** The steps with a progress bar. The results are outcomes, not steps. */
export const WALLET_FLOW: readonly WalletStep[] = [
  "method",
  "amount",
  "confirm",
];

/**
 * The player's balances as `/v1/wallet` states them (C03 §4), decimal strings
 * untouched. Nothing here is ever computed in the browser: after any money
 * operation the wallet is read again.
 */
export interface WalletBalances {
  /** What bets are paid from and what can be withdrawn (`PLAYER_CASH`). */
  cash: string;
  /** Bonus money: for bets only, never withdrawable (`PLAYER_BONUS`). */
  bonus: string;
  /** Pending withdrawals, already out of `cash` (`PLAYER_LOCKED`). */
  locked: string;
  /**
   * Owed after a resettlement clawback, repaid first from deposits and wins
   * (`PLAYER_DEBT`). Null when the API didn't say — never `"0.00"`.
   */
  debt: string | null;
  currency: "ETB";
}

/** The contract's `WalletTxn.type`, in its order. */
export const WALLET_TXN_TYPES = [
  "deposit",
  "withdrawal",
  "withdrawal_released",
  "bet",
  "win",
  "refund",
  "bonus",
  "bonus_converted",
  "adjustment",
] as const;
export type WalletTxnType = (typeof WALLET_TXN_TYPES)[number];

/**
 * A movement's kind as the screens know it: one of the contract's, or `other`
 * for a kind added to the contract after this build (TD-01 allows additive
 * values within `/v1`) — shown, rather than failing the whole page.
 */
export type WalletTxnKind = WalletTxnType | "other";

/** The contract's `WalletTxn.reference.type`, in its order. */
export const WALLET_TXN_REFERENCE_TYPES = [
  "payment",
  "bet",
  "bonus",
  "adjustment",
  "game_round",
] as const;

/** What a movement was for, when the API names it: a payment, a bet… */
export interface WalletTxnReference {
  type: (typeof WALLET_TXN_REFERENCE_TYPES)[number];
  id: string;
}

/** One ledger movement — a posted fact, never pending or failed (C03 §2). */
export interface WalletTxn {
  id: string;
  type: WalletTxnKind;
  /** Signed, from the player's side: negative left the wallet. */
  amount: string;
  /**
   * `balance_after`, as the API sends it. The contract doesn't say which of
   * the player's accounts it follows; for deposits, bets and wins its own
   * examples make it the cash balance.
   */
  balanceAfter: string;
  /** The API's name for what it was for (`telebirr`, a ticket number). */
  label: string | null;
  reference: WalletTxnReference | null;
  createdAt: string;
}

export interface WalletTxnPage {
  items: WalletTxn[];
  nextCursor: string | null;
}

/** The history's filters: everything, or one of the contract's types. */
export const HISTORY_FILTERS = [
  "all",
  "deposit",
  "withdrawal",
  "bet",
  "win",
] as const satisfies readonly ("all" | WalletTxnType)[];
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

/** What the payment provider said. */
export interface PaymentResult {
  reference: string;
  status: "pending" | "success" | "failed";
  amount: number;
}
