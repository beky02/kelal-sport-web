import { Suspense } from "react";
import { EventDetailView } from "@/features/events/components/EventDetailView";

/**
 * A match on the kiosk (F8ca): the player's match page with every market, in
 * the kiosk's chrome — before kick-off only (the terminal's route answers a
 * match in play as one that doesn't exist).
 */
export default async function TerminalEventPage({
  params,
}: PageProps<"/terminal/event/[eventId]">) {
  const { eventId } = await params;
  return (
    <Suspense>
      <EventDetailView eventId={eventId} />
    </Suspense>
  );
}
