import "server-only";
import type { TicketCheck, TicketLookup } from "@/features/tickets/types";
import { toTicketCheck } from "@/lib/api/mappers/tickets";
import { ticketCheckSchema } from "@/lib/api/schemas";
import { UpstreamError, both, unwrap, upstream } from "./upstream";

/** The codes the contract's `NotFound` gives a ticket that doesn't exist. */
const NOT_FOUND = new Set(["NOT_FOUND", "RETAIL_TICKET_NOT_FOUND"]);

/**
 * The public, anonymised ticket check (`GET /v1/tickets/{ticket_id}`), for the
 * `/t/{ticket}` page. No session: anyone holding a number may check it. Names
 * in both languages; the answer is checked before the page renders it.
 */
export async function checkTicket(
  tenant: string,
  ticketId: string,
  prefer?: string,
): Promise<TicketCheck> {
  const pair = await both(async (lang) =>
    unwrap(
      await upstream("Bookings", { tenant, lang, prefer }).GET(
        "/v1/tickets/{ticket_id}",
        { params: { path: { ticket_id: ticketId } } },
      ),
    ),
  );
  return ticketCheckSchema.parse(toTicketCheck(pair));
}

/**
 * A ticket for the page, which has a state for every outcome. Only the
 * contract's not-found codes mean there is no such ticket; anything else — an
 * API that failed or can't be reached, a 404 without one of those codes, an
 * answer that isn't a ticket — is a failure, said as one.
 */
export async function lookupTicket(
  tenant: string,
  ticketId: string,
  prefer?: string,
): Promise<TicketLookup> {
  try {
    return {
      status: "ok",
      ticket: await checkTicket(tenant, ticketId, prefer),
    };
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) {
      const code = (error.problem as { code?: unknown } | null)?.code;
      if (typeof code === "string" && NOT_FOUND.has(code)) {
        return { status: "not_found", ticketId };
      }
    }
    console.error(error);
    return { status: "failed", ticketId };
  }
}
