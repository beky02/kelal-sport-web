import { loadBoard } from "@/lib/server/catalogue";
import { isLite, respond } from "@/lib/server/respond";

const FILTERS = ["top", "upcoming", "today"] as const;
type Filter = (typeof FILTERS)[number];

export function GET(request: Request) {
  return respond(request, ({ tenant, params }) => {
    const filter = params.get("filter");
    return loadBoard(
      tenant,
      {
        sportId: params.get("sport") ?? undefined,
        competitionId: params.get("competition") ?? undefined,
        filter: FILTERS.includes(filter as Filter)
          ? (filter as Filter)
          : undefined,
        date: params.get("date") ?? undefined,
        live: params.get("live") === "1",
      },
      isLite(params),
    );
  });
}
