"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StarButton } from "@/components/ui/StarButton";
import { cn } from "@/lib/utils/cn";
import { OddsButton } from "@/features/odds/components/OddsButton";
import { OddsGroup } from "@/features/odds/components/OddsGroup";
import { NoPrices } from "@/features/odds/components/NoPrices";
import { useEventHasSelection } from "@/features/bet-slip/stores/bet-slip.store";
import type { Competition } from "@/features/competitions/types";
import type { BoardEvent } from "@/features/events/types";
import { useSportsbookChrome, type Pin } from "../chrome";
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
  const { matchResult, doubleChance, totalGoals } = markets;
  const t = useTranslation();

  const { favourites, links } = useSportsbookChrome();
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
        {/* Only where there are favourites (not on a shop kiosk). */}
        {favourites && (
          <FavouriteStar usePin={() => favourites.useEvent(event.id)} />
        )}
        <Link
          href={links.event(event.id)}
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
            {matchResult ? (
              matchResult.outcomes.map((outcome) => (
                <OddsButton
                  key={outcome.id}
                  market={matchResult}
                  outcome={outcome}
                  eventName={eventName}
                  size="sm"
                />
              ))
            ) : (
              <NoPrices />
            )}
          </OddsGroup>

          <OddsGroup className={HIDE_BELOW_XL}>
            {doubleChance ? (
              doubleChance.outcomes.map((outcome) => (
                <OddsButton
                  key={outcome.id}
                  market={doubleChance}
                  outcome={outcome}
                  eventName={eventName}
                  size="sm"
                />
              ))
            ) : (
              <NoPrices />
            )}
          </OddsGroup>

          {/* Over · line · Under, with the goal line in the middle track so the
              two prices sit under the O and U captions in the header. */}
          <OddsGroup className={HIDE_BELOW_XL}>
            {totalGoals && totalGoals.outcomes.length === 2 ? (
              <>
                <OddsButton
                  market={totalGoals}
                  outcome={totalGoals.outcomes[0]}
                  eventName={eventName}
                  size="sm"
                />
                <span className="text-muted numeric text-center text-xs font-bold">
                  {totalGoals.line}
                </span>
                <OddsButton
                  market={totalGoals}
                  outcome={totalGoals.outcomes[1]}
                  eventName={eventName}
                  size="sm"
                />
              </>
            ) : (
              <NoPrices />
            )}
          </OddsGroup>
        </>
      )}

      <MoreMarketsLink eventId={event.id} marketCount={event.marketCount} />
    </div>
  );
}

/** A match's star: pinned or not, from the site's favourites. */
function FavouriteStar({ usePin }: { usePin: () => Pin }) {
  const t = useTranslation();
  const [pinned, toggle] = usePin();
  return (
    <StarButton
      pinned={pinned}
      label={t.t("sidebar.addFavourite")}
      onClick={toggle}
    />
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
