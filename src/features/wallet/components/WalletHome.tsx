"use client";

import { useId } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useDateTimeText } from "@/lib/i18n/use-date-time-text";
import { Skeleton } from "@/components/ui/Skeleton";
import { routes } from "@/config/routes";
import { compareMoney } from "@/lib/money";
import { useRecentTransactions } from "../hooks/use-wallet";
import type { WalletBalances } from "../types";
import { TransactionRow } from "./TransactionRow";

const aboveZero = (amount: string | null): amount is string =>
  amount !== null && compareMoney(amount, "0.00") > 0;

/**
 * The wallet at rest.
 *
 * The balance is cash — what bets are paid from and what can be withdrawn
 * (C03) — exactly as the API states it. Whatever else the player holds or owes
 * is said right under it, so nobody finds out at the withdrawal screen: bonus
 * money is for bets only, a pending withdrawal is already out of the balance,
 * and a debt is repaid first. Each line shows only when there is something to
 * say; none of them is computed here.
 */
export function WalletHome({
  balances,
  onDeposit,
  onWithdraw,
}: {
  balances: WalletBalances;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const t = useTranslation();
  const dateTime = useDateTimeText();
  // The wallet is only shown to a signed-in player.
  const recent = useRecentTransactions(true);
  const recentId = useId();

  const lines = [
    aboveZero(balances.bonus) && {
      key: "bonus",
      label: t.t("wallet.bonus"),
      amount: balances.bonus,
      note: t.t("wallet.bonusNote"),
    },
    aboveZero(balances.locked) && {
      key: "locked",
      label: t.t("wallet.locked"),
      amount: balances.locked,
      note: null,
    },
    aboveZero(balances.debt) && {
      key: "debt",
      label: t.t("wallet.debt"),
      amount: balances.debt,
      note: t.t("wallet.debtNote"),
    },
  ].filter((line) => line !== false);

  return (
    <>
      <div className="px-4 pt-4">
        <h2 className="text-2xl">{t.t("wallet.title")}</h2>
      </div>

      <div className="grid items-start xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0">
          <div className="bg-surface mx-4 mt-3.5 flex flex-col gap-3.5 rounded-lg px-4 pt-4.5 pb-4">
            <div>
              <div className="text-muted text-[11px]">
                {t.t("wallet.balance")}
              </div>
              <div
                data-testid="wallet-cash"
                className="font-display numeric text-[32px] leading-[1.05]"
              >
                {t.money(balances.cash)}
              </div>
            </div>

            {lines.length > 0 && (
              <dl className="border-divider flex flex-col gap-2 border-t pt-2.5 text-xs">
                {lines.map((line) => (
                  <div
                    key={line.key}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5"
                  >
                    <dt className="text-muted">{line.label}</dt>
                    <dd className="numeric text-right font-semibold">
                      {t.money(line.amount)}
                    </dd>
                    {line.note && (
                      <dd className="text-muted col-span-2 text-[11px]">
                        {line.note}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onDeposit}
                className="bg-accent text-on-accent font-body h-12 cursor-pointer rounded-md text-[15px] font-bold"
              >
                {t.t("wallet.deposit")}
              </button>
              <button
                type="button"
                onClick={onWithdraw}
                className="bg-raised text-text font-body h-12 cursor-pointer rounded-md text-[15px] font-bold"
              >
                {t.t("wallet.withdraw")}
              </button>
            </div>
          </div>
        </div>

        <section aria-labelledby={recentId} className="min-w-0">
          <div className="flex items-baseline justify-between px-4 pt-5.5 pb-2">
            <h3 id={recentId} className="font-display text-[15px]">
              {t.t("wallet.recent")}
            </h3>
            <Link
              href={routes.transactions}
              className="text-accent text-xs font-semibold"
            >
              {t.t("wallet.seeAll")}
            </Link>
          </div>

          <div className="border-divider border-t">
            {recent.isPending ? (
              Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <Skeleton className="size-9 rounded-md" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </div>
              ))
            ) : !recent.data ? (
              <div
                role="alert"
                className="bg-loss-bg mx-4 mt-3 flex items-center gap-2.5 rounded-md p-3"
              >
                <CircleAlert
                  size={17}
                  strokeWidth={1.5}
                  aria-hidden
                  className="text-loss shrink-0"
                />
                <span className="min-w-0 flex-1 text-xs font-semibold">
                  {t.t("wallet.recentFailed")}
                </span>
                <button
                  type="button"
                  onClick={() => void recent.refetch()}
                  className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
                >
                  {t.t("common.retry")}
                </button>
              </div>
            ) : recent.data.items.length === 0 ? (
              <p className="text-muted px-4 py-6 text-center text-xs">
                {t.t("wallet.recentEmpty")}
              </p>
            ) : (
              <ul>
                {recent.data.items.map((txn) => (
                  <li key={txn.id}>
                    {/* No day headings here: each row says its date too. */}
                    <TransactionRow txn={txn} when={dateTime(txn.createdAt)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
