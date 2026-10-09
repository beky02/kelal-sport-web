// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  toMyBonuses,
  toPromotions,
  toRedeemResult,
} from "@/lib/api/mappers/promotions";
import {
  myBonusesSchema,
  promotionsSchema,
  redeemResultSchema,
} from "@/lib/api/promotion-schemas";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { example } from "../contract";

// Route handlers are server-only; the marker package refuses to load outside
// React's server build, which a unit test is not.
vi.mock("server-only", () => ({}));

/** A fresh module graph per test, so config and the refresh caches start clean. */
async function load() {
  vi.resetModules();
  const [promotions, bonuses, redeem, session] = await Promise.all([
    import("@/app/api/promotions/route"),
    import("@/app/api/me/bonuses/route"),
    import("@/app/api/promo-codes/redeem/route"),
    import("@/lib/server/session"),
  ]);
  return {
    readOffers: promotions.GET,
    readBonuses: bonuses.GET,
    redeem: redeem.POST,
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
const NOW = Date.parse("2026-10-09T09:00:00Z");
const KEY = "3f0c8b8e-6a3d-4c1e-9d0f-1b2a3c4d5e6f";

const live = () => ({
  tenant: "demo",
  access: "eyJ.live.access",
  refresh: "rt_live",
  expiresAt: NOW + 10 * 60_000,
});

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

/** A redeem from this site's own page: CSRF header, JSON, the key, the session. */
const sending = (mod: Loaded, extra: Record<string, string> = {}) => ({
  ...reading(mod),
  "content-type": "application/json",
  [CSRF_HEADER]: CSRF_VALUE,
  "idempotency-key": KEY,
  ...extra,
});

const without = (h: Record<string, string>, name: string) =>
  Object.fromEntries(Object.entries(h).filter(([k]) => k !== name));

const readOffers = (
  mod: Loaded,
  headers: Record<string, string> = reading(mod),
) => mod.readOffers(new Request(`${ORIGIN}/api/promotions`, { headers }));

const readBonuses = (
  mod: Loaded,
  headers: Record<string, string> = reading(mod),
) => mod.readBonuses(new Request(`${ORIGIN}/api/me/bonuses`, { headers }));

const redeem = (
  mod: Loaded,
  value: unknown = { code: "DERBY50" },
  headers: Record<string, string> = sending(mod),
) =>
  mod.redeem(
    new Request(`${ORIGIN}/api/promo-codes/redeem`, {
      method: "POST",
      headers,
      body: typeof value === "string" ? value : JSON.stringify(value),
    }),
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

describe("GET /api/promotions (AC-11)", () => {
  it("reads the offers in the UI's language without the player's session", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/promotions") }));

    const response = await readOffers(
      mod,
      reading(mod, { "accept-language": "am" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(promotionsSchema.parse(await response.json())).toEqual(
      toPromotions(example("/v1/promotions").items),
    );
    expect(sent.map((r) => `${r.method} ${path(r)}`)).toEqual([
      "GET /v1/promotions",
    ]);
    expect(sent[0].headers.get("accept-language")).toBe("am");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    // A public read: the player's token never goes with it.
    expect(sent[0].headers.get("authorization")).toBeNull();
  });

  it("answers a guest too", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/promotions") }));

    const response = await readOffers(mod, { host: "localhost:3000" });

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it("says the API couldn't be reached as a Problem, never a page", async () => {
    const mod = await load();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await readOffers(mod);

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("SERVICE_UNAVAILABLE");
  });
});

describe("GET /api/me/bonuses (AC-11)", () => {
  it("reads the player's bonus and free bets with their session", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/me/bonuses") }));

    const response = await readBonuses(mod);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(myBonusesSchema.parse(await response.json())).toEqual(
      toMyBonuses(example("/v1/me/bonuses")),
    );
    expect(sent.map((r) => `${r.method} ${path(r)}`)).toEqual([
      "GET /v1/me/bonuses",
    ]);
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
  });

  it("answers 401 without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/me/bonuses") }));

    const response = await readBonuses(mod, { host: "localhost:3000" });

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

    const response = await readBonuses(mod);

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("forwards Prism's Prefer under next dev only", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/me/bonuses") }));
    const prefer = { prefer: "code=401" };

    vi.stubEnv("NODE_ENV", "development");
    await readBonuses(mod, reading(mod, prefer));
    vi.stubEnv("NODE_ENV", "test");
    await readBonuses(mod, reading(mod, prefer));

    expect(sent.map((r) => r.headers.get("prefer"))).toEqual([
      "code=401",
      null,
    ]);
  });
});

describe("POST /api/promo-codes/redeem (AC-12)", () => {
  it("forwards the browser's Idempotency-Key and the code to POST /v1/promo-codes/redeem", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: { result: "granted", message: "50 ETB free bet added" },
    }));

    const response = await redeem(mod, { code: "DERBY50" });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(redeemResultSchema.parse(await response.json())).toEqual(
      toRedeemResult({ result: "granted", message: "50 ETB free bet added" }),
    );
    expect(sent.map((r) => `${r.method} ${path(r)}`)).toEqual([
      "POST /v1/promo-codes/redeem",
    ]);
    expect(sent[0].headers.get("idempotency-key")).toBe(KEY);
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(await sent[0].json()).toEqual({ code: "DERBY50" });
  });

  it("refuses a redeem without a key, from another site, without the CSRF header, or with a body other than a code, sending nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: { result: "granted" } }));

    for (const headers of [
      without(sending(mod), "idempotency-key"),
      sending(mod, { "idempotency-key": "not-a-uuid" }),
    ]) {
      const response = await redeem(mod, { code: "DERBY50" }, headers);
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    for (const headers of [
      sending(mod, { "sec-fetch-site": "cross-site" }),
      sending(mod, { origin: "https://evil.example" }),
      without(sending(mod), CSRF_HEADER),
    ]) {
      const response = await redeem(mod, { code: "DERBY50" }, headers);
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("PERMISSION_DENIED");
    }
    const form = await redeem(
      mod,
      "code=DERBY50",
      sending(mod, { "content-type": "application/x-www-form-urlencoded" }),
    );
    expect(form.status).toBe(415);
    for (const value of [
      {},
      { code: "" },
      { code: "x".repeat(33) },
      { code: 50 },
      { code: "DERBY50", player_id: "someone-else" },
      "not json",
    ]) {
      const response = await redeem(mod, value);
      expect(response.status, JSON.stringify(value)).toBe(422);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    const large = await redeem(mod, { code: "DERBY50", pad: "x".repeat(5000) });
    expect(large.status).toBe(413);
    expect(sent).toHaveLength(0);
  });

  it("answers 401 without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: { result: "granted" } }));

    const response = await redeem(
      mod,
      { code: "DERBY50" },
      without(sending(mod), "cookie"),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sent).toHaveLength(0);
  });

  it("passes PROMO_INVALID and PROMO_ALREADY_USED through by their code", async () => {
    const mod = await load();
    for (const [status, code] of [
      [422, "PROMO_INVALID"],
      [404, "PROMO_INVALID"],
      [422, "PROMO_ALREADY_USED"],
      [409, "PROMO_ALREADY_USED"],
    ] as const) {
      upstreamAnswers(() => ({
        status,
        body: problem(status, code, { extra: "not the contract's" }),
      }));

      const response = await redeem(mod);

      expect(response.status).toBe(status);
      const body = await response.json();
      expect(body.code).toBe(code);
      // The contract's fields of the Problem, and nothing more.
      expect(body).not.toHaveProperty("extra");
      vi.restoreAllMocks();
    }
  });

  it("passes a rate limit through with its Retry-After", async () => {
    const mod = await load();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(problem(429, "RATE_LIMITED"), {
        status: 429,
        headers: {
          "Content-Type": "application/problem+json",
          "Retry-After": "30",
        },
      }),
    );

    const response = await redeem(mod);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
  });

  it("never sends Prefer to the real API, even under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("API_REAL_URL", "http://real.test");
    vi.stubEnv("API_REAL_TAGS", "Promotions");
    const mod = await load();
    upstreamAnswers((request) => ({
      status: 200,
      body:
        path(request) === "/v1/promotions"
          ? example("/v1/promotions")
          : path(request) === "/v1/me/bonuses"
            ? example("/v1/me/bonuses")
            : { result: "granted" },
    }));
    const prefer = { prefer: "code=422" };

    await readOffers(mod, reading(mod, prefer));
    await readBonuses(mod, reading(mod, prefer));
    await redeem(mod, { code: "DERBY50" }, sending(mod, prefer));

    expect(sent.map((r) => new URL(r.url).host)).toEqual([
      "real.test",
      "real.test",
      "real.test",
    ]);
    expect(sent.map((r) => r.headers.get("prefer"))).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("forwards Prism's Prefer on a redeem under next dev only", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: { result: "granted" } }));
    const prefer = { prefer: "code=404" };

    vi.stubEnv("NODE_ENV", "development");
    await redeem(mod, { code: "DERBY50" }, sending(mod, prefer));
    vi.stubEnv("NODE_ENV", "test");
    await redeem(mod, { code: "DERBY50" }, sending(mod, prefer));

    expect(sent.map((r) => r.headers.get("prefer"))).toEqual([
      "code=404",
      null,
    ]);
  });
});
