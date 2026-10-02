// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { example, responseExample } from "../contract";

// Server-only modules refuse to load outside React's server build.
vi.mock("server-only", () => ({}));

type SessionModule = typeof import("@/lib/server/session");
type UpstreamModule = typeof import("@/lib/server/upstream");

/** A fresh module graph per test: the refresh caches are module state. */
async function load(): Promise<SessionModule & UpstreamModule> {
  vi.resetModules();
  const [session, upstream] = await Promise.all([
    import("@/lib/server/session"),
    import("@/lib/server/upstream"),
  ]);
  return { ...session, ...upstream };
}

const ME = () => example("/v1/me");
const TOKENS = () => responseExample("/v1/auth/refresh", "post", 200);
const EXPIRED = {
  type: "https://api.example.et/errors/token-expired",
  title: "Session expired",
  status: 401,
  code: "AUTH_TOKEN_EXPIRED",
};
const INVALID = responseExample("/v1/auth/refresh", "post", 401);

let sent: Request[] = [];

/** Answers each upstream call from `answer`, recording what was sent. */
function upstreamAnswers(
  answer: (
    request: Request,
    body: unknown,
  ) => { status: number; body?: unknown },
) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const body =
      request.method === "POST" ? await request.clone().json() : undefined;
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

const NOW = Date.parse("2026-10-03T09:00:00Z");

function ctxFor(mod: SessionModule, url = "http://localhost:3000/api/me") {
  const cookies: string[] = [];
  const request = new Request(url, { headers: { host: "localhost:3000" } });
  const ctx: Parameters<typeof mod.withSession>[0] = {
    tenant: "demo",
    lang: "en",
    request,
    setCookie: (header) => cookies.push(header),
  };
  return { ctx, cookies, request };
}

const live = (tenant = "demo") => ({
  tenant,
  access: "eyJ.live.access",
  refresh: "rt_live",
  expiresAt: NOW + 10 * 60_000,
});

