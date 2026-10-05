import { API_ID_PATTERN } from "@/lib/api/patterns";
import { assertSameOrigin } from "@/lib/server/csrf";
import { problemResponse, respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";
import { cancelWithdrawal, loadWithdrawal } from "@/lib/server/withdrawals";

const notFound = () => problemResponse(404, "NOT_FOUND", "No such withdrawal");

/**
 * One of the player's withdrawals (`GET /v1/withdrawals/{id}`), read while
 * its screen is open. Read-only, so no CSRF check; an id that can be one —
 * it goes into the upstream path — and a session for this tenant.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/withdrawals/[id]">,
) {
  const { id } = await ctx.params;
  if (!API_ID_PATTERN.test(id)) return notFound();
  return respond(request, (route) => {
    const session = readSession(request, route.tenant);
    if (!session) throw new SessionGoneError();
    return loadWithdrawal(
      { ...route, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      id,
    );
  });
}

/**
 * Cancels a withdrawal while it is `requested` or in `review`
 * (`DELETE /v1/withdrawals/{id}`). This site's own page only (origin and
 * CSRF header; a DELETE has no body to check), the id check and a session.
 * No `Idempotency-Key`: the contract takes none, and a withdrawal can only be
 * cancelled once — a repeat is the API's 409. Answers 200 with the cancelled
 * withdrawal, or the API's Problem unchanged.
 */
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/withdrawals/[id]">,
) {
  const refused = assertSameOrigin(request, { json: false });
  if (refused) return refused;

  const { id } = await ctx.params;
  if (!API_ID_PATTERN.test(id)) return notFound();
  return respond(request, (route) => {
    const session = readSession(request, route.tenant);
    if (!session) throw new SessionGoneError();
    return cancelWithdrawal(
      { ...route, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      id,
    );
  });
}
