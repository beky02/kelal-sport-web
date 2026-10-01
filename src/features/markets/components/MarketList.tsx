"use client";

import { useMemo, useState } from "react";
import { Ticket } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMarkets } from "../hooks/use-markets";
import type { MarketCategory } from "../types";
import type { Localized } from "@/types/common";
import { MarketGroupCard } from "./MarketCard";

type Tab = "all" | MarketCategory;

/**
 * Every market on a fixture, filtered by category.
 *
 * Markets of one template are grouped into a single card — five over/under lines
 * read as one market with five lines, which is what they are, rather than five
 * unrelated cards.
 */
export function MarketList({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: Localized;
}) {
  const t = useTranslation();
  const [tab, setTab] = useState<Tab>("all");
  const {
    data: markets,
    groups: marketGroups,
    isPending,
  } = useMarkets(eventId);

  const groups = useMemo(() => {
    const visible = (markets ?? []).filter(
      (m) => tab === "all" || m.category === tab,
    );
    // One card per template: five total-goals lines are one market.
    const byTemplate = new Map<string, typeof visible>();
    for (const market of visible) {
      byTemplate.set(market.templateId, [
        ...(byTemplate.get(market.templateId) ?? []),
        market,
      ]);
    }
    return [...byTemplate.values()];
  }, [markets, tab]);

  if (isPending) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="flex flex-col gap-2.5 p-3">
            <Skeleton className="h-4 w-36" />
            <div className="grid grid-cols-3 gap-1.5">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!markets || markets.length === 0) {
    return (
      <Card>
        <StateMessage
          icon={<Ticket size={24} strokeWidth={1.5} />}
          title={t.t("event.noMarkets")}
          body={t.t("event.noMarketsBody")}
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        size="sm"
        fill="surface"
        className="self-start"
        // The book's own groups for this fixture, named by the dictionary.
        options={[
          { value: "all", label: t.t("event.allMarkets") },
          ...marketGroups.map((group) => ({
            value: group.code,
            label: t.pick(group.name),
          })),
        ]}
      />

      {groups.map((group) => (
        <MarketGroupCard
          key={group[0].templateId}
          title={t.pick(group[0].title)}
          markets={group}
          eventName={eventName}
        />
      ))}
    </div>
  );
}
