import { loadSearch } from "@/lib/server/catalogue";
import { respond } from "@/lib/server/respond";
import {
  activeTerminal,
  preMatchSearch,
  refusal,
  searchQuery,
} from "@/lib/server/terminal";

/**
 * The kiosk's search (its header, as the player's): the player's loader, read
 * anonymously (F8ca decision 2), for an activated terminal only, and matches
 * before kick-off only (D8). Nothing typed asks nothing.
 */
export function GET(request: Request) {
  const terminal = activeTerminal(request);
  if (terminal instanceof Response) return terminal;
  const query = searchQuery(new URL(request.url).searchParams);
  if ("field" in query) {
    return refusal("This search is not one the terminal makes", [query]);
  }
  return respond(request, async ({ tenant }) =>
    query.q === ""
      ? { leagues: [], events: [] }
      : preMatchSearch(await loadSearch(tenant, query.q, false)),
  );
}
