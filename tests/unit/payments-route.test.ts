// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api/schema";
import { depositSchema, paymentMethodsSchema } from "@/lib/api/schemas";
import { toPaymentMethods } from "@/lib/api/mappers/payments";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { example, responseExample } from "../contract";

// Route handlers are server-only; the marker package refuses to load outside
// React's server build, which a unit test is not.
vi.mock("server-only", () => ({}));

type Tokens = components["schemas"]["Tokens"];

/** A fresh module graph per test, so config and the refresh caches start clean. */
async function load() {
  vi.resetModules();
  const [methods, deposits, deposit, session] = await Promise.all([
    import("@/app/api/payment-methods/route"),
    import("@/app/api/deposits/route"),
    import("@/app/api/deposits/[id]/route"),
    import("@/lib/server/session"),
  ]);
  return {
    listMethods: methods.GET,
    start: deposits.POST,
    readOne: deposit.GET,
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

const REDIRECT = () => responseExample("/v1/deposits", "post", 201, "redirect");
const USSD = () => responseExample("/v1/deposits", "post", 201, "ussd_push");
const READ = (name: "completed" | "pending") =>
  responseExample("/v1/deposits/{id}", "get", 200, name);

/** What the wallet asks `/api/deposits` for. */
const DEPOSIT = { method: "chapa", amount: "500.00" };

/** A read from this site's own page: the session cookie, nothing else. */
const reading = (mod: Loaded, extra: Record<string, string> = {}) => ({
  host: "localhost:3000",
  cookie: `${mod.SESSION_COOKIE}=${mod.seal(live())}`,
  ...extra,
});

/** What this site's own wallet sends: CSRF header, JSON, a key, the session. */
const posting = (mod: Loaded, extra: Record<string, string> = {}) => ({
  ...reading(mod),
  "content-type": "application/json",
  [CSRF_HEADER]: CSRF_VALUE,
  "idempotency-key": KEY,
  ...extra,
});

const without = (h: Record<string, string>, name: string) =>
  Object.fromEntries(Object.entries(h).filter(([k]) => k !== name));

const listMethods = (
  mod: Loaded,
  sentHeaders: Record<string, string> = reading(mod),
) =>
  mod.listMethods(
    new Request(`${ORIGIN}/api/payment-methods`, { headers: sentHeaders }),
  );

const start = (
  mod: Loaded,
  body: unknown = DEPOSIT,
  sentHeaders: Record<string, string> = posting(mod),
) =>
  mod.start(
    new Request(`${ORIGIN}/api/deposits`, {
      method: "POST",
      headers: sentHeaders,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const readOne = (
  mod: Loaded,
  id: string,
  sentHeaders: Record<string, string> = reading(mod),
) =>
  mod.readOne(
    new Request(`${ORIGIN}/api/deposits/${encodeURIComponent(id)}`, {
      headers: sentHeaders,
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  sent = [];
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.stubEnv("TENANT_HOST_MAP", "localhost=demo,kelalsport.et=kelal");
  vi.stubEnv("TRUSTED_PROXY_HOPS", "");
  vi.stubEnv("PAYMENT_REDIRECT_HOSTS", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/payment-methods (AC-7)", () => {
  it("reads /v1/payment-methods for this player, in the UI's language, never cached (AC-7)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/payment-methods"),
    }));

    const response = await listMethods(
      mod,
      reading(mod, { "accept-language": "am" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(paymentMethodsSchema.parse(await response.json())).toEqual(
      toPaymentMethods(example("/v1/payment-methods").items),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe("GET");
    expect(path(sent[0])).toBe("/v1/payment-methods");
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(sent[0].headers.get("accept-language")).toBe("am");
  });

  it("answers 401 without a session and sends nothing upstream", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/payment-methods"),
    }));

    const response = await listMethods(mod, { host: "localhost:3000" });

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sent).toHaveLength(0);
  });

  it("ends a session the API no longer honours: 401, cookie cleared", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 401,
      body: responseExample("/v1/payment-methods", "get", 401),
    }));

    const response = await listMethods(mod);

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("forwards Prism's Prefer under next dev only", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/payment-methods"),
    }));
    const prefer = { prefer: "code=401" };

    vi.stubEnv("NODE_ENV", "development");
    await listMethods(mod, reading(mod, prefer));
    vi.stubEnv("NODE_ENV", "test");
    await listMethods(mod, reading(mod, prefer));

    expect(sent.map((r) => r.headers.get("prefer"))).toEqual([
      "code=401",
      null,
    ]);
  });
});

