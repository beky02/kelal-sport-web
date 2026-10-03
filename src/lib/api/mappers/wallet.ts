import {
  WALLET_TXN_REFERENCE_TYPES,
  WALLET_TXN_TYPES,
  type WalletBalances,
  type WalletTxn,
  type WalletTxnKind,
  type WalletTxnPage,
  type WalletTxnReference,
} from "@/features/wallet/types";
import type { components, paths } from "@/lib/api/schema";

type ApiWallet = components["schemas"]["Wallet"];
type ApiWalletTxn = components["schemas"]["WalletTxn"];
type ApiWalletTxnPage =
  paths["/v1/wallet/transactions"]["get"]["responses"][200]["content"]["application/json"];

/**
 * `/v1/wallet` → the balances the screens show. Every amount is the API's
 * string, untouched; an absent `debt` stays absent rather than becoming zero.
 */
export function toWalletBalances(wallet: ApiWallet): WalletBalances {
  return {
    cash: wallet.cash,
    bonus: wallet.bonus,
    locked: wallet.locked,
    debt: wallet.debt ?? null,
    currency: wallet.currency,
  };
}

const isTxnType = (type: string): type is WalletTxnKind =>
  (WALLET_TXN_TYPES as readonly string[]).includes(type);

const isReferenceType = (type: string): type is WalletTxnReference["type"] =>
  (WALLET_TXN_REFERENCE_TYPES as readonly string[]).includes(type);

/**
 * One ledger movement. The amount keeps the API's sign. A reference is kept
 * only when it says both what and which — that is what a link needs — while
 * its label names the movement either way. A kind or a reference type the
 * contract adds after this build becomes `other` / no link, so one new value
 * never takes the whole history down (TD-01: additive changes within `/v1`).
 */
export function toWalletTxn(txn: ApiWalletTxn): WalletTxn {
  const ref = txn.reference;
  return {
    id: txn.id,
    type: isTxnType(txn.type) ? txn.type : "other",
    amount: txn.amount,
    balanceAfter: txn.balance_after,
    label: ref?.label ?? null,
    reference:
      ref?.type && isReferenceType(ref.type) && ref.id
        ? { type: ref.type, id: ref.id }
        : null,
    createdAt: txn.created_at,
  };
}

export function toWalletTxnPage(page: ApiWalletTxnPage): WalletTxnPage {
  return {
    items: page.items.map(toWalletTxn),
    nextCursor: page.next_cursor ?? null,
  };
}
