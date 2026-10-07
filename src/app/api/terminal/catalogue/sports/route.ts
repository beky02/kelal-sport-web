import { loadSports } from "@/lib/server/catalogue";
import { respond } from "@/lib/server/respond";
import { activeTerminal } from "@/lib/server/terminal";

/**
 * The kiosk's sport tabs (F8ca): the player's loader, read anonymously
 * (F8ca decision 2), for an activated terminal only.
 */
export function GET(request: Request) {
  const terminal = activeTerminal(request);
  if (terminal instanceof Response) return terminal;
  return respond(request, ({ tenant }) => loadSports(tenant));
}
