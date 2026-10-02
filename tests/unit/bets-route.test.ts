// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api/schema";
import { betReceiptSchema } from "@/lib/api/schemas";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { requestExample, responseExample } from "../contract";

// Route handlers are server-only; the marker package refuses to load outside
// React's server build, which a unit test is not.
vi.mock("server-only", () => ({}));

type Tokens = components["schemas"]["Tokens"];

/** A fresh module graph per test, so the refresh caches start clean. */
async function load() {
  vi.resetModules();
  const [bets, session] = await Promise.all([
    import("@/app/api/bets/route"),
    import("@/lib/server/session"),
  ]);
  return { place: bets.POST, ...session };
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

const URL_BETS = "http://localhost:3000/api/bets";
const KEY = "3f0c8b8e-6a3d-4c1e-9d0f-1b2a3c4d5e6f";
const NOW = Date.parse("2026-10-03T09:00:00Z");
const EXPIRED = {
  type: "https://api.example.et/errors/token-expired",
  title: "Session expired",
  status: 401,
  code: "AUTH_TOKEN_EXPIRED",
};

const live = () => ({
  tenant: "demo",
  access: "eyJ.live.access",
  refresh: "rt_live",
  expiresAt: NOW + 10 * 60_000,
});

/** The contract's own request example, as the slip asks `/api/bets` for it. */
const BET = {
  betType: "multiple",
  systemSizes: [],
  legs: [
    { outcomeId: "oc_ac_1", odds: "2.10" },
    { outcomeId: "oc_rb_o25", odds: "1.62" },
  ],
  stake: "100.00",
  oddsPolicy: "higher",
};

/** What this site's own slip sends: CSRF header, JSON, a key, the session. */
const headers = (mod: Loaded, extra: Record<string, string> = {}) => ({
  host: "localhost:3000",
  "content-type": "application/json",
  [CSRF_HEADER]: CSRF_VALUE,
  "idempotency-key": KEY,
  cookie: `${mod.SESSION_COOKIE}=${mod.seal(live())}`,
  ...extra,
});

const place = (
  mod: Loaded,
  body: unknown = BET,
  sentHeaders: Record<string, string> = headers(mod),
) =>
  mod.place(
    new Request(URL_BETS, {
      method: "POST",
      headers: sentHeaders,
      body: JSON.stringify(body),
    }),
  );

const without = (h: Record<string, string>, name: string) =>
  Object.fromEntries(Object.entries(h).filter(([k]) => k !== name));

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

describe("POST /api/bets", () => {
  it("places the contract's request with the player's token and answers 201 with the ticket", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 201,
      body: responseExample("/v1/bets", "post", 201),
    }));

    const response = await place(mod);

    expect(response.status).toBe(201);
    const receipt = betReceiptSchema.parse(await response.json());
    expect(receipt).toMatchObject({
      ticketId: "K7Q2-M9XP-M",
      potentialPayout: "289.17",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe("POST");
    expect(path(sent[0])).toBe("/v1/bets");
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(await sent[0].json()).toEqual(requestExample("/v1/bets", "post"));
  });

  it("forwards the browser's Idempotency-Key unchanged on every attempt, and never makes one (AC-1)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 201,
      body: responseExample("/v1/bets", "post", 201),
    }));

    // A retry of one intent, then another intent.
    await place(mod);
    await place(mod);
    const other = "0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
    await place(mod, BET, headers(mod, { "idempotency-key": other }));

    expect(sent.map((r) => r.headers.get("idempotency-key"))).toEqual([
      KEY,
      KEY,
      other,
    ]);
  });

  it("sends the POST again with the same key after refreshing an expired token (AC-1)", async () => {
    const mod = await load();
    const tokens = responseExample("/v1/auth/refresh", "post", 200) as Tokens;
    upstreamAnswers((request) => {
      if (path(request) === "/v1/auth/refresh")
        return { status: 200, body: tokens };
      return bearer(request) === tokens.access_token
        ? { status: 201, body: responseExample("/v1/bets", "post", 201) }
        : { status: 401, body: EXPIRED };
    });

    const response = await place(mod);

    expect(response.status).toBe(201);
    expect(sent.map(path)).toEqual([
      "/v1/bets",
      "/v1/auth/refresh",
      "/v1/bets",
    ]);
    const [first, , again] = sent;
    expect(again.headers.get("idempotency-key")).toBe(KEY);
    expect(first.headers.get("idempotency-key")).toBe(KEY);
    expect(await again.json()).toEqual(await first.json());
  });

  it("passes a 409 BET_ODDS_CHANGED through with its errors[] (AC-2)", async () => {
    const mod = await load();
    const changed = responseExample("/v1/bets", "post", 409, "odds_changed");
    upstreamAnswers(() => ({ status: 409, body: changed }));

    const response = await place(mod);

    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(await response.json()).toEqual(changed);
  });

  it("passes a 403 and a 422 through by their code", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 403,
      body: responseExample("/v1/bets", "post", 403),
    }));
    expect((await (await place(mod)).json()).code).toBe("KYC_REQUIRED");

    vi.restoreAllMocks();
    upstreamAnswers(() => ({
      status: 422,
      body: responseExample("/v1/bets", "post", 422, "insufficient_funds"),
    }));
    const response = await place(mod);
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("WALLET_INSUFFICIENT_FUNDS");
  });

  it("refuses a POST without an Idempotency-Key, or with one that is not a UUID", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: {} }));

    const missing = await place(
      mod,
      BET,
      without(headers(mod), "idempotency-key"),
    );
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe("VALIDATION_FAILED");

    const notUuid = await place(
      mod,
      BET,
      headers(mod, { "idempotency-key": "place-1" }),
    );
    expect(notUuid.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("refuses a POST from another site, without the CSRF header, or not in JSON", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: {} }));

    const foreign = await place(
      mod,
      BET,
      headers(mod, { origin: "https://evil.example" }),
    );
    expect(foreign.status).toBe(403);
    const crossSite = await place(
      mod,
      BET,
      headers(mod, { "sec-fetch-site": "cross-site" }),
    );
    expect(crossSite.status).toBe(403);
    const noHeader = await place(mod, BET, without(headers(mod), CSRF_HEADER));
    expect(noHeader.status).toBe(403);
    const form = await place(
      mod,
      BET,
      headers(mod, { "content-type": "application/x-www-form-urlencoded" }),
    );
    expect(form.status).toBe(415);
    expect(sent).toHaveLength(0);
  });

  it("refuses a body that is not a bet, before sending anything", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: {} }));
    const legs = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        outcomeId: `oc_${i}`,
        odds: "1.50",
      }));

    for (const body of [
      { ...BET, extra: "x" },
      { ...BET, stake: "0.00" },
      { ...BET, stake: "-5.00" },
      { ...BET, stake: "100" },
      { ...BET, legs: [{ outcomeId: "oc_ac_1", odds: "2.1" }] },
      { ...BET, legs: [] },
      { ...BET, legs: legs(31) },
      { ...BET, legs: [BET.legs[0], BET.legs[0]] },
      { ...BET, systemSizes: [2] },
      { ...BET, betType: "system", systemSizes: [] },
      { ...BET, oddsPolicy: "sometimes" },
      { ...BET, useBonus: true },
    ]) {
      const response = await place(mod, body);
      expect(response.status, JSON.stringify(body)).toBe(422);
    }
    expect(sent).toHaveLength(0);
  });

  it("refuses a body far bigger than any slip, before reading it all", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: {} }));
    const response = await place(mod, {
      ...BET,
      legs: Array.from({ length: 2000 }, (_, i) => ({
        outcomeId: `oc_${i}_${"x".repeat(20)}`,
        odds: "1.50",
      })),
    });
    expect(response.status).toBe(413);
    expect(sent).toHaveLength(0);
  });

  it("answers 401 AUTH_TOKEN_EXPIRED without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: {} }));
    const response = await place(mod, BET, without(headers(mod), "cookie"));
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sent).toHaveLength(0);
  });

  it("forwards Prism's code-and-example Prefer under next dev only", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 409,
      body: responseExample("/v1/bets", "post", 409, "event_started"),
    }));
    const prefer = "code=409, example=event_started";

    vi.stubEnv("NODE_ENV", "development");
    await place(mod, BET, headers(mod, { prefer }));
    expect(sent[0].headers.get("prefer")).toBe(prefer);

    // Fails closed in any other build (production needs a real session
    // secret, so the test build stands in for it here; booking-route.test.ts
    // covers production for the same function).
    vi.stubEnv("NODE_ENV", "test");
    await place(mod, BET, headers(mod, { prefer }));
    expect(sent[1].headers.get("prefer")).toBeNull();
  });
});
