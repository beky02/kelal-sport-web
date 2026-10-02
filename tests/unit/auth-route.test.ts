// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api/schema";
import { toPlayer } from "@/lib/api/mappers/auth";
import { loginResultSchema, sessionViewSchema } from "@/lib/api/schemas";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { example, requestExample, responseExample } from "../contract";

// Route handlers are server-only; the marker package refuses to load outside
// React's server build, which a unit test is not.
vi.mock("server-only", () => ({}));

type AuthResult = components["schemas"]["AuthResult"];
type Tokens = components["schemas"]["Tokens"];

/** A fresh module graph per test, so env (trusted proxy) and refresh caches start clean. */
async function load() {
  vi.resetModules();
  const [login, logout, me, session] = await Promise.all([
    import("@/app/api/auth/login/route"),
    import("@/app/api/auth/logout/route"),
    import("@/app/api/me/route"),
    import("@/lib/server/session"),
  ]);
  return { login: login.POST, logout: logout.POST, me: me.GET, ...session };
}
type Loaded = Awaited<ReturnType<typeof load>>;

let sent: Request[] = [];

function upstreamAnswers(
  answer: (
    request: Request,
    body: unknown,
  ) => { status: number; body?: unknown },
) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const body =
      request.method === "POST"
        ? await request
            .clone()
            .json()
            .catch(() => undefined)
        : undefined;
    sent.push(request);
    const { status, body: payload } = answer(request, body);
    if (status === 204) return new Response(null, { status });
    return Response.json(payload, {
      status,
      headers: {
        "Content-Type":
          status >= 400 ? "application/problem+json" : "application/json",
        Date: "Sat, 03 Oct 2026 09:00:00 GMT",
      },
    });
  });
}

const path = (request: Request) => new URL(request.url).pathname;
const bearer = (request: Request) =>
  request.headers.get("authorization")?.replace(/^Bearer /, "");

/** What this site's own pages send on every POST (`apiClient`). */
const SAME_SITE = {
  host: "localhost:3000",
  "content-type": "application/json",
  [CSRF_HEADER]: CSRF_VALUE,
};

