import { z } from "zod";
import { withdrawalRequestSchema } from "@/lib/api/schemas";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { problemResponse, respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";
import { createWithdrawal } from "@/lib/server/withdrawals";

const idempotencyKeySchema = z.uuid();

/**
 * Requests a withdrawal (C04). Every check runs before anything is sent
 * upstream: this site's own page (origin, CSRF header, JSON), one
 * `Idempotency-Key` per intent — the browser's, forwarded, never made here —
 * a small body the contract allows (a method, an amount and a saved account
 * or a mobile number, nothing else), and a session. Answers 201 with the
 * withdrawal, or the API's Problem unchanged.
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

  const withdrawal = await readForm(
    request,
    withdrawalRequestSchema,
    "Not a withdrawal",
  );
  if (withdrawal instanceof Response) return withdrawal;

  return respond(
    request,
    (ctx) => {
      const session = readSession(request, ctx.tenant);
      if (!session) throw new SessionGoneError();
      return createWithdrawal(
        { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
        session,
        withdrawal,
        key.data,
      );
    },
    { status: 201 },
  );
}
