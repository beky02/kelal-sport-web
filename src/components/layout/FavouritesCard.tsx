"use client";

import { Star } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Card, CardLabel } from "@/components/ui/Card";
import { Flag } from "@/components/ui/Flag";
import { LiveDot } from "@/components/ui/LiveTag";
import { SidebarLinkRow, RowCount } from "@/components/layout/SidebarRow";
import { routes } from "@/config/routes";
import { formatKickoff } from "@/lib/i18n/format";
import { useUiStore } from "@/stores/ui.store";
import { useSportsbookBoard } from "@/features/sportsbook/hooks/use-sportsbook-board";

/**
 * Pinned leagues and matches.
 *
 * Resolved from the board already in the cache rather than a second request:
 * a favourite is only a pointer, and the data it points at is on screen.
 */
export function FavouritesCard({ live }: { live: boolean }) {
  const t = useTranslation();
  const sections = useSportsbookBoard(live).data ?? [];
  const clock = useUiStore((s) => s.clock);
  const favouriteEvents = useUiStore((s) => s.favouriteEvents);
  const favouriteCompetitions = useUiStore((s) => s.favouriteCompetitions);

  const leagues = sections.filter(
    (s) => favouriteCompetitions[s.competition.id],
  );
  const events = sections.flatMap((section) =>
    section.events
      .filter(({ event }) => favouriteEvents[event.id])
      .map(({ event }) => ({ event, competition: section.competition })),
  );

  return (
    <Card className="p-1.5">
      <CardLabel>
        <Star size={12} className="text-warn" fill="currentColor" aria-hidden />
        {t.t("sidebar.favourites")}
      </CardLabel>

      {leagues.map(({ competition, events: fixtures }) => (
        <SidebarLinkRow
          key={competition.id}
          href={routes.competition(competition.id)}
        >
          <Flag src={competition.region.flag} />
          <span className="flex-1 truncate">{t.pick(competition.name)}</span>
          <RowCount>{fixtures.length}</RowCount>
        </SidebarLinkRow>
      ))}

      {leagues.length > 0 && events.length > 0 && (
        <div className="bg-divider mx-2.5 my-1 h-px" />
      )}

      {events.map(({ event, competition }) => (
        <SidebarLinkRow
          key={event.id}
          href={routes.event(event.id)}
          className="flex-col items-start gap-px py-1.5"
        >
          <span className="max-w-full truncate text-[13px] font-semibold">
            {t.pick(event.home.name)} – {t.pick(event.away.name)}
          </span>
          <span className="text-muted flex items-center gap-1.5 text-[11px]">
            {event.status === "live" && event.score ? (
              <>
                <LiveDot />
                <span className="text-live numeric font-bold">
                  {event.minute} · {event.score.home}–{event.score.away}
                </span>
              </>
            ) : (
              <>
                {formatKickoff(event.kickoff, t.lang, clock)} ·{" "}
                {t.pick(competition.round)}
              </>
            )}
          </span>
        </SidebarLinkRow>
      ))}

      {leagues.length === 0 && events.length === 0 && (
        <p className="text-muted px-2.5 pt-1 pb-2.5 text-xs">
          {t.t("sidebar.favouritesEmpty")}
        </p>
      )}
    </Card>
  );
}
