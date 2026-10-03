import "server-only";
import type {
  WalletBalances,
  WalletTxnPage,
  WalletTxnType,
} from "@/features/wallet/types";
import { toWalletBalances, toWalletTxnPage } from "@/lib/api/mappers/wallet";
import { withSession, type Session, type SessionContext } from "./session";
import { upstream } from "./upstream";

/**
 * The player's balances (`GET /v1/wallet`, never cached by the API). An
 * expired access token is refreshed once and the read made again.
 */
export async function loadWallet(
  ctx: SessionContext,
  session: Session,
): Promise<WalletBalances> {
  const wallet = await withSession(ctx, session, (authorization) =>
    upstream("Wallet", { ...ctx, authorization }).GET("/v1/wallet"),
  );
  return toWalletBalances(wallet);
}

/** One page of the ledger, as the route handler checked it. */
export interface HistoryQuery {
  type: WalletTxnType | null;
  cursor: string | null;
  limit: number | null;
}

/**
 * One page of the player's wallet history (`GET /v1/wallet/transactions`),
 * newest first. One read in the player's language: movements carry labels
 * (`telebirr`, a ticket number), not translated names.
 */
export async function loadWalletHistory(
  ctx: SessionContext,
  session: Session,
  { type, cursor, limit }: HistoryQuery,
): Promise<WalletTxnPage> {
  const page = await withSession(ctx, session, (authorization) =>
    upstream("Wallet", { ...ctx, authorization }).GET(
      "/v1/wallet/transactions",
      {
        params: {
          query: {
            ...(type ? { type } : {}),
            ...(cursor ? { cursor } : {}),
            ...(limit ? { limit } : {}),
          },
        },
      },
    ),
  );
  return toWalletTxnPage(page);
}
