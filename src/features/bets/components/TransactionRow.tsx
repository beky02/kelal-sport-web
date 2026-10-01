"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import type { Transaction, TransactionStatus } from "../types";

const STATUS_TONE: Record<TransactionStatus, string> = {
  success: "border-accent text-accent",
  pending: "border-divider text-muted",
  failed: "border-loss text-loss",
};

/**
 * One wallet movement.
 *
 * Shared by the transactions list and the wallet's recent activity so the two can
 * never drift into showing the same money differently. Direction reads from the
 * arrow and the sign before the label is read at all.
 */
export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const t = useTranslation();
  const outgoing = transaction.amount < 0;

  const statusLabel: Record<TransactionStatus, string> = {
    success: t.t("bets.txSuccess"),
    pending: t.t("bets.txPending"),
    failed: t.t("bets.txFailed"),
  };

  return (
    <div className="border-divider grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-2.5">
      <span className="bg-surface text-muted grid size-9 place-items-center rounded-md">
        {outgoing ? (
          <ArrowUp size={14} strokeWidth={2} aria-hidden />
        ) : (
          <ArrowDown size={14} strokeWidth={2} aria-hidden />
        )}
      </span>

      <div className="min-w-0">
        <div className="truncate font-medium">{t.pick(transaction.name)}</div>
        <div className="text-muted text-[11px]">{t.pick(transaction.meta)}</div>
      </div>

      <div className="flex flex-col items-end gap-[3px]">
        <span
          className={cn(
            "numeric font-semibold",
            transaction.kind === "winnings" ? "text-win" : "text-text",
            transaction.status === "failed" && "line-through",
          )}
        >
          {outgoing ? "−" : "+"} {t.number(Math.abs(transaction.amount))}
        </span>
        <span
          className={cn(
            "rounded-full border px-2.5 py-[3px] text-[10px] font-bold tracking-[0.06em] uppercase",
            STATUS_TONE[transaction.status],
          )}
        >
          {statusLabel[transaction.status]}
        </span>
      </div>
    </div>
  );
}
