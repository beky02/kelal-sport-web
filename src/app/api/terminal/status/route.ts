import type { TerminalStatus } from "@/features/terminal/types";
import { tenantFromHeaders } from "@/lib/server/config";
import { respond } from "@/lib/server/respond";
import {
  deviceSignature,
  loadTerminalStatus,
  terminalOnly,
} from "@/lib/server/terminal";
import {
  clearTerminalCookie,
  readTerminalSession,
} from "@/lib/server/terminal-session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * What this terminal is (F8b AC-4, AC-5), read on boot and every 5 minutes.
 *
 * No terminal cookie of this tenant's: `inactive`, without asking anyone. A
 * token past its expiry: `inactive` (lapsed), and the cookie goes. Otherwise
 * the browser's signature (D3) — checked for shape and clock first — goes up
 * with the token and the device id from the cookie, and the API's answer comes
 * back as a `TerminalStatus`.
 */
export async function GET(request: Request) {
  const elsewhere = terminalOnly(request);
  if (elsewhere) return elsewhere;

  const session = readTerminalSession(
    request,
    tenantFromHeaders(request.headers),
  );
  if (!session) {
    return respond(request, async (): Promise<TerminalStatus> => ({
      state: "inactive",
      reason: "new",
    }));
  }
  if (session.expiresAt <= Date.now()) {
    return respond(request, async (ctx): Promise<TerminalStatus> => {
      ctx.setCookie(clearTerminalCookie(request));
      return { state: "inactive", reason: "expired" };
    });
  }

  const device = deviceSignature(request);
  if (device instanceof Response) return device;

  return respond(request, async (ctx) => {
    const { status, clear } = await loadTerminalStatus(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      session,
      device,
    );
    if (clear) ctx.setCookie(clearTerminalCookie(request));
    return status;
  });
}
