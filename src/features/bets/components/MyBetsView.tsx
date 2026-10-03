"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, Loader2, Ticket, TriangleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/features/auth/hooks/use-session";
import { useBets } from "../hooks/use-bets";
import type { BetsTab } from "../types";
import { BetCard } from "./BetCard";
import { BetsGuest } from "./BetsGuest";
import { BetTabs } from "./BetTabs";
import { TransactionsList } from "./TransactionsList";

type View = "bets" | "transactions";

/**
 * My bets: the tickets, or the wallet movements behind them.
 *
 * `compact` is the version that sits in the sportsbook's right-hand column, where
 * there is one column of space and no room for the view switch.
 */
export function MyBetsView({
  compact = false,
  initialView = "bets",
}: {
  compact?: boolean;
  initialView?: View;
}) {
  const t = useTranslation();
  const [view, setView] = useState<View>(initialView);
  const [tab, setTab] = useState<BetsTab>("open");
  const session = useSession();
  // While /api/me is pending nobody is a guest, and nothing is asked for.
  const guest = !session.isLoading && session.isGuest;

  return (
    <div className="flex w-full flex-col">
      {!compact && (
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <h2 className="text-2xl">{t.t("bets.title")}</h2>
          <Segmented<View>
            value={view}
            onChange={setView}
            fill="surface"
            options={[
              { value: "bets", label: t.t("bets.viewBets") },
              { value: "transactions", label: t.t("bets.viewTransactions") },
            ]}
          />
        </div>
      )}

      {view === "transactions" ? (
        <TransactionsList />
      ) : guest ? (
        <BetsGuest />
      ) : (
        <>
          <div className={compact ? "" : "mt-3"}>
            <BetTabs value={tab} onChange={setTab} />
          </div>
          <BetList
            // A list per tab: a page asked for under one never lands, or
            // moves focus, under the other.
            key={tab}
            tab={tab}
            enabled={!session.isLoading}
            compact={compact}
          />
        </>
      )}
    </div>
  );
}

/** One tab's tickets, a page at a time. */
function BetList({
  tab,
  enabled,
  compact,
}: {
  tab: BetsTab;
  enabled: boolean;
  compact: boolean;
}) {
  const t = useTranslation();
  const bets = useBets(tab, enabled);
  const items = bets.data?.pages.flatMap((page) => page.items) ?? [];
  const list = useRef<HTMLUListElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  /**
   * Where the page this list's own Show more asked for begins, until it lands
   * or fails — the only time focus is moved. A list that mounts on a state
   * left by an earlier tap takes no one's focus.
   */
  const firstNew = useRef<number | null>(null);

  // Show more goes away with the last page, or gives way to "couldn't load
  // more": either way the focus it held must land somewhere useful, not on
  // <body> — the first new ticket, or the way to try again.
  useEffect(() => {
    const at = firstNew.current;
    if (at === null || items.length <= at) return;
    firstNew.current = null;
    list.current?.querySelectorAll<HTMLElement>(":scope > li a")[at]?.focus();
  }, [items.length]);
  useEffect(() => {
    if (!bets.isFetchNextPageError || firstNew.current === null) return;
    firstNew.current = null;
    retry.current?.focus();
  }, [bets.isFetchNextPageError]);

  // Laid out as the tickets will be, so nothing jumps when they land.
  const layout = compact
    ? "flex flex-col"
    : // Two across where there is room: a ticket is tall, and a single
      // column of them scrolls forever on a desktop.
      "grid items-start xl:grid-cols-2";

  if (bets.isPending) {
    return (
      <div
        className={cn(
          "gap-3",
          layout,
          compact ? "p-3 pb-6" : "px-4 pt-3.5 pb-6",
        )}
      >
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!bets.data) {
    return (
      <StateMessage
        icon={<TriangleAlert size={24} strokeWidth={1.5} />}
        title={t.t("bets.loadFailedTitle")}
        body={t.t("bets.loadFailedBody")}
        action={{
          label: t.t("common.retry"),
          onClick: () => void bets.refetch(),
        }}
      />
    );
  }

  if (items.length === 0) {
    return tab === "open" ? (
      <StateMessage
        icon={<Ticket size={26} strokeWidth={1.5} />}
        title={t.t("bets.emptyOpenTitle")}
        body={t.t("bets.emptyBody")}
        action={{ label: t.t("bets.browseMatches"), href: routes.home }}
      />
    ) : (
      <StateMessage
        icon={<Ticket size={26} strokeWidth={1.5} />}
        title={t.t("bets.emptySettledTitle")}
        body={t.t("bets.emptySettledBody")}
      />
    );
  }

  const more = () => {
    // A second tap while the page loads asks for nothing more.
    if (bets.isFetchingNextPage) return;
    firstNew.current = items.length;
    void bets.fetchNextPage();
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        compact ? "p-3 pb-6" : "px-4 pt-3.5 pb-6",
      )}
    >
      <ul ref={list} className={cn("gap-3", layout)}>
        {items.map((bet) => (
          <li key={bet.id}>
            <BetCard bet={bet} />
          </li>
        ))}
      </ul>

      {bets.isFetchNextPageError && (
        <div
          role="alert"
          className="bg-loss-bg flex items-center gap-2.5 rounded-md p-3"
        >
          <CircleAlert
            size={17}
            strokeWidth={1.5}
            aria-hidden
            className="text-loss shrink-0"
          />
          <span className="min-w-0 flex-1 text-xs font-semibold">
            {t.t("bets.moreFailed")}
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

      {bets.hasNextPage && !bets.isFetchNextPageError && (
        <button
          type="button"
          onClick={more}
          // Announced as busy, never disabled: a disabled button would drop
          // the focus it holds while the next page loads.
          aria-busy={bets.isFetchingNextPage}
          aria-disabled={bets.isFetchingNextPage}
          className="bg-raised text-text font-body flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md text-[13px] font-bold aria-disabled:opacity-60"
        >
          {bets.isFetchingNextPage && (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          )}
          {t.t("bets.showMore")}
        </button>
      )}
    </div>
  );
}
