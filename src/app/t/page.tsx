import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/routes";
import { TicketCheckForm } from "@/features/tickets/components/TicketCheckForm";
import { TicketUnavailable } from "@/features/tickets/components/TicketUnavailable";
import { ticketNotFoundMetadata } from "@/features/tickets/lib/metadata";
import { normaliseTicketNumber } from "@/features/tickets/lib/number";
import { translate } from "@/lib/i18n";
import { tenantFromHeaders } from "@/lib/server/config";
import { loadPageLocale } from "@/lib/server/public-config";

/** Longer than any number typed with spaces and hyphens; longer is not one. */
const MAX_TYPED = 32;

export async function generateMetadata({
  searchParams,
}: PageProps<"/t">): Promise<Metadata> {
  const locale = await loadPageLocale(tenantFromHeaders(await headers()));
  if ((await searchParams).missing !== undefined) {
    return ticketNotFoundMetadata(locale);
  }
  const title = translate(locale.lang, "ticket.checkTitle");
  return { title: locale.siteName ? `${title} · ${locale.siteName}` : title };
}

/**
 * `/t` — check a ticket by its number. The form is a plain GET back to this
 * page (C18 §9: no JavaScript needed): a ticket number goes on to its own
 * address, anything else gets the form again with what a number looks like.
 * No `<Suspense>`, so the page arrives whole without JavaScript (see
 * `/t/[ticket]`).
 */
export default async function TicketCheckPage({
  searchParams,
}: PageProps<"/t">) {
  const query = await searchParams;

  // `/t/{x}` with no ticket number in it, rewritten here by the proxy with
  // its 404 status (`src/proxy.ts`): the ticket's own 404, rendered whole.
  if (query.missing !== undefined) {
    return (
      <SportsbookShell>
        <Card className="divide-divider flex flex-col divide-y overflow-hidden">
          <TicketUnavailable status="not_found" ticketId={null} />
          <TicketCheckForm variant="another" />
        </Card>
      </SportsbookShell>
    );
  }

  const value = query.ticket;
  const typed = Array.isArray(value) ? value[0] : value;
  const entered = typed !== undefined && typed.trim() !== "";
  if (entered) {
    const ticketId =
      typed.length <= MAX_TYPED ? normaliseTicketNumber(typed) : null;
    if (ticketId) redirect(routes.ticket(ticketId));
  }

  return (
    <SportsbookShell>
      <Card className="overflow-hidden">
        <TicketCheckForm variant="start" invalid={entered} />
      </Card>
    </SportsbookShell>
  );
}
