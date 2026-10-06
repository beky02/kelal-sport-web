"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Card } from "@/components/ui/Card";
import { LiveTag } from "@/components/ui/LiveTag";
import { TeamCrest } from "@/components/ui/TeamCrest";
import { useSportsbookChrome } from "@/features/sportsbook/chrome";
import { formatKickoff } from "@/lib/i18n/format";
import { formatShortDate } from "@/lib/i18n/dates";
import { useLocale } from "@/lib/i18n/locale";
import type { Competition } from "@/features/competitions/types";
import type { SportEvent } from "../types";

/** The fixture at the top of its own page: who, where in the season, and when. */
export function EventHeader({
  event,
  competition,
}: {
  event: SportEvent;
  competition: Competition;
}) {
  const t = useTranslation();
  const { clock, calendar } = useLocale();
  const { links } = useSportsbookChrome();
  const live = event.status === "live";

  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="text-muted flex items-center gap-2 text-[11px]">
        <Link
          href={links.home}
          className="text-muted hover:text-text flex items-center gap-0.5 no-underline"
        >
          <ChevronLeft size={14} strokeWidth={2} aria-hidden />
          {t.t("event.backToBoard")}
        </Link>
        <span>·</span>
        <span className="truncate">
          {/* The round is dropped where the API has none to give. */}
          {[
            t.pick(competition.region.name),
            t.pick(competition.name),
            t.pick(competition.round),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {[event.home, event.away].map((team, index) => (
            <span key={team.id} className="flex items-center gap-2.5">
              <TeamCrest crest={team.crest} size={22} />
              <span className="flex-1 truncate text-[15px] font-bold">
                {t.pick(team.name)}
              </span>
              {event.score && (
                <span className="bg-raised numeric min-w-7 rounded-md py-0.5 text-center text-[15px] font-extrabold">
                  {index === 0 ? event.score.home : event.score.away}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="text-muted flex items-center gap-2 text-[11px]">
        {live ? (
          <>
            <LiveTag label={t.t("board.live")} />
            <span className="text-live numeric font-bold">{event.minute}</span>
          </>
        ) : (
          <span>
            {formatShortDate(event.startDate, calendar)} ·{" "}
            {formatKickoff(event.kickoff, t.lang, clock)} ·{" "}
            {t.t(clock === "eth" ? "clock.ethiopian" : "clock.eat")}
          </span>
        )}
      </div>
    </Card>
  );
}
