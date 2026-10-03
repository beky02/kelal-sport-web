import { z } from "zod";
import { depositRequestSchema } from "@/lib/api/schemas";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { createDeposit } from "@/lib/server/payments";
import { problemResponse, respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

const idempotencyKeySchema = z.uuid();

/**
 * Starts a deposit (C04). Every check runs before anything is sent upstream:
 * this site's own page (origin, CSRF header, JSON), one `Idempotency-Key` per
 * intent — the browser's, forwarded, never made here — a small body the
 * contract allows (a method and an amount, nothing else), and a session.
 * Answers 201 with the deposit and what the player does next, or the API's
 * Problem unchanged.
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

  const deposit = await readForm(
    request,
    depositRequestSchema,
    "Not a deposit",
  );
  if (deposit instanceof Response) return deposit;

  return respond(
    request,
    (ctx) => {
      const session = readSession(request, ctx.tenant);
      if (!session) throw new SessionGoneError();
      return createDeposit(
        { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
        session,
        deposit,
        key.data,
      );
    },
    { status: 201 },
  );
}
