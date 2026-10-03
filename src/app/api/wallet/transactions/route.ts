import { z } from "zod";
import { WALLET_TXN_TYPES } from "@/features/wallet/types";
import { problemResponse, respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";
import { loadWalletHistory } from "@/lib/server/wallet";

/**
 * The history's query: one of the contract's `type`s, the previous page's
 * cursor — opaque, so only its size and alphabet are checked (printable
 * ASCII, no spaces) — and the contract's `Limit` (1–100). Nothing else
 * reaches the upstream URL.
 */
const historyQuerySchema = z.object({
  type: z.enum(WALLET_TXN_TYPES).nullable(),
  cursor: z
    .string()
    .regex(/^[\x21-\x7e]{1,512}$/)
    .nullable(),
  limit: z
    .string()
    .regex(/^\d{1,3}$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .nullable(),
});

/**
 * The player's wallet history, a page at a time
 * (`GET /v1/wallet/transactions`). Read-only, so no CSRF check; a session for
 * this tenant is required.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = historyQuerySchema.safeParse({
    type: params.get("type"),
    cursor: params.get("cursor"),
    limit: params.get("limit"),
  });
  if (!query.success) {
    return problemResponse(422, "VALIDATION_FAILED", "Not a history query");
  }
  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return loadWalletHistory(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      query.data,
    );
  });
}
