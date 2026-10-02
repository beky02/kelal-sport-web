import { z } from "zod";
import { placeBetRequestSchema } from "@/lib/api/schemas";
import { placeBet } from "@/lib/server/bets";
import { readJson } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { problemResponse, respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

const idempotencyKeySchema = z.uuid();

/** Far more than any slip (30 legs) needs; nothing bigger is read. */
const MAX_BODY_BYTES = 16 * 1024;

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

  const json = await readJson(request, MAX_BODY_BYTES);
  if (json === "too_large") {
    return problemResponse(413, "VALIDATION_FAILED", "Too large");
  }
  const body = placeBetRequestSchema.safeParse(json);
  if (!body.success) {
    return problemResponse(422, "VALIDATION_FAILED", "Not a bet");
  }

  return respond(
    request,
    (ctx) => {
      const session = readSession(request, ctx.tenant);
      if (!session) throw new SessionGoneError();
      return placeBet(
        { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
        session,
        body.data,
        key.data,
      );
    },
    { status: 201 },
  );
}
