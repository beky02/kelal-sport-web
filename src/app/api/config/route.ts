import { loadPublicConfigView } from "@/lib/server/public-config";
import { respond } from "@/lib/server/respond";

export function GET(request: Request) {
  return respond(request, ({ tenant }) => loadPublicConfigView(tenant));
}
