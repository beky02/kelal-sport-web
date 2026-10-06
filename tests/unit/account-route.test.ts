// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toPlayer } from "@/lib/api/mappers/auth";
import { toDeviceSessions } from "@/lib/api/mappers/account";
import type { components } from "@/lib/api/schema";
import { deviceSessionsSchema, sessionViewSchema } from "@/lib/api/schemas";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { example } from "../contract";

// Route handlers are server-only; the marker package refuses to load outside
// React's server build, which a unit test is not.
vi.mock("server-only", () => ({}));

type ApiMe = components["schemas"]["Me"];

/** A fresh module graph per test, so config and the refresh caches start clean. */
async function load() {
  vi.resetModules();
  const [me, sessions, one, session] = await Promise.all([
    import("@/app/api/me/route"),
    import("@/app/api/me/sessions/route"),
    import("@/app/api/me/sessions/[id]/route"),
    import("@/lib/server/session"),
  ]);
  return {
    patchMe: me.PATCH,
    readSessions: sessions.GET,
    revoke: one.DELETE,
    ...session,
  };
}
type Loaded = Awaited<ReturnType<typeof load>>;

/** Every request the route handler made upstream — the request log. */
let sent: Request[] = [];

function upstreamAnswers(
  answer: (request: Request) => { status: number; body?: unknown },
) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    sent.push(request);
    const { status, body } = answer(request);
    if (status === 204) return new Response(null, { status });
    return Response.json(body, {
      status,
      headers: {
        "Content-Type":
          status >= 400 ? "application/problem+json" : "application/json",
      },
    });
  });
}

const path = (request: Request) => new URL(request.url).pathname;
const bearer = (request: Request) =>
  request.headers.get("authorization")?.replace(/^Bearer /, "");

const ORIGIN = "http://localhost:3000";
const NOW = Date.parse("2026-10-05T09:00:00Z");

const live = () => ({
  tenant: "demo",
  access: "eyJ.live.access",
  refresh: "rt_live",
  expiresAt: NOW + 10 * 60_000,
});

/** The contract's player, as `PATCH /v1/me` answers after a change. */
const ME = (change: Partial<ApiMe> = {}): ApiMe => ({
  ...example("/v1/me"),
  ...change,
});
const SESSIONS = () => example("/v1/me/sessions");
const OTHER_DEVICE = "01J9A7S0000000000000000002";

const problem = (status: number, code: string, extra = {}) => ({
  type: `https://api.example.et/errors/${code.toLowerCase()}`,
  title: code,
  status,
  code,
  ...extra,
});

/** A read from this site's own page: the session cookie, nothing else. */
const reading = (mod: Loaded, extra: Record<string, string> = {}) => ({
  host: "localhost:3000",
  cookie: `${mod.SESSION_COOKIE}=${mod.seal(live())}`,
  ...extra,
});

/** What this site's own page sends with a body: CSRF header, JSON, the session. */
const sending = (mod: Loaded, extra: Record<string, string> = {}) => ({
  ...reading(mod),
  "content-type": "application/json",
  [CSRF_HEADER]: CSRF_VALUE,
  ...extra,
});

/** A DELETE from this site's own page: the CSRF header and the session, no body. */
const removing = (mod: Loaded, extra: Record<string, string> = {}) => ({
  ...reading(mod),
  [CSRF_HEADER]: CSRF_VALUE,
  ...extra,
});

const without = (h: Record<string, string>, name: string) =>
  Object.fromEntries(Object.entries(h).filter(([k]) => k !== name));

const patchMe = (
  mod: Loaded,
  value: unknown,
  headers: Record<string, string> = sending(mod),
) =>
  mod.patchMe(
    new Request(`${ORIGIN}/api/me`, {
      method: "PATCH",
      headers,
      body: typeof value === "string" ? value : JSON.stringify(value),
    }),
  );

const readSessions = (
  mod: Loaded,
  headers: Record<string, string> = reading(mod),
) => mod.readSessions(new Request(`${ORIGIN}/api/me/sessions`, { headers }));

