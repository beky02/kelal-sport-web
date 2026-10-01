"use client";

import { memo } from "react";
import { Card } from "@/components/ui/Card";
import { useUiStore } from "@/stores/ui.store";
import type { BoardSection } from "@/lib/api/mock/repository";
import { MarketColumnHeaders } from "./MarketColumnHeaders";
import { EventRow } from "./EventRow";

function CompetitionSectionImpl({ section }: { section: BoardSection }) {
  const { competition, events } = section;

  const pinned = useUiStore(
    (s) => s.favouriteCompetitions[competition.id] === true,
  );
  const togglePin = useUiStore((s) => s.toggleFavouriteCompetition);

  return (
    <Card className="overflow-hidden">
      <MarketColumnHeaders
        competition={competition}
        pinned={pinned}
        onTogglePin={() => togglePin(competition.id)}
      />
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

/** One competition's card: its header, then its fixtures. */
export const CompetitionSection = memo(CompetitionSectionImpl);
