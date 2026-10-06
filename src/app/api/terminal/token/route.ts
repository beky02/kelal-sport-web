import type { TokenRotation } from "@/features/terminal/types";
import { tenantFromHeaders } from "@/lib/server/config";
import { assertSameOrigin } from "@/lib/server/csrf";
import { problemResponse, respond } from "@/lib/server/respond";
import {
  deviceSignature,
  rotateTerminalToken,
  terminalOnly,
} from "@/lib/server/terminal";
import {
  readTerminalSession,
  terminalCookie,
} from "@/lib/server/terminal-session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Rotates the terminal token (F8b AC-5) when the status read says fewer than
 * 7 days remain. The browser signs the API call over no body, so none is
 * read or sent (`assertSameOrigin` without the JSON check, as a DELETE: the
 * CSRF header alone forces a preflight no other origin gets). The new token
 * replaces the old in the sealed cookie; the browser learns only that it did.
 */
export async function POST(request: Request) {
  const elsewhere = terminalOnly(request);
  if (elsewhere) return elsewhere;
  const refused = assertSameOrigin(request, { json: false });
  if (refused) return refused;

  const session = readTerminalSession(
    request,
    tenantFromHeaders(request.headers),
  );
  if (!session) {
    return problemResponse(
      401,
      "AUTH_INVALID_CREDENTIALS",
      "This terminal is not activated",
    );
  }
  const device = deviceSignature(request);
  if (device instanceof Response) return device;

  return respond(request, async (ctx): Promise<TokenRotation> => {
    const next = await rotateTerminalToken(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      device,
    );
    ctx.setCookie(terminalCookie(next, request));
    return { rotated: true };
  });
}
