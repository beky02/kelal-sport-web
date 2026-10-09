import { loadPromotions } from "@/lib/server/promotions";
import { respond } from "@/lib/server/respond";
import { mockPreference } from "@/lib/server/upstream";

/**
 * The tenant's current offers (`GET /v1/promotions`, AC-11), in the UI's
 * language, never cached. Public, as the contract has it: a guest reads them
 * too, and no session is sent.
 */
export function GET(request: Request) {
  return respond(request, (ctx) =>
    loadPromotions({
      ...ctx,
      prefer: mockPreference(request.headers.get("prefer")),
    }),
  );
}
