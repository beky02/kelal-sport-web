// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api/schema";
import {
  toExclusion,
  toLimit,
  toLimits,
} from "@/lib/api/mappers/responsible-gambling";
import {
  exclusionSchema,
  rgLimitSchema,
  rgLimitsSchema,
} from "@/lib/api/schemas";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { example, requestExample, responseExample } from "../contract";

// Route handlers are server-only; the marker package refuses to load outside
// React's server build, which a unit test is not.
vi.mock("server-only", () => ({}));

type ApiLimit = components["schemas"]["RgLimit"];
type ApiExclusion = components["schemas"]["Exclusion"];

/** A fresh module graph per test, so config and the refresh caches start clean. */
async function load() {
  vi.resetModules();
  const [limits, exclusion, session] = await Promise.all([
    import("@/app/api/me/limits/route"),
    import("@/app/api/me/self-exclusion/route"),
    import("@/lib/server/session"),
  ]);
  return {
    readLimits: limits.GET,
    putLimit: limits.PUT,
    exclude: exclusion.POST,
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

const LIMITS = () => example("/v1/me/limits");
const SET = () => responseExample("/v1/me/limits", "put", 200) as ApiLimit;
const STARTED = () =>
  responseExample("/v1/me/self-exclusion", "post", 201) as ApiExclusion;

/** What the RG page asks to set: a weekly deposit limit. */
const DEPOSIT_LIMIT = { type: "deposit", period: "week", amount: "2000.00" };
/** …and a break. */
const BREAK = { kind: "time_out", duration: "7d" };

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

const without = (h: Record<string, string>, name: string) =>
  Object.fromEntries(Object.entries(h).filter(([k]) => k !== name));

const body = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value);

const readLimits = (
  mod: Loaded,
  headers: Record<string, string> = reading(mod),
) => mod.readLimits(new Request(`${ORIGIN}/api/me/limits`, { headers }));

const putLimit = (
  mod: Loaded,
  value: unknown = DEPOSIT_LIMIT,
  headers: Record<string, string> = sending(mod),
) =>
  mod.putLimit(
    new Request(`${ORIGIN}/api/me/limits`, {
      method: "PUT",
      headers,
      body: body(value),
    }),
  );

const exclude = (
  mod: Loaded,
  value: unknown = BREAK,
  headers: Record<string, string> = sending(mod),
) =>
  mod.exclude(
    new Request(`${ORIGIN}/api/me/self-exclusion`, {
      method: "POST",
      headers,
      body: body(value),
    }),
  );

const sessionCookieOf = (mod: Loaded, response: Response) =>
  response.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${mod.SESSION_COOKIE}=`));

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

describe("GET /api/me/limits (AC-1)", () => {
  it("reads the player's limits from /v1/me/limits with their session, never cached (AC-1)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: LIMITS() }));

    const response = await readLimits(mod);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(rgLimitsSchema.parse(await response.json())).toEqual(
      toLimits(LIMITS().items),
    );
    expect(sent.map((r) => `${r.method} ${path(r)}`)).toEqual([
      "GET /v1/me/limits",
    ]);
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
  });

  it("reads another tenant's player under that tenant", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: LIMITS() }));

    const response = await readLimits(mod, {
      host: "kelalsport.et",
      cookie: `${mod.SESSION_COOKIE}=${mod.seal({ ...live(), tenant: "kelal" })}`,
    });

    expect(response.status).toBe(200);
    expect(sent[0].headers.get("x-tenant-id")).toBe("kelal");
  });

  it("answers 401 AUTH_TOKEN_EXPIRED without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: LIMITS() }));

    const response = await readLimits(mod, { host: "localhost:3000" });

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sent).toHaveLength(0);
  });
});

describe("PUT /api/me/limits (AC-5)", () => {
  it("sends a money limit as the contract's RgLimitSet and answers the API's limit (AC-5)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: SET() }));

    const response = await putLimit(mod);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    // The API's answer as it came: here the increase it holds back, and when
    // it applies — the browser never works out which it is.
    expect(rgLimitSchema.parse(await response.json())).toEqual(toLimit(SET()));
    expect(sent.map((r) => `${r.method} ${path(r)}`)).toEqual([
      "PUT /v1/me/limits",
    ]);
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(await sent[0].json()).toEqual(
      requestExample("/v1/me/limits", "put"),
    );
  });

  it("sends a time limit in minutes, never amount null", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: { ...LIMITS().items[1], minutes: 90 },
    }));

    const response = await putLimit(mod, {
      type: "session_minutes",
      period: "day",
      minutes: 90,
    });

    expect(response.status).toBe(200);
    expect(await sent[0].json()).toEqual({
      type: "session_minutes",
      period: "day",
      minutes: 90,
    });
  });

  it("refuses a body that is not a limit, before sending anything", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: SET() }));

    for (const value of [
      { ...DEPOSIT_LIMIT, amount: "0.00" },
      { ...DEPOSIT_LIMIT, amount: "2000" },
      { ...DEPOSIT_LIMIT, amount: 2000 },
      // Removing a limit is not offered here (plan decision 5).
      { ...DEPOSIT_LIMIT, amount: null },
      { ...DEPOSIT_LIMIT, period: "year" },
      { ...DEPOSIT_LIMIT, type: "withdrawal" },
      { ...DEPOSIT_LIMIT, minutes: 60 },
      { type: "session_minutes", period: "day", minutes: 0 },
      { type: "session_minutes", period: "day", minutes: 60, amount: null },
      { type: "deposit", period: "week" },
      null,
      "not json",
    ]) {
      const response = await putLimit(mod, value);
      expect(response.status, JSON.stringify(value)).toBe(422);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    expect(sent).toHaveLength(0);
  });

  it("refuses a limit from another site, without the CSRF header, or not in JSON", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: SET() }));

    expect(
      (
        await putLimit(
          mod,
          DEPOSIT_LIMIT,
          sending(mod, { origin: "https://evil.example" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await putLimit(
          mod,
          DEPOSIT_LIMIT,
          sending(mod, { "sec-fetch-site": "cross-site" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await putLimit(mod, DEPOSIT_LIMIT, without(sending(mod), CSRF_HEADER)))
        .status,
    ).toBe(403);
    expect(
      (
        await putLimit(
          mod,
          "type=deposit&period=week&amount=2000.00",
          sending(mod, { "content-type": "application/x-www-form-urlencoded" }),
        )
      ).status,
    ).toBe(415);
    expect(sent).toHaveLength(0);
  });

  it("refuses a body far bigger than any limit, before reading it all", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: SET() }));

    const response = await putLimit(mod, {
      ...DEPOSIT_LIMIT,
      note: "x".repeat(8000),
    });

    expect(response.status).toBe(413);
    expect(sent).toHaveLength(0);
  });

  it("passes the API's 422 through with the contract's fields only", async () => {
    const mod = await load();
    const contract = problem(422, "VALIDATION_FAILED", {
      detail: "A limit can't be lowered below what you've already used.",
      errors: [{ field: "amount", code: "MIN", limit: "500.00" }],
    });
    // Anything the API adds beyond the contract's fields stays on the server.
    upstreamAnswers(() => ({
      status: 422,
      body: { ...contract, internal: "dropped" },
    }));

    const response = await putLimit(mod);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(contract);
  });

  it("answers 401 AUTH_TOKEN_EXPIRED without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: SET() }));

    const response = await putLimit(
      mod,
      DEPOSIT_LIMIT,
      without(sending(mod), "cookie"),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sent).toHaveLength(0);
  });
});

describe("POST /api/me/self-exclusion (AC-6)", () => {
  it("starts a break with the player's session, answers 201 and clears the session cookie (AC-6)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: STARTED() }));

    const response = await exclude(mod);

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(exclusionSchema.parse(await response.json())).toEqual(
      toExclusion(STARTED()),
    );
    expect(sent.map((r) => `${r.method} ${path(r)}`)).toEqual([
      "POST /v1/me/self-exclusion",
    ]);
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(await sent[0].json()).toEqual(
      requestExample("/v1/me/self-exclusion", "post"),
    );
    // The API revoked every session: this server forgets the player's too.
    expect(sessionCookieOf(mod, response)).toMatch(/; Max-Age=0/);
  });

  it("sends a permanent self-exclusion as the contract has it", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 201,
      body: {
        kind: "self_exclusion",
        starts_at: STARTED().starts_at,
        ends_at: null,
      },
    }));

    const response = await exclude(mod, {
      kind: "self_exclusion",
      duration: "permanent",
    });

    expect(response.status).toBe(201);
    expect((await response.json()).endsAt).toBeNull();
    expect(await sent[0].json()).toEqual({
      kind: "self_exclusion",
      duration: "permanent",
    });
  });

  it("keeps the session when the API refused the break: nothing started", async () => {
    const mod = await load();
    const refused = problem(422, "VALIDATION_FAILED");
    upstreamAnswers(() => ({ status: 422, body: refused }));

    const response = await exclude(mod);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(refused);
    expect(sessionCookieOf(mod, response)).toBeUndefined();
  });

  it("refuses a kind or duration the contract doesn't have, before sending anything", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: STARTED() }));

    for (const value of [
      { kind: "operator_exclusion", duration: "7d" },
      { kind: "time_out", duration: "2d" },
      { kind: "time_out", duration: 7 },
      { kind: "time_out" },
      { ...BREAK, ends_at: "2026-10-06T00:00:00Z" },
      null,
      "not json",
    ]) {
      const response = await exclude(mod, value);
      expect(response.status, JSON.stringify(value)).toBe(422);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    expect(sent).toHaveLength(0);
  });

  it("refuses a break asked for from another site, without the CSRF header, or not in JSON", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: STARTED() }));

    expect(
      (
        await exclude(
          mod,
          BREAK,
          sending(mod, { origin: "https://evil.example" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await exclude(mod, BREAK, without(sending(mod), CSRF_HEADER))).status,
    ).toBe(403);
    expect(
      (
        await exclude(
          mod,
          "kind=time_out&duration=7d",
          sending(mod, { "content-type": "application/x-www-form-urlencoded" }),
        )
      ).status,
    ).toBe(415);
    expect(sent).toHaveLength(0);
  });

  it("answers 401 AUTH_TOKEN_EXPIRED without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: STARTED() }));

    const response = await exclude(mod, BREAK, without(sending(mod), "cookie"));

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sent).toHaveLength(0);
  });

  it("answers 401 and clears the cookie when the API no longer honours the session", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 401,
      body: problem(401, "AUTH_INVALID_CREDENTIALS"),
    }));

    const response = await exclude(mod);

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sessionCookieOf(mod, response)).toMatch(/; Max-Age=0/);
  });
});

describe("Prefer and the real API", () => {
  it("forwards Prism's Prefer under next dev only", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: LIMITS() }));
    const prefer = "code=401";

    vi.stubEnv("NODE_ENV", "development");
    await readLimits(mod, reading(mod, { prefer }));
    await putLimit(mod, DEPOSIT_LIMIT, sending(mod, { prefer }));
    await exclude(mod, BREAK, sending(mod, { prefer }));
    vi.stubEnv("NODE_ENV", "test");
    await readLimits(mod, reading(mod, { prefer }));

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
    vi.stubEnv("API_REAL_TAGS", "Responsible gambling");
    const mod = await load();
    upstreamAnswers((upstream) =>
      upstream.method === "GET"
        ? { status: 200, body: LIMITS() }
        : upstream.method === "PUT"
          ? { status: 200, body: SET() }
          : { status: 201, body: STARTED() },
    );
    const prefer = { prefer: "code=422" };

    await readLimits(mod, reading(mod, prefer));
    await putLimit(mod, DEPOSIT_LIMIT, sending(mod, prefer));
    await exclude(mod, BREAK, sending(mod, prefer));

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
