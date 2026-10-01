"use client";

import { CalendarX2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { MarketList } from "@/features/markets/components/MarketList";
import { useUiStore } from "@/stores/ui.store";
import { useRealtimeTopics } from "@/lib/websocket/RealtimeProvider";
import { topics } from "@/lib/websocket/messages";
import { useEvent } from "../hooks/use-board";
import { EventHeader } from "./EventHeader";

/** A fixture and its full book. */
export function EventDetailView({ eventId }: { eventId: string }) {
  const t = useTranslation();
  const dataSaver = useUiStore((s) => s.dataSaver);
  const { data, isPending } = useEvent(eventId, dataSaver);

  // Subscribe while this fixture is open; the release drops it on leaving.
  useRealtimeTopics([topics.event(eventId)]);

  if (isPending) {
    return (
      <SportsbookShell>
        <Card className="flex flex-col gap-3 p-3">
          <Skeleton className="h-3 w-52" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-56" />
        </Card>
      </SportsbookShell>
    );
  }

  if (!data) {
    return (
      <SportsbookShell>
        <Card>
          <StateMessage
            icon={<CalendarX2 size={24} strokeWidth={1.5} />}
            title={t.t("event.notFound")}
            body={t.t("event.notFoundBody")}
          />
        </Card>
      </SportsbookShell>
    );
  }

  const eventName = {
    en: `${data.event.home.name.en} – ${data.event.away.name.en}`,
    am: `${data.event.home.name.am} – ${data.event.away.name.am}`,
  };

  return (
    <SportsbookShell>
      <EventHeader event={data.event} competition={data.competition} />
      <MarketList eventId={eventId} eventName={eventName} />
    </SportsbookShell>
  );
}
