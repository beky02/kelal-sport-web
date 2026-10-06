"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { Card, CardLabel } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import { Skeleton } from "@/components/ui/Skeleton";
import { SidebarLinkRow, RowCount } from "@/components/layout/SidebarRow";
import { useSportsbookChrome } from "@/features/sportsbook/chrome";
import { useTopCompetitions } from "@/features/competitions/hooks/use-competitions";

export function TopCompetitionsCard() {
  const t = useTranslation();
  const { links } = useSportsbookChrome();
  const { data, isPending } = useTopCompetitions();

  return (
    <Card className="p-1.5">
      <CardLabel>{t.t("sidebar.topCompetitions")}</CardLabel>

      {isPending
        ? Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex h-9 items-center gap-2.5 px-2.5">
              <Skeleton className="h-3.5 w-5" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))
        : data?.map((competition) => (
            <SidebarLinkRow
              key={competition.id}
              href={links.competition(competition.id)}
            >
              <Flag src={competition.flag} />
              <span className="flex-1 truncate">
                {t.pick(competition.name)}
              </span>
              <RowCount>{competition.eventCount}</RowCount>
            </SidebarLinkRow>
          ))}
    </Card>
  );
}