const post = (
  handler: (request: Request) => Promise<Response>,
  url: string,
  body: unknown,
  headers: Record<string, string> = SAME_SITE,
) =>
  handler(
    new Request(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );

const get = (
  handler: (request: Request) => Promise<Response>,
  url: string,
  headers: Record<string, string> = { host: "localhost:3000" },
) => handler(new Request(url, { headers }));

const LOGIN = "http://localhost:3000/api/auth/login";
const LOGOUT = "http://localhost:3000/api/auth/logout";
const ME = "http://localhost:3000/api/me";

const CREDENTIALS = { phone: "911234567", password: "correct horse battery" };
const EXPIRED = {
  type: "https://api.example.et/errors/token-expired",
  title: "Session expired",
  status: 401,
  code: "AUTH_TOKEN_EXPIRED",
};
const NOW = Date.parse("2026-10-03T09:00:00Z");

const live = (tenant = "demo") => ({
  tenant,
  access: "eyJ.live.access",
  refresh: "rt_live",
  expiresAt: NOW + 10 * 60_000,
});

const setCookies = (response: Response) => response.headers.getSetCookie();
const sessionCookieOf = (mod: Loaded, response: Response) =>
  setCookies(response).find((c) => c.startsWith(`${mod.SESSION_COOKIE}=`));
const deviceCookieOf = (mod: Loaded, response: Response) =>
  setCookies(response).find((c) => c.startsWith(`${mod.DEVICE_COOKIE}=`));
const cookieHeader = (mod: Loaded, session = live()) =>
  `${mod.SESSION_COOKIE}=${mod.seal(session)}`;
const valueOf = (cookie: string) =>
  cookie.split(";")[0].split("=").slice(1).join("=");

beforeEach(() => {
  sent = [];
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.stubEnv("TENANT_HOST_MAP", "localhost=demo,kelalsport.et=kelal");
  vi.stubEnv("TRUSTED_PROXY_HOPS", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/auth/login", () => {
  it("answers with the player and a sealed cookie, never the tokens (AC-3)", async () => {
    const mod = await load();
    const result = responseExample("/v1/auth/login", "post", 200) as AuthResult;
    upstreamAnswers(() => ({ status: 200, body: result }));

    const response = await post(mod.login, LOGIN, CREDENTIALS);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(result.tokens.access_token);
    expect(text).not.toContain(result.tokens.refresh_token);
    expect(loginResultSchema.parse(JSON.parse(text))).toEqual({
      status: "ok",
      player: {
        id: "01J9A7R0000000000000000001",
        phone: "+251911234567",
        fullName: "Abebe Kebede",
        kycStatus: "verified",
        language: "am",
      },
    });

    const cookie = sessionCookieOf(mod, response);
    expect(cookie).toBeDefined();
    expect(cookie).not.toContain(result.tokens.access_token);
    expect(cookie).not.toContain(result.tokens.refresh_token);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; SameSite=Lax/);
    expect(mod.open(valueOf(cookie!))).toEqual({
      tenant: "demo",
      access: result.tokens.access_token,
      refresh: result.tokens.refresh_token,
      expiresAt: NOW + result.tokens.expires_in * 1000,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("sends the contract's request with this browser's device, minting the device id once", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: responseExample("/v1/auth/login", "post", 200),
    }));

    const first = await post(mod.login, LOGIN, CREDENTIALS);
    const device = deviceCookieOf(mod, first);
    expect(device).toBeDefined();
    expect(device).toMatch(/; HttpOnly/);
    const id = valueOf(device!);
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);

    expect(sent).toHaveLength(1);
    expect(path(sent[0])).toBe("/v1/auth/login");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(sent[0].headers.get("authorization")).toBeNull();
    const expected = requestExample("/v1/auth/login", "post") as {
      device: { fingerprint: string; app_version: string };
    };
    expect(await sent[0].json()).toEqual({
      ...expected,
      device: {
        fingerprint: id,
        platform: "web",
        app_version: expect.any(String),
      },
    });

    // The browser brings the cookie back: the same id, nothing set again.
    sent = [];
    const second = await post(mod.login, LOGIN, CREDENTIALS, {
      ...SAME_SITE,
      cookie: `${mod.DEVICE_COOKIE}=${id}`,
    });
    expect(deviceCookieOf(mod, second)).toBeUndefined();
    expect(
      ((await sent[0].json()) as { device: { fingerprint: string } }).device
        .fingerprint,
    ).toBe(id);
  });

  it("answering 202 returns otp_required with the challenge and sets no session cookie (AC-6)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 202,
      body: responseExample("/v1/auth/login", "post", 202),
    }));

    const response = await post(mod.login, LOGIN, CREDENTIALS);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "otp_required",
      challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1T",
      expiresIn: 300,
    });
    expect(sessionCookieOf(mod, response)).toBeUndefined();
  });

  it("sends the challenge and the code on the second call (AC-6)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: responseExample("/v1/auth/login", "post", 200),
    }));

    const response = await post(mod.login, LOGIN, {
      ...CREDENTIALS,
      challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1T",
      otp: "482913",
    });

    expect(response.status).toBe(200);
    expect(await sent[0].json()).toMatchObject({
      phone: "+251911234567",
      challenge_id: "01J9A7QK3M8X2B7Y4Z5N6P0R1T",
      otp: "482913",
    });
    expect(sessionCookieOf(mod, response)).toBeDefined();
  });

  it("passes a 401 AUTH_INVALID_CREDENTIALS and a 423 AUTH_LOCKED through unchanged", async () => {
    const mod = await load();
    const wrong = responseExample("/v1/auth/login", "post", 401);
    upstreamAnswers(() => ({ status: 401, body: wrong }));
    const refused = await post(mod.login, LOGIN, CREDENTIALS);
    expect(refused.status).toBe(401);
    expect(await refused.json()).toEqual(wrong);
    expect(sessionCookieOf(mod, refused)).toBeUndefined();

    const locked = responseExample("/v1/auth/login", "post", 423);
    upstreamAnswers(() => ({ status: 423, body: locked }));
    const response = await post(mod.login, LOGIN, CREDENTIALS);
    expect(response.status).toBe(423);
    expect(await response.json()).toEqual(locked);
  });

  it("refuses a POST from another origin, one without the CSRF header, and one that is not JSON (AC-4)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: {} }));

    const foreign = await post(mod.login, LOGIN, CREDENTIALS, {
      ...SAME_SITE,
      origin: "https://evil.example",
    });
    expect(foreign.status).toBe(403);
    expect((await foreign.json()).code).toBe("PERMISSION_DENIED");

    const crossSite = await post(mod.login, LOGIN, CREDENTIALS, {
      ...SAME_SITE,
      "sec-fetch-site": "cross-site",
    });
    expect(crossSite.status).toBe(403);

    const noHeader = await post(mod.login, LOGIN, CREDENTIALS, {
      host: "localhost:3000",
      "content-type": "application/json",
    });
    expect(noHeader.status).toBe(403);

    const form = await post(mod.login, LOGIN, CREDENTIALS, {
      ...SAME_SITE,
      "content-type": "application/x-www-form-urlencoded",
    });
    expect(form.status).toBe(415);

    expect(sent).toHaveLength(0);

    const own = await post(mod.login, LOGIN, CREDENTIALS, {
      ...SAME_SITE,
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
    });
    expect(own.status).not.toBe(403);
  });

  it("validates the body before sending anything on", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: {} }));

    for (const body of [
      { phone: "12", password: "x" },
      { phone: "911234567", password: "" },
      { ...CREDENTIALS, otp: "12" },
      { ...CREDENTIALS, extra: true },
      "not an object",
    ]) {
      const response = await post(mod.login, LOGIN, body);
      expect(response.status, JSON.stringify(body)).toBe(422);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    expect(sent).toHaveLength(0);
  });

  it("forwards the UI language, and Prism's Prefer under next dev only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const mod = await load();
    upstreamAnswers(() => ({
      status: 202,
      body: responseExample("/v1/auth/login", "post", 202),
    }));

    await post(mod.login, LOGIN, CREDENTIALS, {
      ...SAME_SITE,
      "accept-language": "am",
      prefer: "code=202",
    });
    expect(sent[0].headers.get("accept-language")).toBe("am");
    expect(sent[0].headers.get("prefer")).toBe("code=202");
  });
});

