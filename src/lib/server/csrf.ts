import "server-only";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { requestHost } from "./config";
import { problemResponse } from "./respond";

/**
 * Only this site's own pages mutate anything (C18 §4.4).
 *
 * Three independent checks, each enough on its own: the browser's own account
 * of where the request came from (`Sec-Fetch-Site`, `Origin`) must be this
 * site; the request must carry the header `apiClient` adds to every POST, which
 * no other origin can send without a preflight this app never answers; and the
 * body must be JSON, which an HTML form cannot send. The session cookie riding
 * along on a cross-site request therefore buys an attacker nothing.
 *
 * A `DELETE` has no body, so it passes `{ json: false }` and skips that last
 * check: it is never a CORS-simple method, so another origin can't send one
 * without a preflight this app never answers, and no form can send one at all.
 *
 * Returns the refusal, or `null` when the request may proceed.
 */
export function assertSameOrigin(
  request: Request,
  { json = true }: { json?: boolean } = {},
): Response | null {
  const refuse = () =>
    problemResponse(403, "PERMISSION_DENIED", "Not from this site");

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return refuse();

  const origin = request.headers.get("origin");
  if (origin !== null) {
    const host = requestHost(request.headers)?.toLowerCase();
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      originHost = null;
    }
    if (!host || !originHost || originHost !== host) return refuse();
  }

  if (request.headers.get(CSRF_HEADER) !== CSRF_VALUE) return refuse();

  if (
    json &&
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return problemResponse(415, "VALIDATION_FAILED", "Send JSON");
  }

  return null;
}
