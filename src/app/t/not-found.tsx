import type { Metadata } from "next";
import { headers } from "next/headers";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { TicketCheckForm } from "@/features/tickets/components/TicketCheckForm";
import { TicketNotFound } from "@/features/tickets/components/TicketNotFound";
import { ticketNotFoundMetadata } from "@/features/tickets/lib/metadata";
import { tenantFromHeaders } from "@/lib/server/config";
import { loadPageLocale } from "@/lib/server/public-config";

/** The 404's title and card, in the tenant's language, for a link preview. */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = tenantFromHeaders(await headers());
  return ticketNotFoundMetadata(await loadPageLocale(tenant));
}

/**
 * The ticket check's 404, for the whole `/t` subtree. Two ways in:
 *
 * - A ticket number no ticket has: `/t/[ticket]` throws `notFound()`, which
 *   Next 16 sends as an empty document for the browser to fill in, so this
 *   body needs JavaScript (a known limitation, F5b verification). Its title
 *   and card still reach a link preview, from `generateMetadata` here.
 * - An address with no ticket number in it: the proxy renders `/t?missing=1`
 *   whole with a 404 status, and a 404's head comes from here too.
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
