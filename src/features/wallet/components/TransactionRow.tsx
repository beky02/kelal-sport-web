"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import type { WalletTxn, WalletTxnKind } from "../types";

const KIND: Record<WalletTxnKind, MessageKey> = {
  deposit: "history.type.deposit",
  withdrawal: "history.type.withdrawal",
  withdrawal_released: "history.type.withdrawal_released",
  bet: "history.type.bet",
  win: "history.type.win",
  refund: "history.type.refund",
  bonus: "history.type.bonus",
  bonus_converted: "history.type.bonus_converted",
  adjustment: "history.type.adjustment",
  other: "history.type.other",
};

/**
 * Kinds whose `balance_after` may be another account's than the balance the
 * wallet shows: a bonus grant posts only to the bonus account, a conversion
 * to both (C03 §6), and an unknown kind could be anything. The contract
 * doesn't say which balance it reports, so for these the line is left out
 * rather than shown as "Balance".
 */
const BALANCE_UNCLEAR: ReadonlySet<WalletTxnKind> = new Set([
  "bonus",
  "bonus_converted",
  "other",
]);

const ROW = "grid items-center gap-3 border-b border-divider px-4 py-2.5";

/**
 * One ledger movement.
 *
 * Shared by the history and the wallet's recent activity so the two can never
 * show the same money differently. Every figure is the API's: the amount with
 * its own sign — the arrow and a real minus say which way it went before the
 * label is read — and the balance after it, where the contract makes clear
 * which balance that is. A movement for a bet opens that ticket, and says so
 * with a chevron. `when` is the time as the list around it needs it.
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
        {!BALANCE_UNCLEAR.has(txn.type) && (
          <span className="text-muted numeric text-[11px]">
            {t.t("history.balanceAfter", {
              amount: t.money(txn.balanceAfter),
            })}
          </span>
        )}
      </span>
    </>
  );

  return txn.reference?.type === "bet" ? (
    <Link
      href={routes.bet(txn.reference.id)}
      className={cn(
        ROW,
        "hover:bg-raised grid-cols-[36px_minmax(0,1fr)_auto_14px] no-underline",
      )}
    >
      {content}
      <ChevronRight
        size={14}
        strokeWidth={2}
        aria-hidden
        className="text-muted"
      />
    </Link>
  ) : (
    <div className={cn(ROW, "grid-cols-[36px_minmax(0,1fr)_auto]")}>
      {content}
    </div>
  );
}
