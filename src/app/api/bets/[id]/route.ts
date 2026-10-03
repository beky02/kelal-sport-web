import { loadMyBet } from "@/lib/server/bets";
import { problemResponse, respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Bet ids are opaque (D3), but this one goes into an upstream path, so only
 * what an id can be — UUIDv7, the contract's ULID-like examples — is sent.
 */
const BET_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** One of the player's tickets (`GET /v1/bets/{id}`), names in both languages. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/bets/[id]">,
) {
  const { id } = await ctx.params;
  if (!BET_ID.test(id)) {
    return problemResponse(404, "NOT_FOUND", "No such bet");
  }
  return respond(request, (route) => {
    const session = readSession(request, route.tenant);
    if (!session) throw new SessionGoneError();
    return loadMyBet(
      { ...route, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      id,
    );
  });
}