describe("GET /api/me", () => {
  it("without a cookie says guest, calling nothing (AC-8)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/me") }));

    const response = await get(mod.me, ME);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ player: null });
    expect(sent).toHaveLength(0);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("with a session answers the contract's profile, from the API, with the bearer token (AC-8)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/me") }));

    const response = await get(mod.me, ME, {
      host: "localhost:3000",
      cookie: cookieHeader(mod),
    });

    expect(response.status).toBe(200);
    const view = sessionViewSchema.parse(await response.json());
    expect(view).toEqual({ player: toPlayer(example("/v1/me")) });
    expect(sent.map(path)).toEqual(["/v1/me"]);
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(JSON.stringify(view)).not.toContain("eyJ.live.access");
  });

  it("refreshes on AUTH_TOKEN_EXPIRED, retries once and rotates the cookie (AC-5)", async () => {
    const mod = await load();
    const tokens = responseExample("/v1/auth/refresh", "post", 200) as Tokens;
    upstreamAnswers((request) => {
      if (path(request) === "/v1/auth/refresh")
        return { status: 200, body: tokens };
      return bearer(request) === tokens.access_token
        ? { status: 200, body: example("/v1/me") }
        : { status: 401, body: EXPIRED };
    });

    const response = await get(mod.me, ME, {
      host: "localhost:3000",
      cookie: cookieHeader(mod),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).player.id).toBe(
      "01J9A7R0000000000000000001",
    );
    expect(sent.map(path)).toEqual(["/v1/me", "/v1/auth/refresh", "/v1/me"]);
    const rotated = sessionCookieOf(mod, response);
    expect(rotated).toBeDefined();
    expect(mod.open(valueOf(rotated!))).toMatchObject({
      access: tokens.access_token,
      refresh: tokens.refresh_token,
    });
  });

  it("with a session that is gone clears the cookie and says guest", async () => {
    const mod = await load();
    upstreamAnswers((request) =>
      path(request) === "/v1/auth/refresh"
        ? {
            status: 401,
            body: responseExample("/v1/auth/refresh", "post", 401),
          }
        : { status: 401, body: EXPIRED },
    );

    const response = await get(mod.me, ME, {
      host: "localhost:3000",
      cookie: cookieHeader(mod),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ player: null });
    expect(sessionCookieOf(mod, response)).toMatch(/; Max-Age=0/);
  });

  it("passes other API errors through as Problems", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 503,
      body: responseExample("/v1/kyc/fayda/otp", "post", 503),
    }));
    const response = await get(mod.me, ME, {
      host: "localhost:3000",
      cookie: cookieHeader(mod),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
  });

  it("a forged X-Forwarded-Host does not change the tenant the session is sent to (AC-7)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/me") }));

    const response = await get(mod.me, ME, {
      host: "localhost:3000",
      "x-forwarded-host": "kelalsport.et",
      cookie: cookieHeader(mod, live("demo")),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).player).not.toBeNull();
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
  });

  it("behind a trusted proxy, a cookie sealed for another tenant is no session (AC-7)", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/me") }));

    const response = await get(mod.me, ME, {
      host: "web.internal:3000",
      "x-forwarded-host": "kelalsport.et",
      cookie: cookieHeader(mod, live("demo")),
    });

    expect(await response.json()).toEqual({ player: null });
    expect(sent).toHaveLength(0);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the session upstream and clears the cookie (AC-8)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 204 }));

    const response = await post(
      mod.logout,
      LOGOUT,
      {},
      {
        ...SAME_SITE,
        cookie: cookieHeader(mod),
      },
    );

    expect(response.status).toBe(204);
    expect(sent.map(path)).toEqual(["/v1/auth/logout"]);
    expect(sent[0].method).toBe("POST");
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sessionCookieOf(mod, response)).toMatch(/; Max-Age=0/);
  });

  it("clears the cookie even when the API refuses", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 401,
      body: responseExample("/v1/auth/logout", "post", 401),
    }));

    const response = await post(
      mod.logout,
      LOGOUT,
      {},
      {
        ...SAME_SITE,
        cookie: cookieHeader(mod),
      },
    );

    expect(response.status).toBe(204);
    expect(sessionCookieOf(mod, response)).toMatch(/; Max-Age=0/);
  });

  it("answers 204 with no cookie, calling nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 204 }));
    const response = await post(mod.logout, LOGOUT, {});
    expect(response.status).toBe(204);
    expect(sent).toHaveLength(0);
  });

  it("is protected like every POST (AC-4)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 204 }));
    const response = await post(
      mod.logout,
      LOGOUT,
      {},
      {
        host: "localhost:3000",
        "content-type": "application/json",
        cookie: cookieHeader(mod),
      },
    );
    expect(response.status).toBe(403);
    expect(sent).toHaveLength(0);
  });
});
