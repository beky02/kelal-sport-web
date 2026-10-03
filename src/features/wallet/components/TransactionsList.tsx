"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleAlert, Loader2, Receipt, TriangleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n";
import {
  addDays,
  formatDayMonth,
  formatWeekday,
  toEat,
  todayEat,
} from "@/lib/i18n/dates";
import { formatKickoff } from "@/lib/i18n/format";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import { useUiStore } from "@/stores/ui.store";
import { useSession } from "@/features/auth/hooks/use-session";
import { useWalletHistory } from "../hooks/use-wallet";
import { groupByDay } from "../lib/history";
import { HISTORY_FILTERS, type HistoryFilter } from "../types";
import { TransactionRow } from "./TransactionRow";
import { WalletGuest } from "./WalletGuest";

const FILTER_LABEL: Record<HistoryFilter, MessageKey> = {
  all: "history.filterAll",
  deposit: "history.filterDeposits",
  withdrawal: "history.filterWithdrawals",
  bet: "history.filterBets",
  win: "history.filterWins",
};

/**
 * Every movement in and out of the wallet, newest day first.
 *
 * The ledger's own record (`/v1/wallet/transactions`): each row is a posted
 * movement — never pending, never failed — with the API's signed amount and
 * the balance after it, so the direction reads before the label does and the
 * balance can be followed down the page. A filter is one of the contract's
 * types, so the server filters and pages it.
 */
export function TransactionsList() {
  const t = useTranslation();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const session = useSession();

  // While /api/me is pending nobody is a guest, and nothing is asked for.
  if (!session.isLoading && session.isGuest) return <WalletGuest history />;

  return (
    <div className="flex flex-col">
      <div
        role="group"
        aria-label={t.t("history.filtersLabel")}
        className="no-scrollbar flex gap-1.5 overflow-x-auto p-4"
      >
        {HISTORY_FILTERS.map((value) => {
          const on = value === filter;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(value)}
              className={cn(
                "font-body min-h-11 shrink-0 cursor-pointer rounded-md border px-3.5 text-xs font-semibold",
                on
                  ? "border-accent bg-accent text-on-accent"
                  : "bg-raised text-text border-transparent",
              )}
            >
              {t.t(FILTER_LABEL[value])}
            </button>
          );
        })}
      </div>

      <HistoryList
        // A list per filter: a page asked for under one never lands, or
        // moves focus, under another.
        key={filter}
        filter={filter}
        enabled={!session.isLoading}
      />
    </div>
  );
}

/** One filter's movements, a page at a time, under day headings. */
function HistoryList({
  filter,
  enabled,
}: {
  filter: HistoryFilter;
  enabled: boolean;
}) {
  const t = useTranslation();
  const clock = useUiStore((s) => s.clock);
  const calendar = useUiStore((s) => s.calendar);
  const history = useWalletHistory(filter, enabled);
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const ids = useId();
  const list = useRef<HTMLDivElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  /**
   * Where the page this list's own Show more asked for begins, until it lands
   * or fails — the only time focus is moved.
   */
  const firstNew = useRef<number | null>(null);

  // Show more goes away with the last page, or gives way to "couldn't load
  // more": either way the focus it held must land somewhere useful — the first
  // new movement, or the way to try again.
  useEffect(() => {
    const at = firstNew.current;
    if (at === null || items.length <= at) return;
    firstNew.current = null;
    const row = list.current?.querySelectorAll<HTMLElement>("li[data-row]")[at];
    (row?.querySelector<HTMLElement>("a") ?? row)?.focus();
  }, [items.length]);
  useEffect(() => {
    if (!history.isFetchNextPageError || firstNew.current === null) return;
    firstNew.current = null;
    retry.current?.focus();
  }, [history.isFetchNextPageError]);

  if (history.isPending) {
    // Laid out as the rows will be, so nothing jumps when they land.
    return (
      <div className="flex flex-col">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <Skeleton className="size-9 rounded-md" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-2.5 w-28" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!history.data) {
    return (
      <StateMessage
        icon={<TriangleAlert size={24} strokeWidth={1.5} />}
        title={t.t("history.loadFailedTitle")}
        body={t.t("history.loadFailedBody")}
        action={{
          label: t.t("common.retry"),
          onClick: () => void history.refetch(),
        }}
      />
    );
  }

  if (items.length === 0) {
    return filter === "all" ? (
      <StateMessage
        icon={<Receipt size={24} strokeWidth={1.5} />}
        title={t.t("history.emptyTitle")}
        body={t.t("history.emptyBody")}
      />
    ) : (
      <StateMessage
        icon={<Receipt size={24} strokeWidth={1.5} />}
        title={t.t("history.emptyFilteredTitle")}
        body={t.t("history.emptyFilteredBody")}
      />
    );
  }

  const today = todayEat();
  const yesterday = addDays(today, -1);
  const heading = (date: string) => {
    const day = formatDayMonth(date, t.lang, calendar);
    if (date === today) return t.t("history.today", { date: day });
    if (date === yesterday) return t.t("history.yesterday", { date: day });
    return t.t("history.day", {
      weekday: formatWeekday(date, t.lang),
      date: day,
    });
  };

  const more = () => {
    // A second tap while the page loads asks for nothing more.
    if (history.isFetchingNextPage) return;
    firstNew.current = items.length;
    void history.fetchNextPage();
  };

  return (
    <div ref={list} className="flex flex-col pb-6">
      {groupByDay(items).map((day) => {
        const id = `${ids}-${day.date}`;
        return (
          <section key={day.date} aria-labelledby={id}>
            <h3
              id={id}
              className="bg-surface border-divider text-muted border-t border-b px-4 pt-2.5 pb-1.5 text-[11px] font-semibold"
            >
              {heading(day.date)}
            </h3>
            <ul>
              {day.items.map((txn) => (
                <li
                  key={txn.id}
                  data-row
                  tabIndex={-1}
                  className="focus-visible:outline-accent outline-offset-[-2px] focus-visible:outline-2"
                >
                  <TransactionRow
                    txn={txn}
                    when={formatKickoff(
                      toEat(txn.createdAt).time,
                      t.lang,
                      clock,
                    )}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {history.isFetchNextPageError && (
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
            {t.t("history.moreFailed")}
          </span>
          <button
            ref={retry}
            type="button"
            onClick={more}
            className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
          >
            {t.t("common.retry")}
          </button>
        </div>
      )}

      {history.hasNextPage && !history.isFetchNextPageError && (
        <button
          type="button"
          onClick={more}
          // Announced as busy, never disabled: a disabled button would drop
          // the focus it holds while the next page loads.
          aria-busy={history.isFetchingNextPage}
          aria-disabled={history.isFetchingNextPage}
          className="bg-raised text-text font-body mx-4 mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md text-[13px] font-bold aria-disabled:opacity-60"
        >
          {history.isFetchingNextPage && (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          )}
          {t.t("history.showMore")}
        </button>
      )}
    </div>
  );
}