const revoke = (
  mod: Loaded,
  id: string = OTHER_DEVICE,
  headers: Record<string, string> = removing(mod),
) =>
  mod.revoke(
    new Request(`${ORIGIN}/api/me/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    }),
    { params: Promise.resolve({ id }) },
  );

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

describe("PATCH /api/me (AC-8)", () => {
  it("sends only the changed fields to PATCH /v1/me and answers with the account (AC-8)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: ME({ language: "en", marketing_consent: true }),
    }));

    const response = await patchMe(mod, { language: "en" });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    // The account as the API now has it, in `/api/me`'s own shape.
    expect(sessionViewSchema.parse(await response.json())).toEqual({
      player: toPlayer(ME({ language: "en", marketing_consent: true })),
    });
    expect(sent.map((r) => `${r.method} ${path(r)}`)).toEqual(["PATCH /v1/me"]);
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(await sent[0].json()).toEqual({ language: "en" });
  });

  it("sends the consent as the contract names it and answers what the API kept, not what was asked", async () => {
    const mod = await load();
    // The API keeps marketing off (a player on a break, say): that is the
    // account's consent, whatever the browser asked for.
    upstreamAnswers(() => ({
      status: 200,
      body: ME({ marketing_consent: false }),
    }));

    const response = await patchMe(mod, { marketingConsent: true });

    expect(await sent[0].json()).toEqual({ marketing_consent: true });
    const { player } = sessionViewSchema.parse(await response.json());
    expect(player?.marketingConsent).toBe(false);
  });

  it("refuses a body the contract doesn't allow before anything goes upstream", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: ME() }));

    for (const value of [
      {},
      { language: "fr" },
      { marketingConsent: "yes" },
      { language: "en", phone: "+251900000000" },
      { language: "en", realityCheckMinutes: 5 },
      "not json",
    ]) {
      const response = await patchMe(mod, value);
      expect(response.status, JSON.stringify(value)).toBe(422);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    expect(sent).toHaveLength(0);
  });

  it("refuses a cross-site PATCH and one without the CSRF header", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: ME() }));

    for (const headers of [
      sending(mod, { "sec-fetch-site": "cross-site" }),
      sending(mod, { origin: "https://evil.example" }),
      without(sending(mod), CSRF_HEADER),
    ]) {
      const response = await patchMe(mod, { language: "en" }, headers);
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("PERMISSION_DENIED");
    }
    const form = await patchMe(
      mod,
      "language=en",
      sending(mod, { "content-type": "application/x-www-form-urlencoded" }),
    );
    expect(form.status).toBe(415);
    expect(sent).toHaveLength(0);
  });

  it("answers 401 without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: ME() }));

    const response = await patchMe(
      mod,
      { language: "en" },
      without(sending(mod), "cookie"),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sent).toHaveLength(0);
  });

  it("passes the API's refusal through by its code", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 422,
      body: problem(422, "VALIDATION_FAILED", {
        errors: [{ field: "language", code: "VALIDATION_FAILED" }],
      }),
    }));

    const response = await patchMe(mod, { language: "am" });

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("VALIDATION_FAILED");
  });
});

describe("GET /api/me/sessions (AC-9)", () => {
  it("maps the API's devices, this one marked, never cached (AC-9)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: SESSIONS() }));

    const response = await readSessions(mod);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(deviceSessionsSchema.parse(await response.json())).toEqual(
      toDeviceSessions(SESSIONS().items),
    );
    expect(sent.map((r) => `${r.method} ${path(r)}`)).toEqual([
      "GET /v1/me/sessions",
    ]);
    expect(bearer(sent[0])).toBe("eyJ.live.access");
  });

  it("answers 401 without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: SESSIONS() }));

    const response = await readSessions(mod, { host: "localhost:3000" });

    expect(response.status).toBe(401);
    expect(sent).toHaveLength(0);
  });
});

describe("DELETE /api/me/sessions/{id} (AC-9)", () => {
  it("answers 204 when the API signed the device out (AC-9)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 204 }));

    const response = await revoke(mod);

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(sent.map((r) => `${r.method} ${path(r)}`)).toEqual([
      `DELETE /v1/me/sessions/${OTHER_DEVICE}`,
    ]);
    expect(bearer(sent[0])).toBe("eyJ.live.access");
  });

  it("refuses an id that can't be one before it reaches the upstream path", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 204 }));

    for (const id of ["../wallet", "a/b", "x".repeat(65), "", "%2e%2e"]) {
      const response = await revoke(mod, id);
      expect(response.status, id).toBe(404);
    }
    expect(sent).toHaveLength(0);
  });

  it("refuses a cross-site DELETE, one without the CSRF header and a guest", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 204 }));

    for (const headers of [
      removing(mod, { "sec-fetch-site": "cross-site" }),
      without(removing(mod), CSRF_HEADER),
    ]) {
      const response = await revoke(mod, OTHER_DEVICE, headers);
      expect(response.status).toBe(403);
    }
    const guest = await revoke(
      mod,
      OTHER_DEVICE,
      without(removing(mod), "cookie"),
    );
    expect(guest.status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it("passes the API's 404 through for a device that isn't the player's", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 404, body: problem(404, "NOT_FOUND") }));

    const response = await revoke(mod);

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("NOT_FOUND");
  });
});

describe("Prefer and the real API", () => {
  it("forwards Prism's Prefer under next dev only", async () => {
    const mod = await load();
    upstreamAnswers((upstream) =>
      upstream.method === "PATCH"
        ? { status: 200, body: ME() }
        : upstream.method === "DELETE"
          ? { status: 204 }
          : { status: 200, body: SESSIONS() },
    );
    const prefer = "code=404";

    vi.stubEnv("NODE_ENV", "development");
    await patchMe(mod, { language: "en" }, sending(mod, { prefer }));
    await readSessions(mod, reading(mod, { prefer }));
    await revoke(mod, OTHER_DEVICE, removing(mod, { prefer }));
    vi.stubEnv("NODE_ENV", "test");
    await readSessions(mod, reading(mod, { prefer }));

    expect(sent.map((r) => r.headers.get("prefer"))).toEqual([
      prefer,
      prefer,
      prefer,
      null,
    ]);
  });

  it("never sends Prefer to the real API, even under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("API_REAL_URL", "http://real.test");
    vi.stubEnv("API_REAL_TAGS", "Me");
    const mod = await load();
    upstreamAnswers((upstream) =>
      upstream.method === "PATCH"
        ? { status: 200, body: ME() }
        : upstream.method === "DELETE"
          ? { status: 204 }
          : { status: 200, body: SESSIONS() },
    );
    const prefer = { prefer: "code=422" };

    await patchMe(mod, { language: "en" }, sending(mod, prefer));
    await readSessions(mod, reading(mod, prefer));
    await revoke(mod, OTHER_DEVICE, removing(mod, prefer));

    expect(sent).toHaveLength(3);
    expect(new Set(sent.map((r) => new URL(r.url).host))).toEqual(
      new Set(["real.test"]),
    );
    expect(sent.map((r) => r.headers.get("prefer"))).toEqual([
      null,
      null,
      null,
    ]);
  });
});
