import { Suspense } from "react";
import { EventDetailView } from "@/features/events/components/EventDetailView";

export default async function EventPage({
  params,
}: PageProps<"/event/[eventId]">) {
  const { eventId } = await params;

  return (
    <Suspense>
      <EventDetailView eventId={eventId} />
    </Suspense>
  );
}
