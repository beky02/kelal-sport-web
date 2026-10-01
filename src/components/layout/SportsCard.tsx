"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { Card, CardLabel } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { SportIcon } from "@/components/ui/SportIcon";
import { SidebarRow, RowCount } from "@/components/layout/SidebarRow";
import { useSports } from "@/features/sports/hooks/use-sports";

/**
 * The sport switcher.
 *
 * Shows in-play counts on the live board and the full card elsewhere, so the
 * number beside a sport always answers "how many can I bet on right now?".
 */
export function SportsCard({
  activeSlug,
  live,
  onSelect,
}: {
  activeSlug: string;
  live: boolean;
  onSelect: (slug: string) => void;
}) {
  const t = useTranslation();
  const { data: sports, isPending } = useSports();

  return (
    <Card className="p-1.5">
      <CardLabel>{t.t("sidebar.sports")}</CardLabel>

      {isPending
        ? Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex h-9 items-center gap-2.5 px-2.5">
              <Skeleton className="size-4" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))
        : sports?.map((sport) => (
            <SidebarRow
              key={sport.id}
              active={sport.slug === activeSlug}
              onClick={() => onSelect(sport.slug)}
              className="justify-between"
            >
              <span className="flex items-center gap-2.5">
                <SportIcon paths={sport.iconPaths} className="text-muted" />
                {t.pick(sport.name)}
              </span>
              <RowCount>{live ? sport.liveCount : sport.eventCount}</RowCount>
            </SidebarRow>
          ))}
    </Card>
  );
}
