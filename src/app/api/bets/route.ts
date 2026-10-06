import { z } from "zod";
import { placeBetRequestSchema } from "@/lib/api/schemas";
import { loadMyBets, placeBet } from "@/lib/server/bets";
import { BODY_CAPS, readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { problemResponse, respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

const idempotencyKeySchema = z.uuid();

/**
 * My bets' query: the contract's filter, and the previous page's cursor —
 * opaque, so only its size and alphabet are checked (printable ASCII, no
 * spaces) before it goes upstream.
 */
const listQuerySchema = z.object({
  status: z.enum(["open", "settled"]),
  cursor: z
    .string()
    .regex(/^[\x21-\x7e]{1,512}$/)
    .nullable(),
});

/**
 * The player's bets, a page at a time (`GET /v1/bets`). Read-only, so no
 * CSRF check (as `/api/me`); a session for this tenant is required.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = listQuerySchema.safeParse({
    status: params.get("status"),
    cursor: params.get("cursor"),
  });
  if (!query.success) {
    return problemResponse(422, "VALIDATION_FAILED", "Not a bets query");
  }
  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return loadMyBets(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      query.data,
    );
  });
}

/**
 * Places the slip (C08). Every check runs before anything is sent upstream:
 * this site's own page (origin, CSRF header, JSON), one `Idempotency-Key`
 * per intent — the browser's, forwarded, never made here — a body the
 * contract allows, and a session. Answers 201 with the engine's ticket, or
 * the engine's Problem unchanged.
 */
export async function POST(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const key = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!key.success) {
    return problemResponse(
      400,
      "VALIDATION_FAILED",
      "Idempotency-Key required",
    );
  }

  const bet = await readForm(
    request,
    placeBetRequestSchema,
    "Not a bet",
    BODY_CAPS.slip,
  );
  if (bet instanceof Response) return bet;

  return respond(
    request,
    (ctx) => {
      const session = readSession(request, ctx.tenant);
      if (!session) throw new SessionGoneError();
      return placeBet(
        { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
        session,
        bet,
        key.data,
      );
    },
    { status: 201 },
  );
}
