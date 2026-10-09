import { z } from "zod";
import { redeemCodeSchema } from "@/lib/api/promotion-schemas";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { redeemPromoCode } from "@/lib/server/promotions";
import { problemResponse, respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";

const idempotencyKeySchema = z.uuid();

/**
 * Redeems a promo code (C11, AC-12). Every check runs before anything is sent
 * upstream: this site's own page (origin, CSRF header, JSON), one
 * `Idempotency-Key` per intent — the browser's, forwarded, never made here —
 * a body that is the contract's `{ code }` and nothing else, and a session.
 * Answers 200 with what the code did, or the API's Problem unchanged
 * (`PROMO_INVALID`, `PROMO_ALREADY_USED`…).
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

  const body = await readForm(request, redeemCodeSchema, "Not a promo code");
  if (body instanceof Response) return body;

  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return redeemPromoCode(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      body.code,
      key.data,
    );
  });
}
