import { loadSports } from "@/lib/server/catalogue";
import { respond } from "@/lib/server/respond";

export function GET(request: Request) {
  return respond(request, ({ tenant }) => loadSports(tenant));
}
