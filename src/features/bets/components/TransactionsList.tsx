"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import { useTransactions } from "../hooks/use-bets";
import type { TransactionKind } from "../types";
import { TransactionRow } from "./TransactionRow";

type Filter = TransactionKind | "all";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "bets.filterAll" },
  { value: "deposit", label: "bets.filterDeposits" },
  { value: "withdrawal", label: "bets.filterWithdrawals" },
  { value: "bet", label: "bets.filterBets" },
];

/**
 * Every movement in and out of the wallet, newest day first.
 *
 * Money out is signed and money in is not, so the direction of a row reads before
 * its label does. A failed transaction keeps its amount struck through rather than
 * disappearing — people go looking for the deposit that did not arrive.
 */
export function TransactionsList() {
  const t = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");
  const { data: days, isPending } = useTransactions(filter);

  return (
    <div className="flex flex-col">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto p-4">
        {FILTERS.map((option) => {
          const on = option.value === filter;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(option.value)}
              className={cn(
                "font-body h-[38px] shrink-0 cursor-pointer rounded-md border px-3.5 text-xs font-semibold",
                on
                  ? "border-accent bg-accent text-on-accent"
                  : "bg-raised text-text border-transparent",
              )}
            >
              {t.t(option.label as "bets.filterAll")}
            </button>
          );
        })}
      </div>

      {isPending &&
        Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <Skeleton className="size-9 rounded-md" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-2.5 w-28" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}

      {days?.length === 0 && (
        <StateMessage
          icon={<Receipt size={24} strokeWidth={1.5} />}
          title={t.t("bets.emptyTitle")}
          body={t.t("bets.emptyBody")}
        />
      )}

      {days?.map((day) => (
        <div key={day.date}>
          <div className="bg-surface border-divider text-muted border-t border-b px-4 pt-2.5 pb-1.5 text-[11px] font-semibold">
            {t.pick(day.label)}
          </div>

          {day.items.map((item) => (
            <TransactionRow key={item.id} transaction={item} />
          ))}
        </div>
      ))}
    </div>
  );
}
