import { loadSearch } from "@/lib/server/catalogue";
import { isLite, respond } from "@/lib/server/respond";

export function GET(request: Request) {
  return respond(request, ({ tenant, params }) => {
    const q = (params.get("q") ?? "").trim();
    if (q === "") return Promise.resolve({ leagues: [], events: [] });
    return loadSearch(tenant, q, isLite(params));
  });
}
