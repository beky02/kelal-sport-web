import { apiClient } from "@/lib/api/client";
import { walletBalancesSchema, walletTxnPageSchema } from "@/lib/api/schemas";
import type { WalletBalances, WalletTxnPage, WalletTxnType } from "../types";

/** The player's balances, as `/v1/wallet` states them (through `/api/wallet`). */
export const getWallet = (signal?: AbortSignal): Promise<WalletBalances> =>
  apiClient.get("/wallet", walletBalancesSchema, { signal });

/**
 * One page of the wallet history (`/v1/wallet/transactions`, through
 * `/api/wallet/transactions`): one of the contract's types or all of them,
 * after the previous page's cursor, `limit` movements or the API's default.
 */
export const getWalletHistory = (
  query: {
    type: WalletTxnType | null;
    cursor: string | null;
    limit: number | null;
  },
  signal?: AbortSignal,
): Promise<WalletTxnPage> =>
  apiClient.get("/wallet/transactions", walletTxnPageSchema, {
    params: {
      type: query.type ?? undefined,
      cursor: query.cursor ?? undefined,
      limit: query.limit ?? undefined,
    },
    signal,
  });
