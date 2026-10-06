import "server-only";
import { z } from "zod";
import { openJson, sealJson, type Purpose } from "./seal";
import { secureFor } from "./session";

/**
 * A shop terminal's credentials as the server holds them: the API's terminal
 * token, sealed into an httpOnly cookie on the terminal's host (D3, F8b). The
 * browser carries it and can neither read nor forge it. The tenant and the
 * terminal's id are sealed in: the id becomes `X-Device-Id` on every call, so
 * a browser never names its own device.
 */
export interface TerminalSession {
  tenant: string;
  terminalId: string;
  token: string;
  /** When the token lapses, in epoch milliseconds (`expires_in`). */
  expiresAt: number;
}

const terminalSessionSchema = z.object({
  tenant: z.string().min(1),
  terminalId: z.string().min(1),
  token: z.string().min(1),
  expiresAt: z.number().int(),
}) satisfies z.ZodType<TerminalSession>;

/** Its own key: a player's session cookie never opens as a terminal's, nor the reverse. */
const TERMINAL_PURPOSE: Purpose = {
  info: "kelal.terminal.v1",
  version: "v1",
};

/**
 * `__Host-` in production: Secure, `Path=/`, no `Domain`, so no sibling
 * subdomain can plant one (as the session cookie, 09-security).
 */
export const TERMINAL_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-kelal.terminal"
    : "kelal.terminal";

/**
 * The cookie outlives the token by this much, so a terminal switched off past
 * its token's 90 days is told its activation lapsed, rather than shown a new
 * activation with no reason.
 */
const LAPSED_GRACE_S = 30 * 24 * 60 * 60;

export const sealTerminal = (session: TerminalSession, secret?: string) =>
  sealJson(TERMINAL_PURPOSE, session, secret);

export const openTerminal = (value: string, secret?: string) =>
  openJson(TERMINAL_PURPOSE, terminalSessionSchema, value, secret);

/**
 * The terminal session the request carries for this tenant, or null. The
 * first same-named cookie that opens counts, so one planted elsewhere cannot
 * shadow the real one.
 */
export function readTerminalSession(
  request: Request,
  tenant: string,
): TerminalSession | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key !== TERMINAL_COOKIE) continue;
    const session = openTerminal(value.join("="));
    if (session && session.tenant === tenant) return session;
  }
  return null;
}

function cookie(value: string, request: Request, maxAge: number): string {
  return [
    `${TERMINAL_COOKIE}=${value}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    // Nothing links into a kiosk: the cookie goes only with its own pages' calls.
    "SameSite=Strict",
    ...(secureFor(request) ? ["Secure"] : []),
  ].join("; ");
}

/** The `Set-Cookie` value that stores a terminal session, until its token lapses plus the grace. */
export function terminalCookie(
  session: TerminalSession,
  request: Request,
  now: number = Date.now(),
): string {
  const life = Math.max(0, Math.floor((session.expiresAt - now) / 1000));
  return cookie(sealTerminal(session), request, life + LAPSED_GRACE_S);
}

/** The `Set-Cookie` value that removes it. */
export const clearTerminalCookie = (request: Request): string =>
  cookie("", request, 0);