beforeEach(() => {
  sent = [];
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.stubEnv("TENANT_HOST_MAP", "localhost=demo,kelalsport.et=kelal");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("the sealed session cookie", () => {
  it("seals and opens a session, and shows no token in the cookie value", async () => {
    const { seal, open } = await load();
    const sealed = seal(live());
    expect(sealed).not.toContain("eyJ.live.access");
    expect(sealed).not.toContain("rt_live");
    expect(open(sealed)).toEqual(live());
  });

  it("opens a tampered cookie to nothing", async () => {
    const { seal, open } = await load();
    const sealed = seal(live());
    const flipped =
      sealed.slice(0, -2) + (sealed.endsWith("A") ? "B" : "A") + sealed.at(-1);
    expect(open(flipped)).toBeNull();
    expect(open("not-a-cookie")).toBeNull();
    expect(open("")).toBeNull();
  });

  it("reads the session from the Cookie header for its own tenant only (AC-7)", async () => {
    const { seal, readSession, SESSION_COOKIE } = await load();
    const request = new Request("http://localhost:3000/api/me", {
      headers: { cookie: `other=1; ${SESSION_COOKIE}=${seal(live("demo"))}` },
    });
    expect(readSession(request, "demo")).toEqual(live("demo"));
    // Tenant A's session must never be sent with tenant B's X-Tenant-Id.
    expect(readSession(request, "kelal")).toBeNull();
    expect(
      readSession(new Request("http://localhost:3000/api/me"), "demo"),
    ).toBeNull();
  });

  it("is httpOnly, SameSite=Lax, site-wide and lives 30 days; Secure follows the request outside production", async () => {
    const { sessionCookie, clearSessionCookie, SESSION_COOKIE } = await load();
    const plain = sessionCookie(
      live(),
      new Request("http://localhost:3000/api/auth/login"),
    );
    expect(plain.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    expect(plain).toMatch(/; HttpOnly/);
    expect(plain).toMatch(/; SameSite=Lax/);
    expect(plain).toMatch(/; Path=\//);
    expect(plain).toMatch(/; Max-Age=2592000/);
    expect(plain).not.toMatch(/; Secure/);

    const https = sessionCookie(
      live(),
      new Request("https://kelalsport.et/api/auth/login"),
    );
    expect(https).toMatch(/; Secure/);

    const cleared = clearSessionCookie(
      new Request("http://localhost:3000/api/auth/logout"),
    );
    expect(cleared).toMatch(new RegExp(`^${SESSION_COOKIE}=; `));
    expect(cleared).toMatch(/; Max-Age=0/);
    expect(cleared).toMatch(/; HttpOnly/);
  });

  it("is always Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "a".repeat(48));
    const { sessionCookie } = await load();
    expect(
      sessionCookie(live(), new Request("http://internal:3000/api/auth/login")),
    ).toMatch(/; Secure/);
  });

  it("turns the API's tokens into a session that expires when the access token does", async () => {
    const { sessionFromTokens } = await load();
    const tokens = TOKENS() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    expect(sessionFromTokens("demo", tokens, NOW)).toEqual({
      tenant: "demo",
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      expiresAt: NOW + tokens.expires_in * 1000,
    });
  });
});

describe("the device cookie", () => {
  it("mints an id once, in an httpOnly cookie, and keeps it afterwards", async () => {
    const { ensureDevice, DEVICE_COOKIE } = await load();
    const cookies: string[] = [];
    const id = ensureDevice(
      new Request("http://localhost:3000/api/auth/login"),
      (h) => cookies.push(h),
    );
    // Contract request 004's shape for X-Client-Device.
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(new RegExp(`^${DEVICE_COOKIE}=${id}; `));
    expect(cookies[0]).toMatch(/; HttpOnly/);
    expect(cookies[0]).toMatch(/; Max-Age=31536000/);

    const again: string[] = [];
    const kept = ensureDevice(
      new Request("http://localhost:3000/api/auth/login", {
        headers: { cookie: `${DEVICE_COOKIE}=${id}` },
      }),
      (h) => again.push(h),
    );
    expect(kept).toBe(id);
    expect(again).toHaveLength(0);
  });

  it("replaces a device cookie that is not one", async () => {
    const { ensureDevice, DEVICE_COOKIE } = await load();
    const cookies: string[] = [];
    const id = ensureDevice(
      new Request("http://localhost:3000/api/auth/login", {
        headers: { cookie: `${DEVICE_COOKIE}=<script>` },
      }),
      (h) => cookies.push(h),
    );
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(cookies).toHaveLength(1);
  });
});

describe("withSession: refresh on AUTH_TOKEN_EXPIRED (AC-5)", () => {
  const me =
    (
      mod: SessionModule & UpstreamModule,
      ctx: Parameters<SessionModule["withSession"]>[0],
    ) =>
    (authorization: string) =>
      mod.upstream("Me", { ...ctx, authorization }).GET("/v1/me");

  it("refreshes an expired access token once, retries once and rotates the cookie", async () => {
    const mod = await load();
    const { ctx, cookies } = ctxFor(mod);
    const tokens = TOKENS() as { access_token: string; refresh_token: string };
    upstreamAnswers((request) => {
      if (path(request) === "/v1/auth/refresh")
        return { status: 200, body: tokens };
      return bearer(request) === "eyJ.live.access"
        ? { status: 401, body: EXPIRED }
        : { status: 200, body: ME() };
    });

    const result = await mod.withSession(ctx, live(), me(mod, ctx));

    expect(result).toEqual(ME());
    expect(sent.map(path)).toEqual(["/v1/me", "/v1/auth/refresh", "/v1/me"]);
    expect(await sent[1].json()).toEqual({ refresh_token: "rt_live" });
    expect(sent[1].headers.get("authorization")).toBeNull();
    expect(bearer(sent[2])).toBe(tokens.access_token);
    expect(sent.every((r) => r.headers.get("x-tenant-id") === "demo")).toBe(
      true,
    );

    expect(cookies).toHaveLength(1);
    const rotated = mod.open(cookies[0].split(";")[0].split("=")[1]);
    expect(rotated).toMatchObject({
      tenant: "demo",
      access: tokens.access_token,
      refresh: tokens.refresh_token,
    });
  });

  it("makes one refresh for parallel calls on the same session", async () => {
    const mod = await load();
    const { ctx } = ctxFor(mod);
    const tokens = TOKENS() as { access_token: string };
    upstreamAnswers((request) => {
      if (path(request) === "/v1/auth/refresh")
        return { status: 200, body: tokens };
      return bearer(request) === tokens.access_token
        ? { status: 200, body: ME() }
        : { status: 401, body: EXPIRED };
    });

    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        mod.withSession(ctx, live(), me(mod, ctx)),
      ),
    );

    expect(results).toEqual([ME(), ME(), ME()]);
    expect(sent.map(path).filter((p) => p === "/v1/auth/refresh")).toHaveLength(
      1,
    );
  });

  it("reuses a recent rotation for a request still carrying the old cookie", async () => {
    const mod = await load();
    const first = ctxFor(mod);
    const tokens = TOKENS() as { access_token: string };
    upstreamAnswers((request) => {
      if (path(request) === "/v1/auth/refresh")
        return { status: 200, body: tokens };
      return bearer(request) === tokens.access_token
        ? { status: 200, body: ME() }
        : { status: 401, body: EXPIRED };
    });
    await mod.withSession(first.ctx, live(), me(mod, first.ctx));
    sent = [];

    // The browser has not yet received the rotated cookie.
    const second = ctxFor(mod);
    const result = await mod.withSession(
      second.ctx,
      live(),
      me(mod, second.ctx),
    );

    expect(result).toEqual(ME());
    expect(sent.map(path)).toEqual(["/v1/me"]);
    expect(bearer(sent[0])).toBe(tokens.access_token);
    expect(second.cookies).toHaveLength(1);
  });

  it("refreshes before the call when the access token has lapsed", async () => {
    const mod = await load();
    const { ctx } = ctxFor(mod);
    const tokens = TOKENS() as { access_token: string };
    upstreamAnswers((request) =>
      path(request) === "/v1/auth/refresh"
        ? { status: 200, body: tokens }
        : { status: 200, body: ME() },
    );

    await mod.withSession(
      ctx,
      { ...live(), expiresAt: NOW - 1000 },
      me(mod, ctx),
    );

    expect(sent.map(path)).toEqual(["/v1/auth/refresh", "/v1/me"]);
    expect(bearer(sent[1])).toBe(tokens.access_token);
  });

  it("gives up and clears the cookie when the refresh is refused", async () => {
    const mod = await load();
    const { ctx, cookies } = ctxFor(mod);
    upstreamAnswers((request) =>
      path(request) === "/v1/auth/refresh"
        ? { status: 401, body: INVALID }
        : { status: 401, body: EXPIRED },
    );

    await expect(
      mod.withSession(ctx, live(), me(mod, ctx)),
    ).rejects.toBeInstanceOf(mod.SessionGoneError);
    expect(sent.map(path)).toEqual(["/v1/me", "/v1/auth/refresh"]);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/; Max-Age=0/);
  });

  it("treats any other 401 as a session that is gone, without a refresh", async () => {
    const mod = await load();
    const { ctx, cookies } = ctxFor(mod);
    upstreamAnswers(() => ({ status: 401, body: INVALID }));

    await expect(
      mod.withSession(ctx, live(), me(mod, ctx)),
    ).rejects.toBeInstanceOf(mod.SessionGoneError);
    expect(sent.map(path)).toEqual(["/v1/me"]);
    expect(cookies[0]).toMatch(/; Max-Age=0/);
  });

  it("passes every other error through untouched", async () => {
    const mod = await load();
    const { ctx, cookies } = ctxFor(mod);
    const forbidden = responseExample("/v1/withdrawals", "post", 403);
    upstreamAnswers(() => ({ status: 403, body: forbidden }));

    const failure = await mod
      .withSession(ctx, live(), me(mod, ctx))
      .catch((e) => e);
    expect(failure).toBeInstanceOf(mod.UpstreamError);
    expect(failure.status).toBe(403);
    expect(failure.problem).toEqual(forbidden);
    expect(sent.map(path)).toEqual(["/v1/me"]);
    expect(cookies).toHaveLength(0);
  });

  it("never forwards Prism's Prefer to the refresh call", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const mod = await load();
    const { ctx } = ctxFor(mod);
    const tokens = TOKENS() as { access_token: string };
    upstreamAnswers((request) => {
      if (path(request) === "/v1/auth/refresh")
        return { status: 200, body: tokens };
      return bearer(request) === tokens.access_token
        ? { status: 200, body: ME() }
        : { status: 401, body: EXPIRED };
    });

    await mod.withSession({ ...ctx, prefer: "code=401" }, live(), me(mod, ctx));

    const refresh = sent.find((r) => path(r) === "/v1/auth/refresh")!;
    expect(refresh.headers.get("prefer")).toBeNull();
  });
});
