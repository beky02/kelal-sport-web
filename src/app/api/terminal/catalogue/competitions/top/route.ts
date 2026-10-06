import { loadTopCompetitions } from "@/lib/server/catalogue";
import { respond } from "@/lib/server/respond";
import { activeTerminal } from "@/lib/server/terminal";

/**
 * The kiosk's top competitions (its sidebar, as the player's): the player's
 * loader, read anonymously (F8ca decision 2), for an activated terminal only.
 */
export function GET(request: Request) {
  const terminal = activeTerminal(request);
  if (terminal instanceof Response) return terminal;
  return respond(request, ({ tenant }) => loadTopCompetitions(tenant));
}
