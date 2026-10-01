"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Skeleton } from "@/components/ui/Skeleton";
import { routes } from "@/config/routes";
import { TransactionRow } from "@/features/bets/components/TransactionRow";
import { useTransactions } from "@/features/bets/hooks/use-bets";
import type { WalletOverview } from "../types";

/**
 * The wallet at rest.
 *
 * Balance leads, but `withdrawable` is stated right under it, because the two
 * differ and finding that out at the withdrawal screen feels like a bait. The
 * daily limit is shown with how much is left, and links to where it can be
 * changed — a limit the user set is not an obstacle to hide.
 */
export function WalletHome({
  overview,
  onDeposit,
  onWithdraw,
}: {
  overview: WalletOverview;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const t = useTranslation();
  const { data: days } = useTransactions("all");

  const recent = (days ?? []).flatMap((day) => day.items).slice(0, 5);
  const used = overview.depositedToday;
  const limit = overview.dailyDepositLimit;
  const usedShare = limit === 0 ? 0 : Math.min(1, used / limit);

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
              <div className="font-display numeric text-[32px] leading-[1.05]">
                {t.money(overview.balance)}
              </div>
            </div>

            <div className="border-divider flex justify-between border-t pt-2.5 text-xs">
              <span className="text-muted">{t.t("wallet.withdrawable")}</span>
              <span className="numeric font-semibold">
                {t.money(overview.withdrawable)}
              </span>
            </div>

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

          <div className="bg-surface mx-4 mt-3.5 flex flex-col gap-2 rounded-md p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">{t.t("wallet.dailyLimit")}</span>
              <Link
                href={routes.responsibleGaming}
                className="text-accent font-semibold"
              >
                {t.t("wallet.manage")}
              </Link>
            </div>

            {/* Recessed track: the fill is accent, and a track the same colour as
                the card it sits in would leave the bar floating. */}
            <div className="bg-ground h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-accent h-full"
                style={{ width: `${usedShare * 100}%` }}
              />
            </div>

            <div className="text-muted numeric text-[11px]">
              {t.t("wallet.usedToday", {
                used: t.money(used),
                limit: t.money(limit),
              })}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline justify-between px-4 pt-5.5 pb-2">
            <span className="font-display text-[15px]">
              {t.t("wallet.recent")}
            </span>
            <Link
              href={routes.transactions}
              className="text-accent text-xs font-semibold"
            >
              {t.t("wallet.seeAll")}
            </Link>
          </div>

          <div className="border-divider border-t">
            {recent.length === 0
              ? Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <Skeleton className="size-9 rounded-md" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                  </div>
                ))
              : recent.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                  />
                ))}
          </div>
        </div>
      </div>
    </>
  );
}
