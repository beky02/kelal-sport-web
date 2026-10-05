import { API_ID_PATTERN } from "@/lib/api/patterns";
import { assertSameOrigin } from "@/lib/server/csrf";
import { problemResponse, respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";
import { removePayoutAccount } from "@/lib/server/withdrawals";

/**
 * Removes one of the player's payout accounts
 * (`DELETE /v1/me/payout-accounts/{id}`). This site's own page only (origin
 * and CSRF header; a DELETE has no body to check), an id that can be one —
 * it goes into the upstream path — and a session. Answers 204, or the API's
 * Problem unchanged (404 for an account that isn't the player's).
 */
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/payout-accounts/[id]">,
) {
  const refused = assertSameOrigin(request, { json: false });
  if (refused) return refused;

  const { id } = await ctx.params;
  if (!API_ID_PATTERN.test(id)) {
    return problemResponse(404, "NOT_FOUND", "No such payout account");
  }
  return respond(
    request,
    async (route) => {
      const session = readSession(request, route.tenant);
      if (!session) throw new SessionGoneError();
      await removePayoutAccount(
        { ...route, prefer: mockPreference(request.headers.get("prefer")) },
        session,
        id,
      );
    },
    { status: 204 },
  );
}
