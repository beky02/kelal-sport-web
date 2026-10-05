import { payoutAccountRequestSchema } from "@/lib/api/schemas";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { respond } from "@/lib/server/respond";
import { readSession, SessionGoneError } from "@/lib/server/session";
import { mockPreference } from "@/lib/server/upstream";
import { addPayoutAccount, loadPayoutAccounts } from "@/lib/server/withdrawals";

/**
 * The player's saved payout accounts (`GET /v1/me/payout-accounts`), never
 * cached. Read-only, so no CSRF check (as `/api/wallet`); a session for this
 * tenant is required.
 */
export function GET(request: Request) {
  return respond(request, (ctx) => {
    const session = readSession(request, ctx.tenant);
    if (!session) throw new SessionGoneError();
    return loadPayoutAccounts(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
    );
  });
}

/**
 * Saves a payout account (`POST /v1/me/payout-accounts`). Every check runs
 * before anything is sent upstream: this site's own page (origin, CSRF
 * header, JSON), a small body the contract allows — a method and a mobile
 * number, nothing else — and a session. Answers 201 with the saved account,
 * or the API's Problem unchanged (a 409 when it is already saved).
 */
export async function POST(request: Request) {
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const account = await readForm(
    request,
    payoutAccountRequestSchema,
    "Not a payout account",
  );
  if (account instanceof Response) return account;

  return respond(
    request,
    (ctx) => {
      const session = readSession(request, ctx.tenant);
      if (!session) throw new SessionGoneError();
      return addPayoutAccount(
        { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
        session,
        account,
      );
    },
    { status: 201 },
  );
}
