import { loadTerminalConfigView } from "@/lib/server/public-config";
import { respond } from "@/lib/server/respond";
import { activeTerminal } from "@/lib/server/terminal";

/**
 * The kiosk's switches and languages (F8ca): whether the tenant sells in
 * shops, and which languages the kiosk offers, starting in the tenant's
 * default. Read anonymously from `/v1/config/public` (F8ca decision 2), for
 * an activated terminal only.
 */
export function GET(request: Request) {
  const terminal = activeTerminal(request);
  if (terminal instanceof Response) return terminal;
  return respond(request, ({ tenant }) => loadTerminalConfigView(tenant));
}
