import { loadDeposit } from "@/lib/server/payments";
import { problemResponse, respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Deposit ids are opaque (D3), but this one goes into an upstream path, so
 * only what an id can be — UUIDv7, the contract's ULID-like examples — is
 * sent.
 */
const DEPOSIT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * One of the player's deposits (`GET /v1/deposits/{id}`), polled every 3 s
 * while it is pending. Read-only, so no CSRF check; a session for this tenant
 * is required.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/deposits/[id]">,
) {
  const { id } = await ctx.params;
  if (!DEPOSIT_ID.test(id)) {
    return problemResponse(404, "NOT_FOUND", "No such deposit");
  }
  return respond(request, (route) => {
    const session = readSession(request, route.tenant);
    if (!session) throw new SessionGoneError();
    return loadDeposit(
      { ...route, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      id,
    );
  });
}
