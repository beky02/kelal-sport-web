import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { z } from "zod";
import type { components } from "@/lib/api/schema";
import { DEVICE_COOKIE, SESSION_COOKIE } from "@/lib/session-cookie";
import type { Lang } from "@/types/common";
import { forwardedHeader, sessionSecret, sessionSecrets } from "./config";
import { UpstreamError, unwrap, upstream } from "./upstream";

export { DEVICE_COOKIE, SESSION_COOKIE };

type Tokens = components["schemas"]["Tokens"];

/**
 * A player's session as the server holds it: the API's tokens, sealed into an
 * httpOnly cookie the browser carries but can neither read nor forge (D3, C18
 * §4.4). The tenant is sealed in too, so a cookie read under another tenant's
 * host is nothing (AC-7).
 */
export interface Session {
  tenant: string;
  access: string;
  refresh: string;
  /** When the access token lapses, in epoch milliseconds (`expires_in`). */
  expiresAt: number;
}

const sessionSchema = z.object({
  tenant: z.string().min(1),
  access: z.string().min(1),
  refresh: z.string().min(1),
  expiresAt: z.number().int(),
}) satisfies z.ZodType<Session>;

// ── sealing ─────────────────────────────────────────────────────────────────

const VERSION = "v1";
/** The cookie's purpose, bound into the key so the secret serves nothing else. */
const KEY_INFO = `kelal.session.${VERSION}`;
const keyFor = (secret: string) =>
  Buffer.from(hkdfSync("sha256", secret, "", KEY_INFO, 32));
const encode = (bytes: Buffer) => bytes.toString("base64url");
const decode = (text: string) => Buffer.from(text, "base64url");
/** The version is authenticated too: a `v1` tag cannot be presented as another. */
const AAD = Buffer.from(VERSION, "utf8");

/** AES-256-GCM: confidentiality and integrity in one; a changed byte opens to nothing. */
export function seal(
  session: Session,
  secret: string = sessionSecret(),
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  cipher.setAAD(AAD);
  const sealed = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(session), "utf8")),
    cipher.final(),
  ]);
  return [
    VERSION,
    encode(iv),
    encode(sealed),
    encode(cipher.getAuthTag()),
  ].join(".");
}

function openWith(
  secret: string,
  iv: string,
  sealed: string,
  tag: string,
): Session | null {
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFor(secret),
      decode(iv),
    );
    decipher.setAAD(AAD);
    decipher.setAuthTag(decode(tag));
    const plain = Buffer.concat([
      decipher.update(decode(sealed)),
      decipher.final(),
    ]).toString("utf8");
    const parsed = sessionSchema.safeParse(JSON.parse(plain));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * The session a cookie value holds, or null for anything tampered, foreign or
 * stale in shape. Tried with the current secret, then the previous one during
 * a rotation (`sessionSecrets()`), unless a secret is given.
 */
export function open(value: string, secret?: string): Session | null {
  const [version, iv, sealed, tag, ...rest] = value.split(".");
  if (version !== VERSION || !iv || !sealed || !tag || rest.length > 0) {
    return null;
  }
  for (const candidate of secret ? [secret] : sessionSecrets()) {
    const session = openWith(candidate, iv, sealed, tag);
    if (session) return session;
  }
  return null;
}

// ── cookies ─────────────────────────────────────────────────────────────────

/** C01 §9 `auth.refresh_ttl_days`: the refresh token, not the cookie, ends a session. */
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;
const DEVICE_MAX_AGE_S = 365 * 24 * 60 * 60;

/** Every value sent under `name` — a browser may send more than one. */
function cookieValues(request: Request, name: string): string[] {
  const header = request.headers.get("cookie");
  if (!header) return [];
  const values: string[] = [];
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) values.push(value.join("="));
  }
  return values;
}

/**
 * `Secure` always in production — TLS ends at the edge, so the request this
 * server sees may be plain HTTP — and otherwise only when a trusted edge says
 * the player came over HTTPS (AC-7's rule, never the request URL, which Next
 * builds from whatever `X-Forwarded-Proto` the client sent). So
 * `http://localhost` and a phone on the LAN can still log in.
 */
export function secureFor(request: Request): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return (
    forwardedHeader(request.headers, "x-forwarded-proto")?.toLowerCase() ===
    "https"
  );
}

