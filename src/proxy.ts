import { NextResponse, type NextRequest } from "next/server";
import { routes } from "@/config/routes";
import {
  decodeSegment,
  normaliseTicketNumber,
} from "@/features/tickets/lib/number";
import { isTerminalHost, requestHost } from "@/lib/server/config";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/** Pages with nothing to show a guest. */
const PROTECTED = [routes.myBets, routes.wallet, routes.transactions];

/** The terminal's pages and route handlers (FD1). */
const TERMINAL = [routes.terminal, routes.terminalApi];

export const config = {
  // Every page and route handler: the host split needs them all (FD1). Not
  // Next's own files under /_next/ (chunks, the image optimiser, the dev
  // server's HMR socket — no app route lives there), nor the files in public/.
  // Excluded by path, never by extension: `/event/x.png` is a page.
  matcher: ["/((?!_next/|favicon\\.ico$|flags/).*)"],
};

/**
 * Keeps each host to its own site (FD1, F8a) and, on the player's, does what
 * it always did.
 *
 * A terminal host (`TERMINAL_HOST_MAP`) serves only the terminal: `/` shows
 * `/terminal`, `/terminal/*` and `/api/terminal/*` go through, and anything
 * else is a 404. Every other host is the player site, where the terminal's
 * paths are a 404. The host is read as the tenant is (`requestHost`), so the
 * site and the tenant never disagree and a forged forwarded host picks
 * neither.
 *
 * On the player site it sends a visitor without a session cookie from an
 * account page to log in, and back again afterwards (`?next=`), and answers a
 * ticket address that holds no ticket number (`ticketAddress`). For the
 * account pages that is all it does (C18 §4.4). It does not open the cookie,
 * and nothing trusts it: every route handler reads the session itself and the
 * API checks every token, so a request that skips the proxy (CVE-2025-29927)
 * reaches nothing a guest could not.
 */
export function proxy(request: NextRequest) {
  if (isTerminalHost(requestHost(request.headers))) {
    return terminalSite(request);
  }
  const { pathname, search } = request.nextUrl;
  const decoded = decodedPath(pathname);
  if (
    isTerminalPath(pathname) ||
    (decoded !== null && isTerminalPath(decoded))
  ) {
    return notFound(request);
  }
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
 * A terminal host: `/` is the terminal's start, its own paths go through when
 * they are spelt plainly, and nothing else exists here — no login, no wallet,
 * no account on a shop PC.
 */
function terminalSite(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === routes.home) {
    const start = request.nextUrl.clone();
    start.pathname = routes.terminal;
    return NextResponse.rewrite(start);
  }
  const decoded = decodedPath(pathname);
  const plain =
    decoded !== null &&
    !decoded.split("/").some((segment) => segment === "." || segment === "..");
  return plain && isTerminalPath(pathname) && isTerminalPath(decoded)
    ? NextResponse.next()
    : notFound(request);
}

/** `/terminal`, `/api/terminal`, or a path below either — never `/terminals`. */
const isTerminalPath = (path: string) =>
  TERMINAL.some((base) => path === base || path.startsWith(`${base}/`));

/** The path with its escapes undone, or null when one is malformed. */
function decodedPath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

/**
 * A route of the other site: answered with Next's own 404 page, as a route
 * that doesn't exist is, and nothing of that site renders.
 */
const notFound = (request: NextRequest) =>
  NextResponse.rewrite(new URL(routes.notFound, request.url), { status: 404 });

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
