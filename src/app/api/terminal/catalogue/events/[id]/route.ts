import { loadEvent } from "@/lib/server/catalogue";
import { respond } from "@/lib/server/respond";
import {
  activeTerminal,
  eventQuery,
  preMatchEvent,
  refusal,
} from "@/lib/server/terminal";

/**
 * A match's whole book on the kiosk (its match page, as the player's): the
 * player's loader, read anonymously (F8ca decision 2), for an activated
 * terminal only. A match that has kicked off has no book here — the kiosk
 * sells before kick-off only (D8) — so it reads as one that doesn't exist:
 * `null`, which the page has a state for.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/terminal/catalogue/events/[id]">,
) {
  const terminal = activeTerminal(request);
  if (terminal instanceof Response) return terminal;
  const { id } = await ctx.params;
  const query = eventQuery(id, new URL(request.url).searchParams);
  if ("field" in query) {
    return refusal("This match is not one the terminal asks for", [query]);
  }
  return respond(request, async ({ tenant }) =>
    preMatchEvent(await loadEvent(tenant, query.id, false)),
  );
}
