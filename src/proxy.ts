import { NextResponse, type NextRequest } from "next/server";
import { routes } from "@/config/routes";
import {
  decodeSegment,
  normaliseTicketNumber,
} from "@/features/tickets/lib/number";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/** Pages with nothing to show a guest. */
const PROTECTED = [routes.myBets, routes.wallet, routes.transactions];

export const config = {
  matcher: ["/my-bets/:path*", "/wallet", "/transactions", "/t/:ticket"],
};

/**
 * Sends a visitor without a session cookie from an account page to log in,
 * and back again afterwards (`?next=`) — and answers a ticket address that
 * holds no ticket number (`ticketAddress`).
 *
 * For the account pages that is all it does (C18 §4.4). It does not open the
 * cookie, and nothing trusts it: every route handler reads the session itself
 * and the API checks every token, so a request that skips the proxy
 * (CVE-2025-29927) reaches nothing a guest could not.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith(`${routes.ticketCheck}/`)) {
    return ticketAddress(request);
  }
  const guarded = PROTECTED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!guarded || request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }
  const login = request.nextUrl.clone();
  login.pathname = routes.login;
  login.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(login);
}

/**
 * `/t/{x}` where x is no ticket number — not D3's 9 Crockford characters with
 * its check character, whatever the spelling: a real 404, decided here before
 * anything renders, so the server renders the ticket's own 404 in full
 * (`/t?missing=1`) and it reads without JavaScript. A `notFound()` thrown by
 * the page would answer with an empty document for the browser to fill in
 * (Next 16). Nothing from the address goes on; ticket numbers go on to the
 * page, which redirects any other spelling to the canonical one.
 */
function ticketAddress(request: NextRequest) {
  const segment = request.nextUrl.pathname.slice(routes.ticketCheck.length + 1);
  if (normaliseTicketNumber(decodeSegment(segment))) {
    return NextResponse.next();
  }
  return NextResponse.rewrite(new URL(routes.ticketMissing, request.url), {
    status: 404,
  });
}
