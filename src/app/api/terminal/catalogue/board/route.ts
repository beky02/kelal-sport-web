import { loadBoard } from "@/lib/server/catalogue";
import { respond } from "@/lib/server/respond";
import {
  activeTerminal,
  boardQuery,
  preMatchBoard,
  refusal,
} from "@/lib/server/terminal";

/**
 * The kiosk's board (F8ca): the competitions and matches of a sport on a day,
 * with the prices a row shows — the player's loader, read anonymously (F8ca
 * decision 2), for an activated terminal only, and before kick-off only.
 */
export function GET(request: Request) {
  const terminal = activeTerminal(request);
  if (terminal instanceof Response) return terminal;
  const query = boardQuery(new URL(request.url).searchParams);
  if ("field" in query) {
    return refusal("This board query is not one the terminal asks", [query]);
  }
  return respond(request, async ({ tenant }) =>
    preMatchBoard(await loadBoard(tenant, query, false)),
  );
}
