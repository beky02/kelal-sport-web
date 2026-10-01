"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import { useBets } from "../hooks/use-bets";
import type { BetsTab } from "../types";
import { BetCard } from "./BetCard";
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
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [tab, setTab] = useState<BetsTab>("open");
  const { data, isPending } = useBets(tab);

  const bets = data?.bets ?? [];
  const counts = data?.counts ?? { open: 0, settled: 0, won: 0, lost: 0 };

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
      ) : (
        <>
          <div className={compact ? "" : "mt-3"}>
            <BetTabs value={tab} counts={counts} onChange={setTab} />
          </div>

          {isPending ? (
            <div className="flex flex-col gap-3 p-3.5">
              {Array.from({ length: 2 }, (_, i) => (
                <Skeleton key={i} className="h-44 rounded-lg" />
              ))}
            </div>
          ) : bets.length === 0 ? (
            <StateMessage
              icon={<Ticket size={26} strokeWidth={1.5} />}
              title={t.t("bets.emptyTitle")}
              body={t.t("bets.emptyBody")}
              action={{
                label: t.t("bets.browseMatches"),
                onClick: () => router.push(routes.home),
              }}
            />
          ) : (
            <div
              className={cn(
                "gap-3",
                compact
                  ? "flex flex-col p-3 pb-6"
                  : // Two across where there is room: a ticket is tall, and a
                    // single column of them scrolls forever on a desktop.
                    "grid items-start px-4 pt-3.5 pb-6 xl:grid-cols-2",
              )}
            >
              {bets.map((bet) => (
                <BetCard key={bet.id} bet={bet} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
