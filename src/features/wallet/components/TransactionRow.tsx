"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import type { WalletTxn, WalletTxnType } from "../types";

const KIND: Record<WalletTxnType, MessageKey> = {
  deposit: "history.type.deposit",
  withdrawal: "history.type.withdrawal",
  withdrawal_released: "history.type.withdrawal_released",
  bet: "history.type.bet",
  win: "history.type.win",
  refund: "history.type.refund",
  bonus: "history.type.bonus",
  bonus_converted: "history.type.bonus_converted",
  adjustment: "history.type.adjustment",
};

const ROW =
  "grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-b border-divider px-4 py-2.5";

/**
 * One ledger movement.
 *
 * Shared by the history and the wallet's recent activity so the two can never
 * show the same money differently. Every figure is the API's: the amount with
 * its own sign — the arrow and a real minus say which way it went before the
 * label is read — and the cash balance once it was posted. A movement for a
 * bet opens that ticket. `when` is the time as the list around it needs it.
 */
export function TransactionRow({
  txn,
  when,
}: {
  txn: WalletTxn;
  when: string;
}) {
  const t = useTranslation();
  const outgoing = txn.amount.startsWith("-");
  const kind = t.t(KIND[txn.type]);
  const name = txn.label
    ? t.t("history.withLabel", { kind, label: txn.label })
    : kind;

  const content = (
    <>
      <span className="bg-surface text-muted grid size-9 place-items-center rounded-md">
        {outgoing ? (
          <ArrowUp size={14} strokeWidth={2} aria-hidden />
        ) : (
          <ArrowDown size={14} strokeWidth={2} aria-hidden />
        )}
      </span>

      <span className="flex min-w-0 flex-col">
        <span className="text-text truncate font-medium">{name}</span>
        <span className="text-muted numeric text-[11px]">{when}</span>
      </span>

      <span className="flex flex-col items-end gap-[3px]">
        <span
          className={cn(
            "numeric font-semibold",
            txn.type === "win" ? "text-win" : "text-text",
          )}
        >
          {outgoing ? "−" : "+"} {t.money(txn.amount.replace("-", ""))}
        </span>
        <span className="text-muted numeric text-[11px]">
          {t.t("history.balanceAfter", { amount: t.money(txn.balanceAfter) })}
        </span>
      </span>
    </>
  );

  return txn.reference?.type === "bet" ? (
    <Link
      href={routes.bet(txn.reference.id)}
      className={cn(ROW, "hover:bg-raised no-underline")}
    >
      {content}
    </Link>
  ) : (
    <div className={ROW}>{content}</div>
  );
}