function cookie(
  name: string,
  value: string,
  request: Request,
  maxAge: number,
): string {
  return [
    `${name}=${value}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(secureFor(request) ? ["Secure"] : []),
  ].join("; ");
}

/**
 * The session the request carries for this tenant, or null (AC-7). The first
 * same-named cookie that opens counts, so one planted on a parent domain or
 * another path cannot shadow the real one.
 */
export function readSession(request: Request, tenant: string): Session | null {
  for (const raw of cookieValues(request, SESSION_COOKIE)) {
    const session = open(raw);
    if (session && session.tenant === tenant) return session;
  }
  return null;
}

/** The `Set-Cookie` value that stores a session. */
export const sessionCookie = (session: Session, request: Request): string =>
  cookie(SESSION_COOKIE, seal(session), request, SESSION_MAX_AGE_S);

/** The `Set-Cookie` value that removes it. */
export const clearSessionCookie = (request: Request): string =>
  cookie(SESSION_COOKIE, "", request, 0);

/** Contract request 004's shape for a device id. */
const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function readDevice(request: Request): string | null {
  return (
    cookieValues(request, DEVICE_COOKIE).find((value) =>
      DEVICE_ID.test(value),
    ) ?? null
  );
}

/**
 * This browser's device id — read, or minted now and set. It becomes
 * `device.fingerprint` on login and registration (C01) and, once contract
 * request 004 lands, `X-Client-Device` on every call made for the player.
 */
export function ensureDevice(
  request: Request,
  setCookie: (header: string) => void,
): string {
  const existing = readDevice(request);
  if (existing) return existing;
  const id = `d_${randomBytes(12).toString("base64url")}`;
  setCookie(cookie(DEVICE_COOKIE, id, request, DEVICE_MAX_AGE_S));
  return id;
}

// ── tokens ──────────────────────────────────────────────────────────────────

/** The API's clock when it answered, else ours. */
export function apiNow(response: Response): number {
  const date = Date.parse(response.headers.get("date") ?? "");
  return Number.isNaN(date) ? Date.now() : date;
}

export function sessionFromTokens(
  tenant: string,
  tokens: Tokens,
  now: number = Date.now(),
): Session {
  return {
    tenant,
    access: tokens.access_token,
    refresh: tokens.refresh_token,
    expiresAt: now + tokens.expires_in * 1000,
  };
}

// ── calling the API for a player ────────────────────────────────────────────

/** The session is no longer valid: the cookie has been cleared; the player is a guest. */
export class SessionGoneError extends Error {
  constructor() {
    super("The session is no longer valid");
    this.name = "SessionGoneError";
  }
}

export interface SessionContext {
  tenant: string;
  lang: Lang;
  prefer?: string;
  request: Request;
  /** Collects `Set-Cookie` headers for the response (`respond()`). */
  setCookie: (header: string) => void;
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Refresh this long before the access token lapses, so a call never leaves with one about to. */
const REFRESH_AHEAD_MS = 30_000;
/** How long a rotation is remembered for requests still carrying the previous cookie. */
const ROTATION_MEMORY_MS = 60_000;

const inFlight = new Map<string, Promise<Session>>();
const rotated = new Map<string, { session: Session; until: number }>();

const fingerprint = (token: string) =>
  createHash("sha256").update(token).digest("base64url");

const isExpiredProblem = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "AUTH_TOKEN_EXPIRED";

/**
 * Rotates the tokens — once per refresh token, however many requests ask.
 *
 * C01 §8 revokes the whole session family when a rotated refresh token is used
 * again, and a page load fans out several requests at once. So concurrent
 * refreshes share one call, and a request that still carries the previous
 * cookie within a minute of the rotation is handed the new tokens instead of
 * replaying the old refresh token. Prism's `Prefer` is never forwarded here: a
 * forced error state must not break the refresh.
 */
async function refresh(
  ctx: SessionContext,
  session: Session,
): Promise<Session> {
  const key = fingerprint(session.refresh);
  const recent = rotated.get(key);
  if (recent && recent.until > Date.now()) return recent.session;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const run = (async () => {
    const result = await upstream("Auth", {
      tenant: ctx.tenant,
      lang: ctx.lang,
    }).POST("/v1/auth/refresh", { body: { refresh_token: session.refresh } });
    if (result.response.status === 401) throw new SessionGoneError();
    if (!result.response.ok) {
      // The refresh token was in that request: whatever the API echoed about
      // it stays here. The browser learns only that the session could not be
      // kept.
      throw new UpstreamError(result.response.status, {
        type: "about:blank",
        title: "The session could not be refreshed",
        status: result.response.status,
        code: "SERVICE_UNAVAILABLE",
      });
    }
    const next = sessionFromTokens(
      ctx.tenant,
      unwrap(result),
      apiNow(result.response),
    );
    rotated.set(key, { session: next, until: Date.now() + ROTATION_MEMORY_MS });
    for (const [k, v] of rotated) if (v.until <= Date.now()) rotated.delete(k);
    return next;
  })();
  inFlight.set(key, run);
  try {
    return await run;
  } finally {
    inFlight.delete(key);
  }
}

async function rotate(ctx: SessionContext, session: Session): Promise<Session> {
  const next = await refresh(ctx, session);
  ctx.setCookie(sessionCookie(next, ctx.request));
  return next;
}

/**
 * The session to call with: the remembered rotation when this cookie was
 * already rotated (so the old token is never sent again), a fresh one when the
 * access token has lapsed, else the session as it came.
 */
async function current(
  ctx: SessionContext,
  session: Session,
): Promise<Session> {
  const known = rotated.get(fingerprint(session.refresh));
  if (known && known.until > Date.now()) {
    ctx.setCookie(sessionCookie(known.session, ctx.request));
    return known.session;
  }
  const lapsed = session.expiresAt - REFRESH_AHEAD_MS <= Date.now();
  return lapsed ? rotate(ctx, session) : session;
}

/**
 * Runs an API call for a player: `call` gets the `Authorization` value.
 *
 * A lapsed access token is refreshed before the call; a `401 AUTH_TOKEN_EXPIRED`
 * answer is refreshed and retried exactly once (AC-5). Any other 401, or a
 * refused refresh, means the session is gone: the cookie is cleared and
 * `SessionGoneError` thrown. Every other API error passes through as
 * `UpstreamError`, Problem intact.
 */
export async function withSession<T>(
  ctx: SessionContext,
  session: Session,
  call: (authorization: string) => Promise<FetchResult<T>>,
): Promise<T> {
  try {
    let active = await current(ctx, session);
    let result = await call(`Bearer ${active.access}`);
    if (result.response.status === 401) {
      if (!isExpiredProblem(result.error)) throw new SessionGoneError();
      active = await rotate(ctx, active);
      result = await call(`Bearer ${active.access}`);
      if (result.response.status === 401) throw new SessionGoneError();
    }
    // A 204 has no data; everything else that is not ok is the API's Problem.
    if (!result.response.ok) {
      throw new UpstreamError(result.response.status, result.error ?? null);
    }
    return result.data as T;
  } catch (error) {
    if (error instanceof SessionGoneError) {
      ctx.setCookie(clearSessionCookie(ctx.request));
    }
    throw error;
  }
}
