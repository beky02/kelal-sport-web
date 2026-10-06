import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/routes";
import { TicketCheckForm } from "@/features/tickets/components/TicketCheckForm";
import { TicketCheckView } from "@/features/tickets/components/TicketCheckView";
import { TicketUnavailable } from "@/features/tickets/components/TicketUnavailable";
import { ticketMetadata } from "@/features/tickets/lib/metadata";
import {
  decodeSegment,
  normaliseTicketNumber,
} from "@/features/tickets/lib/number";
import { publicOrigin, tenantFromHeaders } from "@/lib/server/config";
import { loadPageLocale } from "@/lib/server/public-config";
import { lookupTicket } from "@/lib/server/tickets";
import { mockPreference } from "@/lib/server/upstream";

/**
 * The tenant, its page locale and the ticket: once per request, shared by the
 * metadata and the page (`cache`).
 */
const lookup = cache(async (ticketId: string) => {
  const h = await headers();
  const tenant = tenantFromHeaders(h);
  const [locale, ticket] = await Promise.all([
    loadPageLocale(tenant),
    lookupTicket(tenant, ticketId, mockPreference(h.get("prefer"))),
  ]);
  return {
    ticket,
    locale,
    url: `${publicOrigin(h, tenant)}${routes.ticket(ticketId)}`,
  };
});

/** The number in the address, canonical, or null when it is no ticket number. */
const numberIn = (segment: string) =>
  normaliseTicketNumber(decodeSegment(segment));

/**
 * Open Graph tags for a shared ticket, in `<head>` for Telegram's preview bot
 * (its user agent matches Next's HTML-limited bots, as on `/b`) —
 * `tests/e2e/ticket.spec.ts` guards that.
 */
export async function generateMetadata({
  params,
}: PageProps<"/t/[ticket]">): Promise<Metadata> {
  const raw = (await params).ticket;
  const ticketId = numberIn(raw);
  // A malformed or non-canonical address answers 404 or a redirect: nothing
  // to describe, and nothing worth an upstream call.
  if (!ticketId || ticketId !== raw) {
    return { robots: { index: false, follow: false } };
  }
  const { ticket, locale, url } = await lookup(ticketId);
  return ticketMetadata(ticket, { ...locale, url });
}

/**
 * `/t/{ticket}` — the public ticket check D7 fixes, shared from the app and
 * Telegram. Server-rendered: it works without JavaScript (C18 §9).
 * Unprefixed until F2a adds `/{lang}`, then it redirects (FD3).
 *
 * No `<Suspense>` around the shell, unlike other pages: a boundary that
 * suspends during the server render (a client module still loading, say)
 * streams its content hidden, for a script to reveal — never, without
 * JavaScript. With none, the server sends the page whole. The page is dynamic
 * (it reads the request), so nothing needs the boundary.
 */
export default async function TicketPage({ params }: PageProps<"/t/[ticket]">) {
  const raw = (await params).ticket;
  const ticketId = numberIn(raw);
  if (!ticketId) notFound();
  // One address per ticket: `/t/k7q2m9xpm` is `/t/K7Q2-M9XP-M`.
  if (ticketId !== raw) redirect(routes.ticket(ticketId));

  const { ticket } = await lookup(ticketId);
  if (ticket.status === "not_found") notFound();

  return (
    <SportsbookShell>
      <Card className="divide-divider flex flex-col divide-y overflow-hidden">
        {ticket.status === "ok" ? (
          <TicketCheckView ticket={ticket.ticket} />
        ) : (
          <TicketUnavailable status="failed" ticketId={ticketId} />
        )}
        <TicketCheckForm variant="another" />
      </Card>
    </SportsbookShell>
  );
}
