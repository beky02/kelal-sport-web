"use client";

import { memo } from "react";
import { Card } from "@/components/ui/Card";
import type { BoardSection } from "@/features/events/types";
import { useSportsbookChrome, type Pin } from "../chrome";
import { MarketColumnHeaders } from "./MarketColumnHeaders";
import { EventRow } from "./EventRow";

function CompetitionSectionImpl({ section }: { section: BoardSection }) {
  const { competition, events } = section;
  const { favourites } = useSportsbookChrome();

  return (
    <Card className="overflow-hidden">
      {/* A pin only where there are favourites (not on a shop kiosk). */}
      {favourites ? (
        <PinnableHeaders
          competition={competition}
          usePin={() => favourites.useCompetition(competition.id)}
        />
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

function PinnableHeaders({
  competition,
  usePin,
}: {
  competition: BoardSection["competition"];
  usePin: () => Pin;
}) {
  const [pinned, toggle] = usePin();
  return (
    <MarketColumnHeaders competition={competition} pin={{ pinned, toggle }} />
  );
}

/** One competition's card: its header, then its fixtures. */
export const CompetitionSection = memo(CompetitionSectionImpl);