describe("POST /api/deposits", () => {
  it("starts the deposit with the player's token, the browser's key and this site's return address (AC-8)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: REDIRECT() }));

    const response = await start(mod);

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(depositSchema.parse(await response.json())).toMatchObject({
      id: "01J9A7W0000000000000000002",
      status: "pending",
      nextAction: {
        type: "redirect",
        url: "https://checkout.chapa.co/checkout/payment/abc123",
      },
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe("POST");
    expect(path(sent[0])).toBe("/v1/deposits");
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(sent[0].headers.get("idempotency-key")).toBe(KEY);
    expect(await sent[0].json()).toEqual({
      method: "chapa",
      amount: "500.00",
      return_url: "http://localhost:3000/wallet?deposit=return",
    });
  });

  it("forwards the browser's Idempotency-Key unchanged on every attempt, and never makes one (AC-8)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: USSD() }));

    // A retry of one intent, then another intent.
    await start(mod);
    await start(mod);
    const other = "0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
    await start(mod, DEPOSIT, posting(mod, { "idempotency-key": other }));

    expect(sent.map((r) => r.headers.get("idempotency-key"))).toEqual([
      KEY,
      KEY,
      other,
    ]);
  });

  it("sends the deposit again with the same key after refreshing an expired token (AC-8)", async () => {
    const mod = await load();
    const tokens = responseExample("/v1/auth/refresh", "post", 200) as Tokens;
    upstreamAnswers((request) => {
      if (path(request) === "/v1/auth/refresh")
        return { status: 200, body: tokens };
      return bearer(request) === tokens.access_token
        ? { status: 201, body: USSD() }
        : { status: 401, body: EXPIRED };
    });

    const response = await start(mod);

    expect(response.status).toBe(201);
    expect(sent.map(path)).toEqual([
      "/v1/deposits",
      "/v1/auth/refresh",
      "/v1/deposits",
    ]);
    const [first, , again] = sent;
    expect(first.headers.get("idempotency-key")).toBe(KEY);
    expect(again.headers.get("idempotency-key")).toBe(KEY);
    expect(await again.json()).toEqual(await first.json());
    // The rotated session goes back to the browser with the answer.
    expect(response.headers.get("set-cookie")).toContain("kelal.session=");
  });

  it("never hands the browser a redirect to a host not on the allow-list (AC-3)", async () => {
    vi.stubEnv("PAYMENT_REDIRECT_HOSTS", "pay.santimpay.com");
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: REDIRECT() }));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await start(mod);

    expect(response.status).toBe(201);
    const text = await response.text();
    expect(text).not.toContain("checkout.chapa.co");
    expect(depositSchema.parse(JSON.parse(text)).nextAction).toEqual({
      type: "unsupported",
      reason: "redirect_refused",
    });
    // Logged by host only: the page's path can carry the provider's session.
    const line = logged.mock.calls.flat().join(" ");
    expect(line).toContain("checkout.chapa.co");
    expect(line).not.toContain("abc123");
  });

  it("builds the return address from the tenant's own host, never a forwarded one", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: USSD() }));
    const kelal = {
      ...posting(mod),
      host: "kelalsport.et",
      origin: "https://kelalsport.et",
      cookie: `${mod.SESSION_COOKIE}=${mod.seal({ ...live(), tenant: "kelal" })}`,
      // No trusted proxy: a forwarded host is whatever the client typed.
      "x-forwarded-host": "evil.example",
    };

    const response = await start(mod, DEPOSIT, kelal);

    expect(response.status).toBe(201);
    expect(sent[0].headers.get("x-tenant-id")).toBe("kelal");
    expect((await sent[0].json()).return_url).toBe(
      "https://kelalsport.et/wallet?deposit=return",
    );
  });

  it("passes the API's refusals through with the contract's fields: 403, 422, 502, 503 (AC-9)", async () => {
    const mod = await load();
    const outOfRange = {
      type: "https://api.example.et/errors/amount-out-of-range",
      title: "Amount out of range",
      status: 422,
      code: "PAY_AMOUNT_OUT_OF_RANGE",
      detail: "telebirr takes 20.00 to 100,000.00 ETB.",
      request_id: "req_x",
      errors: [{ field: "amount", code: "MIN", limit: "20.00" }],
      internal: "limits-cache-7",
    };
    for (const [status, body] of [
      [403, responseExample("/v1/deposits", "post", 403)],
      [422, outOfRange],
      [502, responseExample("/v1/deposits", "post", 502)],
      [503, responseExample("/v1/deposits", "post", 503)],
    ] as const) {
      vi.restoreAllMocks();
      upstreamAnswers(() => ({ status, body }));

      const response = await start(mod);

      expect(response.status).toBe(status);
      expect(response.headers.get("content-type")).toContain(
        "application/problem+json",
      );
      const contract = { ...(body as Record<string, unknown>) };
      delete contract.internal;
      expect(await response.json()).toEqual(contract);
    }
  });

  it("refuses a deposit without an Idempotency-Key, or with one that is not a UUID, and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: USSD() }));

    const missing = await start(
      mod,
      DEPOSIT,
      without(posting(mod), "idempotency-key"),
    );
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe("VALIDATION_FAILED");

    const notUuid = await start(
      mod,
      DEPOSIT,
      posting(mod, { "idempotency-key": "deposit-1" }),
    );
    expect(notUuid.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("refuses a deposit from another site, without the CSRF header, or not in JSON", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: USSD() }));

    const foreign = await start(
      mod,
      DEPOSIT,
      posting(mod, { origin: "https://evil.example" }),
    );
    expect(foreign.status).toBe(403);
    const crossSite = await start(
      mod,
      DEPOSIT,
      posting(mod, { "sec-fetch-site": "cross-site" }),
    );
    expect(crossSite.status).toBe(403);
    const noHeader = await start(
      mod,
      DEPOSIT,
      without(posting(mod), CSRF_HEADER),
    );
    expect(noHeader.status).toBe(403);
    const form = await start(
      mod,
      "method=chapa&amount=500.00",
      posting(mod, { "content-type": "application/x-www-form-urlencoded" }),
    );
    expect(form.status).toBe(415);
    expect(sent).toHaveLength(0);
  });

  it("refuses a body that is not a deposit, before sending anything", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: USSD() }));

    for (const body of [
      { ...DEPOSIT, method: "paypal" },
      { ...DEPOSIT, amount: "500" },
      { ...DEPOSIT, amount: "500.001" },
      { ...DEPOSIT, amount: "0.00" },
      { ...DEPOSIT, amount: "-5.00" },
      { ...DEPOSIT, amount: 500 },
      { method: "chapa" },
      { amount: "500.00" },
      // The return address is the server's to set; so is everything else.
      { ...DEPOSIT, return_url: "https://evil.example/steal" },
      { ...DEPOSIT, phone: "+251911234567" },
      { ...DEPOSIT, extra: "x" },
      null,
      "not json",
    ]) {
      const response = await start(mod, body);
      expect(response.status, JSON.stringify(body)).toBe(422);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    expect(sent).toHaveLength(0);
  });

  it("refuses a body far bigger than any deposit, before reading it all", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: USSD() }));

    const response = await start(mod, { ...DEPOSIT, note: "x".repeat(8000) });

    expect(response.status).toBe(413);
    expect(sent).toHaveLength(0);
  });

  it("answers 401 AUTH_TOKEN_EXPIRED without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: USSD() }));

    const response = await start(mod, DEPOSIT, without(posting(mod), "cookie"));

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sent).toHaveLength(0);
  });

  it("forwards Prism's code-and-example Prefer under next dev only", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: USSD() }));
    const prefer = "example=ussd_push";

    vi.stubEnv("NODE_ENV", "development");
    await start(mod, DEPOSIT, posting(mod, { prefer }));
    vi.stubEnv("NODE_ENV", "test");
    await start(mod, DEPOSIT, posting(mod, { prefer }));

    expect(sent.map((r) => r.headers.get("prefer"))).toEqual([prefer, null]);
  });
});

