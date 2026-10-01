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

export interface WalletOverview {
  balance: number;
  /**
   * What can be taken out now. Lower than the balance when some of it is a
   * bonus, or pending, or the account is not yet ID-verified.
   */
  withdrawable: number;
  currency: string;
  dailyDepositLimit: number;
  depositedToday: number;
}

/** What the payment provider said. */
export interface PaymentResult {
  reference: string;
  status: "pending" | "success" | "failed";
  amount: number;
  /** The balance after it settles, as the server computed it. */
  newBalance: number;
}

/** Headroom under today's deposit limit. */
export const remainingDepositAllowance = (overview: WalletOverview): number =>
  Math.max(0, overview.dailyDepositLimit - overview.depositedToday);
