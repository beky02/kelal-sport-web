"use client";

import { memo } from "react";
import { Card } from "@/components/ui/Card";
import type { BoardSection } from "@/features/events/types";
import { useSportsbookChrome } from "../chrome";
import { MarketColumnHeaders } from "./MarketColumnHeaders";
import { EventRow } from "./EventRow";

function CompetitionSectionImpl({ section }: { section: BoardSection }) {
  const { competition, events } = section;
  const { favourites } = useSportsbookChrome();

  return (
    <Card className="overflow-hidden">
      {/* A pin only where there are favourites (not on a shop kiosk). */}
      {favourites ? (
        <PinnableHeaders competition={competition} />
      ) : (
        <MarketColumnHeaders competition={competition} />
      )}
      {events.map((boardEvent) => (
        <EventRow
          key={boardEvent.event.id}
          boardEvent={boardEvent}
          competition={competition}
        />
      ))}
    </Card>
  );
}

/** The headers with the competition's star, where the site has favourites. */
function PinnableHeaders({
  competition,
}: {
  competition: BoardSection["competition"];
}) {
  const { favourites } = useSportsbookChrome();
  const { useCompetition: usePinnedCompetition } = favourites!;
  const [pinned, toggle] = usePinnedCompetition(competition.id);
  return (
    <MarketColumnHeaders competition={competition} pin={{ pinned, toggle }} />
  );
}

/** One competition's card: its header, then its fixtures. */
export const CompetitionSection = memo(CompetitionSectionImpl);
