/** The contract's `PaymentMethodCode`, in its order: what a deposit is sent with. */
export const PAYMENT_METHOD_CODES = [
  "telebirr",
  "cbebirr",
  "mpesa_et",
  "chapa",
  "arifpay",
  "santimpay",
  "mock",
] as const;
export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];

/** A method's limits per transaction, as the API states them: decimal strings. */
export interface AmountRange {
  min: string;
  max: string;
}

/**
 * How the player pays (`PaymentMethod.flow`): approve a push on their phone, or
 * pay on the provider's page or app. `other` for a flow the contract adds
 * after this build — the tile then says nothing about it. What actually
 * happens is the deposit's `next_action`, not this.
 */
export type PaymentFlow = "app_or_web" | "redirect" | "ussd_push" | "other";

/** A way to pay, as `/v1/payment-methods` offers it to this player. */
export interface PaymentMethod {
  code: PaymentMethodCode;
  /** The API's name for it (a brand, not translated here). */
  name: string;
  flow: PaymentFlow;
  /** False while the provider is down: it can't be chosen. */
  available: boolean;
  deposit: AmountRange;
  /** Null when money can't be sent back out through it. */
  withdrawal: AmountRange | null;
}

export type WalletMode = "deposit" | "withdraw";

/**
 * Where a deposit or withdrawal flow is: its questions — a withdrawal also
 * asks which account — then the outcome.
 */
export type FlowStep = "method" | "account" | "amount" | "confirm" | "result";

/** A deposit's steps, with a progress bar. The outcome is not a step. */
export const WALLET_FLOW: readonly FlowStep[] = ["method", "amount", "confirm"];

/** A withdrawal's steps: the account it goes to comes after the method. */
export const WITHDRAW_FLOW: readonly FlowStep[] = [
  "method",
  "account",
  "amount",
  "confirm",
];

/** The contract's `DepositStatus`, in its order. */
export const DEPOSIT_STATUSES = [
  "initiated",
  "pending",
  "completed",
  "failed",
  "expired",
] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

/**
 * What the API says the player does next (`next_action`), as this site can
 * follow it: leave for the provider's page — only one the server's allow-list
 * names, over https — or approve the push on their phone. Anything else —
 * an app-only payment (`app_sdk`), a page the allow-list doesn't name, a type
 * the contract adds later — can't be finished on the website.
 */
export type DepositNextAction =
  | { type: "redirect"; url: string }
  | { type: "ussd_push"; message: string | null }
  | {
      type: "unsupported";
      reason: "app_sdk" | "redirect_refused" | "unknown";
    };

/** A deposit as `/v1/deposits` states it. Nothing here is worked out in the browser. */
export interface Deposit {
  /** Ours, not the provider's: shown as the reference. */
  id: string;
  method: PaymentMethodCode;
  amount: string;
  status: DepositStatus;
  nextAction: DepositNextAction | null;
  /** The API's own words on why it failed, when it gave them. */
  failureReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** What the player asks for: a method and an amount in the contract's form. */
export interface DepositRequest {
  method: PaymentMethodCode;
  amount: string;
}

/** A saved account withdrawals can be sent to (`/v1/me/payout-accounts`). */
export interface PayoutAccount {
  id: string;
  /** The method it is paid through. */
  provider: PaymentMethodCode;
  /** The number as the API shows it — masked, never the whole of it. */
  accountMasked: string;
  /** The account holder's name, once the provider has given it. */
  holderName: string | null;
  verified: boolean;
  createdAt: string;
}

/**
 * A payout account the player adds: the method and their mobile number in
 * the contract's `Phone` form (`+251911234567`).
 */
export interface PayoutAccountRequest {
  provider: PaymentMethodCode;
  account: string;
}

/**
 * Where a withdrawal goes: a saved account, by its id — the contract's
 * preferred form — or a new mobile number, which the API saves as an account.
 */
export type WithdrawalDestination =
  { kind: "saved"; payoutAccountId: string } | { kind: "new"; account: string };

/** What the player asks for: a method, an amount in the contract's form, and where to. */
export interface WithdrawalRequest {
  method: PaymentMethodCode;
  amount: string;
  to: WithdrawalDestination;
}

/** The contract's `WithdrawalStatus`, in its order. */
export const WITHDRAWAL_STATUSES = [
  "requested",
  "review",
  "approved",
  "processing",
  "paid",
  "failed",
  "rejected",
  "cancelled",
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

/** A withdrawal as `/v1/withdrawals` states it. Nothing here is worked out in the browser. */
export interface Withdrawal {
  /** Ours, not the provider's: shown as the reference. */
  id: string;
  method: PaymentMethodCode;
  amount: string;
  status: WithdrawalStatus;
  /** Where it goes, masked as the API shows it; null when it didn't say. */
  accountMasked: string | null;
  /**
   * Why it is being reviewed: a code (`FIRST_WITHDRAWAL`), put in words only
   * when this app knows it — never shown as it is.
   */
  reviewReason: string | null;
  /** Why it was rejected, in the API's own words. */
  rejectionReason: string | null;
  createdAt: string;
  paidAt: string | null;
}

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

/** What the mock said about a withdrawal, until F6c moves it to `/v1/withdrawals`. */
export interface PaymentResult {
  reference: string;
  status: "pending" | "success" | "failed";
  amount: string;
}
