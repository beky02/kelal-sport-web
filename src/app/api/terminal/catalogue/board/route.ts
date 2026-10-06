import type { EventFilters } from "@/features/events/types";
import { loadBoard } from "@/lib/server/catalogue";
import { respond } from "@/lib/server/respond";
import { activeTerminal, refusal } from "@/lib/server/terminal";

const SPORT = /^s_[a-z0-9_]{1,40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FILTERS = ["top", "upcoming", "today"] as const;
type Filter = (typeof FILTERS)[number];

/** What the kiosk may ask for: a sport, and optionally a day and an order. */
const KNOWN = new Set(["sport", "date", "filter"]);

/**
 * The query, checked whole before anything goes upstream: the kiosk only ever
 * asks for a sport, a day and an order (no live board, D8; no competition, no
 * data saver), each once. Anything else is the field it got wrong.
 */
function boardQuery(
  params: URLSearchParams,
): EventFilters | { field: string; code: string } {
  for (const key of params.keys()) {
    if (!KNOWN.has(key)) return { field: key, code: "UNKNOWN" };
    if (params.getAll(key).length > 1) return { field: key, code: "FORMAT" };
  }
  const sport = params.get("sport") ?? "";
  if (!SPORT.test(sport)) return { field: "sport", code: "FORMAT" };
  const date = params.get("date");
  if (date !== null && !DATE.test(date))
    return { field: "date", code: "FORMAT" };
  const filter = params.get("filter");
  if (filter !== null && !FILTERS.includes(filter as Filter)) {
    return { field: "filter", code: "FORMAT" };
  }
  return {
    sportId: sport,
    date: date ?? undefined,
    filter: (filter as Filter | null) ?? undefined,
  };
}

/**
 * The kiosk's board (F8ca): the competitions and matches of a sport on a day,
 * with the prices a row shows — the player's loader, read anonymously (F8ca
 * decision 2), for an activated terminal only.
 */
export function GET(request: Request) {
  const terminal = activeTerminal(request);
  if (terminal instanceof Response) return terminal;
  const query = boardQuery(new URL(request.url).searchParams);
  if ("field" in query) {
    return refusal("This board query is not one the terminal asks", [query]);
  }
  return respond(request, ({ tenant }) => loadBoard(tenant, query, false));
}
