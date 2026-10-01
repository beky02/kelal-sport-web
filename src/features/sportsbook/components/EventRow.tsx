"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StarButton } from "@/components/ui/StarButton";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import { OddsButton } from "@/features/odds/components/OddsButton";
import { OddsGroup } from "@/features/odds/components/OddsGroup";
import { useEventHasSelection } from "@/features/bet-slip/stores/bet-slip.store";
import { useUiStore } from "@/stores/ui.store";
import type { Competition } from "@/features/competitions/types";
import type { BoardEvent } from "@/lib/api/mock/repository";
import { BOARD_GRID, HIDE_BELOW_XL } from "../lib/grid";
import { EventMeta } from "./EventMeta";
import { SuspendedBanner } from "./SuspendedBanner";
import { MoreMarketsLink } from "./MoreMarketsLink";
import { TeamLine } from "./TeamLine";

/**
 * One fixture on the board.
 *
 * Assembled from parts rather than driven by a wall of props, so each piece can
 * change on its own: an odds button re-renders when its price moves without
 * touching the team names beside it.
 */
function EventRowImpl({
  boardEvent,
  competition,
}: {
  boardEvent: BoardEvent;
  competition: Competition;
}) {
  const { event, markets } = boardEvent;
  const t = useTranslation();

  const pinned = useUiStore((s) => s.favouriteEvents[event.id] === true);
  const togglePin = useUiStore((s) => s.toggleFavouriteEvent);
  // Tints the whole row while anything from this match is in the slip.
  const inSlip = useEventHasSelection(event.id);

  // Stable, because it is a prop of every odds button below.
  const eventName = useMemo(
    () => ({
      en: `${event.home.name.en} – ${event.away.name.en}`,
      am: `${event.home.name.am} – ${event.away.name.am}`,
    }),
    [event.home.name, event.away.name],
  );

  return (
    <div
      className={cn(
        BOARD_GRID,
        "border-divider min-h-[68px] items-stretch border-t",
        inSlip && "bg-sel-row",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 py-1.5 pr-2 pl-1">
        <StarButton
          pinned={pinned}
          label={t.t("sidebar.addFavourite")}
          onClick={() => togglePin(event.id)}
        />
        <Link
          href={routes.event(event.id)}
          className="text-text flex min-w-0 flex-1 flex-col gap-[3px] no-underline"
        >
          <TeamLine
            team={event.home}
            name={t.pick(event.home.name)}
            score={event.score?.home ?? null}
          />
          <TeamLine
            team={event.away}
            name={t.pick(event.away.name)}
            score={event.score?.away ?? null}
          />
          <EventMeta event={event} competition={competition} />
        </Link>
      </div>

      {event.suspended ? (
        <SuspendedBanner />
      ) : (
        <>
          <OddsGroup className="border-t-0 border-l-0 pb-2 md:border-l md:pb-0">
            {markets.matchResult.outcomes.map((outcome) => (
              <OddsButton
                key={outcome.code}
                market={markets.matchResult}
                outcome={outcome}
                eventName={eventName}
                size="sm"
              />
            ))}
          </OddsGroup>

          <OddsGroup className={HIDE_BELOW_XL}>
            {markets.doubleChance.outcomes.map((outcome) => (
              <OddsButton
                key={outcome.code}
                market={markets.doubleChance}
                outcome={outcome}
                eventName={eventName}
                size="sm"
              />
            ))}
          </OddsGroup>

          {/* Over · line · Under, with the goal line in the middle track so the
              two prices sit under the O and U captions in the header. */}
          <OddsGroup className={HIDE_BELOW_XL}>
            <OddsButton
              market={markets.totalGoals}
              outcome={markets.totalGoals.outcomes[0]}
              eventName={eventName}
              size="sm"
            />
            <span className="text-muted numeric text-center text-xs font-bold">
              {markets.totalGoals.line}
            </span>
            <OddsButton
              market={markets.totalGoals}
              outcome={markets.totalGoals.outcomes[1]}
              eventName={eventName}
              size="sm"
            />
          </OddsGroup>
        </>
      )}

      <MoreMarketsLink eventId={event.id} marketCount={event.marketCount} />
    </div>
  );
}

/**
 * Memoised on purpose.
 *
 * Realtime updates rebuild only the row they touch and return every other row by
 * reference (see `applyToBoard`), so this turns one price moving into one row
 * re-rendering instead of the whole board.
 */
export const EventRow = memo(EventRowImpl);