describe("GET /api/deposits/[id]", () => {
  it("reads one deposit with the player's token, never cached", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: READ("completed") }));

    const response = await readOne(mod, "01J9A7W0000000000000000002");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(depositSchema.parse(await response.json())).toMatchObject({
      status: "completed",
      completedAt: "2026-10-03T13:58:41Z",
    });
    expect(sent.map(path)).toEqual(["/v1/deposits/01J9A7W0000000000000000002"]);
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
  });

  it("keeps the allow-list on a read too: a pending deposit's page on another host never reaches the browser (AC-3)", async () => {
    vi.stubEnv("PAYMENT_REDIRECT_HOSTS", "checkout.chapa.co");
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: READ("pending") }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await readOne(mod, "01J9A7W0000000000000000002");

    const text = await response.text();
    expect(text).not.toContain("app.ethiotelecom.et");
    expect(depositSchema.parse(JSON.parse(text)).nextAction).toEqual({
      type: "unsupported",
      reason: "redirect_refused",
    });
  });

  it("passes the API's 404 through: a deposit not on this account", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 404,
      body: responseExample("/v1/deposits/{id}", "get", 404),
    }));

    const response = await readOne(mod, "01J9A7W0000000000000000009");

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("NOT_FOUND");
  });

  it.each(["../me", "a b", "x".repeat(65), "01J9/../me", ""])(
    "answers 404 and sends nothing for an id that can't be one (%s)",
    async (id) => {
      const mod = await load();
      upstreamAnswers(() => ({ status: 200, body: READ("completed") }));

      const response = await readOne(mod, id);

      expect(response.status).toBe(404);
      expect((await response.json()).code).toBe("NOT_FOUND");
      expect(sent).toHaveLength(0);
    },
  );

  it("answers 401 AUTH_TOKEN_EXPIRED without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: READ("completed") }));

    const response = await readOne(mod, "01J9A7W0000000000000000002", {
      host: "localhost:3000",
    });

    expect(response.status).toBe(401);
    expect(sent).toHaveLength(0);
  });
});

describe("Prefer and the real API", () => {
  it("never sends Prefer to the real API, even under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("API_REAL_URL", "http://real.test");
    vi.stubEnv("API_REAL_TAGS", "Payments");
    const mod = await load();
    upstreamAnswers((request) => ({
      status: request.method === "POST" ? 201 : 200,
      body:
        path(request) === "/v1/payment-methods"
          ? example("/v1/payment-methods")
          : request.method === "POST"
            ? USSD()
            : READ("completed"),
    }));
    const prefer = { prefer: "code=502" };

    await listMethods(mod, reading(mod, prefer));
    await start(mod, DEPOSIT, posting(mod, prefer));
    await readOne(mod, "01J9A7W0000000000000000002", reading(mod, prefer));

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
});
