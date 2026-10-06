"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { LiveTag } from "@/components/ui/LiveTag";
import { formatKickoff } from "@/lib/i18n/format";
import { formatShortDate } from "@/lib/i18n/dates";
import { useLocale } from "@/lib/i18n/locale";
import type { Competition } from "@/features/competitions/types";
import type { SportEvent } from "@/features/events/types";

/**
 * The line under a fixture: whether it is live and for how long, or when it
 * starts, plus which round it belongs to.
 */
export function EventMeta({
  event,
  competition,
}: {
  event: SportEvent;
  competition: Competition;
}) {
  const t = useTranslation();
  const { clock, calendar } = useLocale();

  const live = event.status === "live";
  const round = t.pick(competition.round);

  return (
    // Wraps rather than truncating: "Starts in 12 min" does not fit beside a
    // date in the team column, and the countdown is the part worth reading.
    <span className="text-muted flex flex-wrap items-center gap-x-1.5 text-[11px] whitespace-nowrap">
      {live && (
        <>
          <LiveTag label={t.t("board.live")} />
          <span className="text-live numeric font-bold">{event.minute}</span>
        </>
      )}

      {event.status === "starting_soon" && event.startsInMinutes !== null && (
        <span className="text-text font-bold">
          {t.t("board.startsIn", { n: event.startsInMinutes })}
        </span>
      )}

      <span className="max-w-full truncate">
        {live
          ? round
          : [
              formatShortDate(event.startDate, calendar),
              formatKickoff(event.kickoff, t.lang, clock),
              round,
            ]
              .filter(Boolean)
              .join(" · ")}
      </span>
    </span>
  );
}
