/**
 * Payment methods and wallet state, ported from `Screen Wallet.dc.html`.
 *
 * The amounts are placeholders. Balance, withdrawable and the daily limit are all
 * server-owned in production — in particular `withdrawable` is not something the
 * client can work out, since it depends on bonus terms and ID verification.
 */
import type { PaymentMethod, WalletOverview } from "@/features/wallet/types";

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "telebirr",
    name: "telebirr",
    mono: "tb",
    kind: "mobile",
    minAmount: 10,
    maxAmount: 50_000,
    supportsWithdrawal: true,
  },
  {
    id: "cbebirr",
    name: "CBE Birr",
    mono: "CBE",
    kind: "mobile",
    minAmount: 10,
    maxAmount: 50_000,
    supportsWithdrawal: true,
  },
  {
    id: "mpesa",
    name: "M-Pesa",
    mono: "MP",
    kind: "mobile",
    minAmount: 10,
    maxAmount: 30_000,
    supportsWithdrawal: true,
  },
  {
    id: "chapa",
    name: "Chapa",
    mono: "CH",
    kind: "gateway",
    minAmount: 50,
    maxAmount: 100_000,
    supportsWithdrawal: true,
  },
  {
    id: "santimpay",
    name: "SantimPay",
    mono: "SP",
    kind: "gateway",
    minAmount: 50,
    maxAmount: 100_000,
    supportsWithdrawal: false,
  },
  {
    id: "arifpay",
    name: "ArifPay",
    mono: "AP",
    kind: "gateway",
    minAmount: 50,
    maxAmount: 100_000,
    supportsWithdrawal: false,
  },
];

export const WALLET_OVERVIEW: WalletOverview = {
  balance: 1250,
  withdrawable: 980,
  currency: "ETB",
  dailyDepositLimit: 2000,
  depositedToday: 500,
};

/** The account money moves to and from, masked as the design shows it. */
export const PAYOUT_ACCOUNT = "+251 9•• ••• 482";
