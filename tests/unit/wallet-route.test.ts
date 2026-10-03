// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api/schema";
import { toWalletBalances } from "@/lib/api/mappers/wallet";
import { walletBalancesSchema, walletTxnPageSchema } from "@/lib/api/schemas";
import { example, responseExample } from "../contract";

// Route handlers are server-only; the marker package refuses to load outside
// React's server build, which a unit test is not.
vi.mock("server-only", () => ({}));

type Tokens = components["schemas"]["Tokens"];

/** A fresh module graph per test, so the refresh caches start clean. */
async function load() {
  vi.resetModules();
  const [wallet, history, session] = await Promise.all([
    import("@/app/api/wallet/route"),
    import("@/app/api/wallet/transactions/route"),
    import("@/lib/server/session"),
  ]);
  return { balances: wallet.GET, history: history.GET, ...session };
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

const URL_WALLET = "http://localhost:3000/api/wallet";
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

/** A read from this site's own page: the session cookie, nothing else. */
const reading = (mod: Loaded, extra: Record<string, string> = {}) => ({
  host: "localhost:3000",
  cookie: `${mod.SESSION_COOKIE}=${mod.seal(live())}`,
  ...extra,
});

const balances = (
  mod: Loaded,
  sentHeaders: Record<string, string> = reading(mod),
) =>
  mod.balances(
    new Request(URL_WALLET, { method: "GET", headers: sentHeaders }),
  );

const history = (
  mod: Loaded,
  query: string,
  sentHeaders: Record<string, string> = reading(mod),
) =>
  mod.history(
    new Request(`${URL_WALLET}/transactions${query}`, {
      method: "GET",
      headers: sentHeaders,
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

describe("GET /api/wallet (AC-5)", () => {
  it("reads /v1/wallet with the player's token for this tenant, never cached (AC-5)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/wallet") }));

    const response = await balances(mod);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(walletBalancesSchema.parse(await response.json())).toEqual(
      toWalletBalances(example("/v1/wallet")),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe("GET");
    expect(path(sent[0])).toBe("/v1/wallet");
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
  });

  it("answers 401 without a session and sends nothing upstream", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/wallet") }));

    const response = await balances(mod, { host: "localhost:3000" });

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sent).toHaveLength(0);
  });

  it("refreshes an expired token once and reads again", async () => {
    const mod = await load();
    const tokens = responseExample("/v1/auth/refresh", "post", 200) as Tokens;
    upstreamAnswers((request) => {
      if (path(request) === "/v1/auth/refresh")
        return { status: 200, body: tokens };
      return bearer(request) === tokens.access_token
        ? { status: 200, body: example("/v1/wallet") }
        : { status: 401, body: EXPIRED };
    });

    const response = await balances(mod);

    expect(response.status).toBe(200);
    expect(sent.map(path)).toEqual([
      "/v1/wallet",
      "/v1/auth/refresh",
      "/v1/wallet",
    ]);
    // The rotated session goes back to the browser with the answer.
    expect(response.headers.get("set-cookie")).toContain("kelal.session=");
  });

  it("ends a session the API no longer honours: 401, cookie cleared", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 401,
      body: responseExample("/v1/wallet", "get", 401),
    }));

    const response = await balances(mod);

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("passes the API's Problem through with the contract's fields only", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 503,
      body: {
        type: "https://api.example.et/errors/unavailable",
        title: "Temporarily unavailable",
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        request_id: "req_x",
        trace: "ledger-db-3 timeout",
      },
    }));

    const response = await balances(mod);

    expect(response.status).toBe(503);
    const problem = await response.json();
    expect(problem.code).toBe("SERVICE_UNAVAILABLE");
    expect(problem).not.toHaveProperty("trace");
  });

  it("forwards Prism's Prefer under next dev only", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: example("/v1/wallet") }));
    const prefer = { prefer: "code=401" };

    vi.stubEnv("NODE_ENV", "development");
    await balances(mod, reading(mod, prefer));
    vi.stubEnv("NODE_ENV", "test");
    await balances(mod, reading(mod, prefer));

    expect(sent.map((r) => r.headers.get("prefer"))).toEqual([
      "code=401",
      null,
    ]);
  });
});

describe("Prefer and the real API", () => {
  it("never sends Prefer to the real API, even under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("API_REAL_URL", "http://real.test");
    vi.stubEnv("API_REAL_TAGS", "Wallet");
    const mod = await load();
    upstreamAnswers((request) => ({
      status: 200,
      body:
        path(request) === "/v1/wallet"
          ? example("/v1/wallet")
          : example("/v1/wallet/transactions"),
    }));
    const prefer = { prefer: "code=500" };

    await balances(mod, reading(mod, prefer));
    await history(mod, "?type=bet", reading(mod, prefer));

    expect(sent.map((r) => new URL(r.url).host)).toEqual([
      "real.test",
      "real.test",
    ]);
    expect(sent.map((r) => r.headers.get("prefer"))).toEqual([null, null]);
  });
});

describe("GET /api/wallet/transactions (AC-6)", () => {
  it("forwards type, cursor and limit to /v1/wallet/transactions and answers nextCursor (AC-6)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: { ...example("/v1/wallet/transactions"), next_cursor: "c3" },
    }));

    const response = await history(mod, "?type=win&cursor=c2&limit=5");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const page = walletTxnPageSchema.parse(await response.json());
    expect(page.nextCursor).toBe("c3");
    expect(page.items.map((txn) => txn.amount)).toEqual([
      "289.17",
      "-100.00",
      "500.00",
    ]);
    // One read: movements carry no translated names.
    expect(sent).toHaveLength(1);
    expect(path(sent[0])).toBe("/v1/wallet/transactions");
    const query = new URL(sent[0].url).searchParams;
    expect(query.get("type")).toBe("win");
    expect(query.get("cursor")).toBe("c2");
    expect(query.get("limit")).toBe("5");
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
  });

  it("asks for the first page of everything with no filter, cursor or limit", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/wallet/transactions"),
    }));

    const response = await history(mod, "", {
      ...reading(mod),
      "accept-language": "am",
    });

    expect(response.status).toBe(200);
    expect((await response.json()).nextCursor).toBeNull();
    expect([...new URL(sent[0].url).searchParams.keys()]).toEqual([]);
    expect(sent[0].headers.get("accept-language")).toBe("am");
  });

  it.each([
    ["a type the contract doesn't have", "?type=lottery"],
    ["an empty type", "?type="],
    ["an empty cursor", "?cursor="],
    ["a cursor with a space in it", "?cursor=c%202"],
    ["a cursor far longer than any", `?cursor=${"c".repeat(513)}`],
    ["a limit of 0", "?limit=0"],
    ["a limit over the contract's 100", "?limit=101"],
    ["a limit that isn't a whole number", "?limit=5.5"],
    ["a limit that isn't a number", "?limit=five"],
  ])("refuses %s with 422 and sends nothing", async (_, query) => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/wallet/transactions"),
    }));

    const response = await history(mod, query);

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("VALIDATION_FAILED");
    expect(sent).toHaveLength(0);
  });

  it("answers 401 without a session and sends nothing upstream", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/wallet/transactions"),
    }));

    const response = await history(mod, "?type=deposit", {
      host: "localhost:3000",
    });

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sent).toHaveLength(0);
  });
});
