import { NextResponse, type NextRequest } from "next/server";
import { routes } from "@/config/routes";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/** Pages with nothing to show a guest. */
const PROTECTED = [routes.myBets, routes.wallet, routes.transactions];

export const config = {
  matcher: ["/my-bets/:path*", "/wallet", "/transactions"],
};

/**
 * Sends a visitor without a session cookie from an account page to log in,
 * and back again afterwards (`?next=`).
 *
 * That is all it does (C18 §4.4). It does not open the cookie, and nothing
 * trusts it: every route handler reads the session itself and the API checks
 * every token, so a request that skips the proxy (CVE-2025-29927) reaches
 * nothing a guest could not.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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
