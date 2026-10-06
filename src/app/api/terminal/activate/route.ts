import { activationFormSchema } from "@/lib/api/terminal-schemas";
import { readForm } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { respond } from "@/lib/server/respond";
import { activateTerminal, terminalOnly } from "@/lib/server/terminal";
import { terminalCookie } from "@/lib/server/terminal-session";
import { mockPreference } from "@/lib/server/upstream";

/**
 * Activates this shop PC with its one-time code (C19 §4.1, F8b AC-4). Only on
 * a terminal host, only from its own page, and only a well-formed code and a
 * P-256 public key go upstream. The terminal token ends up sealed in the
 * terminal cookie and nowhere else; the browser gets the shop. A wrong code
 * (404), an expired one (410) and too many tries (429, with `Retry-After`)
 * pass through as the API's Problems.
 */
export async function POST(request: Request) {
  const elsewhere = terminalOnly(request);
  if (elsewhere) return elsewhere;
  const refused = assertSameOrigin(request);
  if (refused) return refused;

  const form = await readForm(
    request,
    activationFormSchema,
    "Not an activation code and device key",
  );
  if (form instanceof Response) return form;

  return respond(request, async (ctx) => {
    const { result, session } = await activateTerminal(
      { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
      form,
    );
    ctx.setCookie(terminalCookie(session, request));
    return result;
  });
}
