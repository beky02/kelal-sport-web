import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { TicketCheckForm } from "@/features/tickets/components/TicketCheckForm";
import { TicketNotFound } from "@/features/tickets/components/TicketNotFound";

/**
 * `/t/{ticket}` for a number no ticket has (404), in the ticket's own words —
 * whole without JavaScript, so no `<Suspense>` (see the page).
 */
export default function TicketNotFoundPage() {
  return (
    <SportsbookShell>
      <Card className="divide-divider flex flex-col divide-y overflow-hidden">
        <TicketNotFound />
        <TicketCheckForm variant="another" />
      </Card>
    </SportsbookShell>
  );
}
