// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api/schema";
import {
  payoutAccountSchema,
  payoutAccountsSchema,
  withdrawalSchema,
} from "@/lib/api/schemas";
import { toPayoutAccounts } from "@/lib/api/mappers/withdrawals";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { example, requestExample, responseExample } from "../contract";

// Route handlers are server-only; the marker package refuses to load outside
// React's server build, which a unit test is not.
vi.mock("server-only", () => ({}));

type Tokens = components["schemas"]["Tokens"];
type ApiWithdrawal = components["schemas"]["Withdrawal"];

/** A fresh module graph per test, so config and the refresh caches start clean. */
async function load() {
  vi.resetModules();
  const [accounts, account, withdrawals, withdrawal, session] =
    await Promise.all([
      import("@/app/api/payout-accounts/route"),
      import("@/app/api/payout-accounts/[id]/route"),
      import("@/app/api/withdrawals/route"),
      import("@/app/api/withdrawals/[id]/route"),
      import("@/lib/server/session"),
    ]);
  return {
    listAccounts: accounts.GET,
    addAccount: accounts.POST,
    removeAccount: account.DELETE,
    request: withdrawals.POST,
    readOne: withdrawal.GET,
    cancelOne: withdrawal.DELETE,
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

const ACCOUNT_ID = "01J9A7X0000000000000000001";
const WITHDRAWAL_ID = "01J9A7Y0000000000000000001";
const PROCESSING = () =>
  responseExample("/v1/withdrawals", "post", 201, "processing");
const REVIEW = () => responseExample("/v1/withdrawals", "post", 201, "review");
const PAID = () => example("/v1/withdrawals/{id}");
const CANCELLED = (): ApiWithdrawal => ({
  ...(PROCESSING() as ApiWithdrawal),
  status: "cancelled",
});

/** What the wallet asks `/api/withdrawals` for: a saved account. */
const TO_SAVED = {
  method: "telebirr",
  amount: "2000.00",
  to: { kind: "saved", payoutAccountId: ACCOUNT_ID },
};
/** …or a new number. */
const TO_NEW = {
  method: "cbebirr",
  amount: "500.00",
  to: { kind: "new", account: "+251911234567" },
};
const NEW_ACCOUNT = { provider: "telebirr", account: "+251911234567" };

/** A read from this site's own page: the session cookie, nothing else. */
const reading = (mod: Loaded, extra: Record<string, string> = {}) => ({
  host: "localhost:3000",
  cookie: `${mod.SESSION_COOKIE}=${mod.seal(live())}`,
  ...extra,
});

/** What this site's own wallet sends with a body: CSRF header, JSON, the session. */
const posting = (mod: Loaded, extra: Record<string, string> = {}) => ({
  ...reading(mod),
  "content-type": "application/json",
  [CSRF_HEADER]: CSRF_VALUE,
  ...extra,
});

/** …and with a withdrawal, its key. */
const withdrawing = (mod: Loaded, extra: Record<string, string> = {}) =>
  posting(mod, { "idempotency-key": KEY, ...extra });

/** What it sends to remove or cancel something: CSRF header and the session, no body. */
const deleting = (mod: Loaded, extra: Record<string, string> = {}) => ({
  ...reading(mod),
  [CSRF_HEADER]: CSRF_VALUE,
  ...extra,
});

const without = (h: Record<string, string>, name: string) =>
  Object.fromEntries(Object.entries(h).filter(([k]) => k !== name));

const body = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value);

const listAccounts = (
  mod: Loaded,
  headers: Record<string, string> = reading(mod),
) =>
  mod.listAccounts(new Request(`${ORIGIN}/api/payout-accounts`, { headers }));

const addAccount = (
  mod: Loaded,
  value: unknown = NEW_ACCOUNT,
  headers: Record<string, string> = posting(mod),
) =>
  mod.addAccount(
    new Request(`${ORIGIN}/api/payout-accounts`, {
      method: "POST",
      headers,
      body: body(value),
    }),
  );

const removeAccount = (
  mod: Loaded,
  id: string,
  headers: Record<string, string> = deleting(mod),
) =>
  mod.removeAccount(
    new Request(`${ORIGIN}/api/payout-accounts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    }),
    { params: Promise.resolve({ id }) },
  );

const request = (
  mod: Loaded,
  value: unknown = TO_SAVED,
  headers: Record<string, string> = withdrawing(mod),
) =>
  mod.request(
    new Request(`${ORIGIN}/api/withdrawals`, {
      method: "POST",
      headers,
      body: body(value),
    }),
  );

const readOne = (
  mod: Loaded,
  id: string,
  headers: Record<string, string> = reading(mod),
) =>
  mod.readOne(
    new Request(`${ORIGIN}/api/withdrawals/${encodeURIComponent(id)}`, {
      headers,
    }),
    { params: Promise.resolve({ id }) },
  );

const cancelOne = (
  mod: Loaded,
  id: string,
  headers: Record<string, string> = deleting(mod),
) =>
  mod.cancelOne(
    new Request(`${ORIGIN}/api/withdrawals/${encodeURIComponent(id)}`, {
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

describe("/api/payout-accounts (AC-10)", () => {
  it("lists, adds and removes payout accounts for this player (AC-10)", async () => {
    const mod = await load();
    upstreamAnswers((upstream) =>
      upstream.method === "GET"
        ? { status: 200, body: example("/v1/me/payout-accounts") }
        : upstream.method === "POST"
          ? {
              status: 201,
              body: responseExample("/v1/me/payout-accounts", "post", 201),
            }
          : { status: 204 },
    );

    const listed = await listAccounts(mod);
    expect(listed.status).toBe(200);
    expect(listed.headers.get("cache-control")).toBe("no-store");
    expect(payoutAccountsSchema.parse(await listed.json())).toEqual(
      toPayoutAccounts(example("/v1/me/payout-accounts").items),
    );

    const added = await addAccount(mod);
    expect(added.status).toBe(201);
    expect(added.headers.get("cache-control")).toBe("no-store");
    expect(payoutAccountSchema.parse(await added.json())).toMatchObject({
      id: "01J9A7X0000000000000000002",
      verified: false,
    });

    const removed = await removeAccount(mod, ACCOUNT_ID);
    expect(removed.status).toBe(204);
    expect(removed.headers.get("cache-control")).toBe("no-store");
    expect(await removed.text()).toBe("");

    expect(sent.map((r) => `${r.method} ${path(r)}`)).toEqual([
      "GET /v1/me/payout-accounts",
      "POST /v1/me/payout-accounts",
      `DELETE /v1/me/payout-accounts/${ACCOUNT_ID}`,
    ]);
    for (const upstream of sent) {
      expect(bearer(upstream)).toBe("eyJ.live.access");
      expect(upstream.headers.get("x-tenant-id")).toBe("demo");
    }
    expect(await sent[1].json()).toEqual({
      provider: "telebirr",
      account_ref: "+251911234567",
    });
  });

  it("refuses an account that is not a mobile number, or anything else in the body, before sending anything", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 201,
      body: responseExample("/v1/me/payout-accounts", "post", 201),
    }));

    for (const value of [
      { ...NEW_ACCOUNT, account: "0911234567" },
      { ...NEW_ACCOUNT, account: "911234567" },
      { ...NEW_ACCOUNT, account: "+251811234567" },
      { ...NEW_ACCOUNT, account: "+2519112345678" },
      { ...NEW_ACCOUNT, account: 251911234567 },
      { ...NEW_ACCOUNT, provider: "paypal" },
      // The contract's field name is the server's to send.
      { provider: "telebirr", account_ref: "+251911234567" },
      { ...NEW_ACCOUNT, holder_name: "Someone Else" },
      { provider: "telebirr" },
      null,
      "not json",
    ]) {
      const response = await addAccount(mod, value);
      expect(response.status, JSON.stringify(value)).toBe(422);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    expect(sent).toHaveLength(0);
  });

  it("refuses adding or removing an account from another site or without the CSRF header; a removal needs no JSON", async () => {
    const mod = await load();
    upstreamAnswers((upstream) =>
      upstream.method === "DELETE"
        ? { status: 204 }
        : {
            status: 201,
            body: responseExample("/v1/me/payout-accounts", "post", 201),
          },
    );

    expect(
      (
        await addAccount(
          mod,
          NEW_ACCOUNT,
          posting(mod, { origin: "https://evil.example" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await addAccount(mod, NEW_ACCOUNT, without(posting(mod), CSRF_HEADER)))
        .status,
    ).toBe(403);
    expect(
      (
        await addAccount(
          mod,
          "provider=telebirr&account=%2B251911234567",
          posting(mod, {
            "content-type": "application/x-www-form-urlencoded",
          }),
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await removeAccount(
          mod,
          ACCOUNT_ID,
          deleting(mod, { "sec-fetch-site": "cross-site" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await removeAccount(
          mod,
          ACCOUNT_ID,
          without(deleting(mod), CSRF_HEADER),
        )
      ).status,
    ).toBe(403);
    expect(sent).toHaveLength(0);

    // This site's own removal: no body, no content type, and it goes.
    expect((await removeAccount(mod, ACCOUNT_ID)).status).toBe(204);
    expect(sent).toHaveLength(1);
  });

  it("passes the API's 409 on adding an account and its 404 on removing one through", async () => {
    const mod = await load();
    const conflict = responseExample("/v1/me/payout-accounts", "post", 409);
    const missing = responseExample(
      "/v1/me/payout-accounts/{id}",
      "delete",
      404,
    );
    upstreamAnswers((upstream) =>
      upstream.method === "POST"
        ? { status: 409, body: conflict }
        : { status: 404, body: missing },
    );

    const added = await addAccount(mod);
    expect(added.status).toBe(409);
    expect(await added.json()).toEqual(conflict);

    const removed = await removeAccount(mod, ACCOUNT_ID);
    expect(removed.status).toBe(404);
    expect(await removed.json()).toEqual(missing);
  });

  it.each(["../me", "a b", "x".repeat(65), "01J9/../me", ""])(
    "answers 404 and sends nothing for an account id that can't be one (%s)",
    async (id) => {
      const mod = await load();
      upstreamAnswers(() => ({ status: 204 }));

      const response = await removeAccount(mod, id);

      expect(response.status).toBe(404);
      expect((await response.json()).code).toBe("NOT_FOUND");
      expect(sent).toHaveLength(0);
    },
  );

  it("answers 401 AUTH_TOKEN_EXPIRED without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 204 }));

    for (const response of [
      await listAccounts(mod, { host: "localhost:3000" }),
      await addAccount(mod, NEW_ACCOUNT, without(posting(mod), "cookie")),
      await removeAccount(mod, ACCOUNT_ID, without(deleting(mod), "cookie")),
    ]) {
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    }
    expect(sent).toHaveLength(0);
  });
});

describe("POST /api/withdrawals", () => {
  it("requests the withdrawal with the player's token and the browser's key (AC-8)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: PROCESSING() }));

    const response = await request(mod);

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(withdrawalSchema.parse(await response.json())).toMatchObject({
      id: WITHDRAWAL_ID,
      status: "processing",
      accountMasked: "+2519••••567",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe("POST");
    expect(path(sent[0])).toBe("/v1/withdrawals");
    expect(bearer(sent[0])).toBe("eyJ.live.access");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(sent[0].headers.get("idempotency-key")).toBe(KEY);
    // A saved account goes as the contract's own example request does.
    expect(await sent[0].json()).toEqual(
      requestExample("/v1/withdrawals", "post"),
    );
  });

  it("sends a new number as the contract's account (AC-10)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: PROCESSING() }));

    await request(mod, TO_NEW);

    expect(await sent[0].json()).toEqual({
      method: "cbebirr",
      amount: "500.00",
      account: "+251911234567",
    });
  });

  it("forwards the browser's Idempotency-Key unchanged on every attempt, and never makes one (AC-8)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: PROCESSING() }));

    // A retry of one intent, then another intent.
    await request(mod);
    await request(mod);
    const other = "0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
    await request(
      mod,
      TO_SAVED,
      withdrawing(mod, { "idempotency-key": other }),
    );

    expect(sent.map((r) => r.headers.get("idempotency-key"))).toEqual([
      KEY,
      KEY,
      other,
    ]);
  });

  it("sends the withdrawal again with the same key after refreshing an expired token (AC-8)", async () => {
    const mod = await load();
    const tokens = responseExample("/v1/auth/refresh", "post", 200) as Tokens;
    upstreamAnswers((upstream) => {
      if (path(upstream) === "/v1/auth/refresh")
        return { status: 200, body: tokens };
      return bearer(upstream) === tokens.access_token
        ? { status: 201, body: PROCESSING() }
        : { status: 401, body: EXPIRED };
    });

    const response = await request(mod);

    expect(response.status).toBe(201);
    expect(sent.map(path)).toEqual([
      "/v1/withdrawals",
      "/v1/auth/refresh",
      "/v1/withdrawals",
    ]);
    const [first, , again] = sent;
    expect(first.headers.get("idempotency-key")).toBe(KEY);
    expect(again.headers.get("idempotency-key")).toBe(KEY);
    expect(await again.json()).toEqual(await first.json());
    // The rotated session goes back to the browser with the answer.
    expect(response.headers.get("set-cookie")).toContain("kelal.session=");
  });

  it("passes the API's refusals through with the contract's fields: 403, 422, 503 (AC-9)", async () => {
    const mod = await load();
    const wagering = {
      type: "https://api.example.et/errors/active-bonus-wagering",
      title: "Your bonus is still being wagered",
      status: 422,
      code: "PAY_ACTIVE_BONUS_WAGERING",
      detail: "Withdrawing now forfeits your bonus of 500.00 ETB.",
      request_id: "req_x",
      errors: [{ field: "amount", code: "BONUS", current: "500.00" }],
      internal: "bonus-rule-7",
    };
    for (const [status, problem] of [
      [403, responseExample("/v1/withdrawals", "post", 403)],
      [
        422,
        responseExample("/v1/withdrawals", "post", 422, "insufficient_funds"),
      ],
      [422, wagering],
      [503, responseExample("/v1/withdrawals", "post", 503)],
    ] as const) {
      vi.restoreAllMocks();
      upstreamAnswers(() => ({ status, body: problem }));

      const response = await request(mod);

      expect(response.status).toBe(status);
      expect(response.headers.get("content-type")).toContain(
        "application/problem+json",
      );
      const contract = { ...(problem as Record<string, unknown>) };
      delete contract.internal;
      expect(await response.json()).toEqual(contract);
    }
  });

  it("refuses a withdrawal without an Idempotency-Key, or with one that is not a UUID, and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: PROCESSING() }));

    const missing = await request(
      mod,
      TO_SAVED,
      without(withdrawing(mod), "idempotency-key"),
    );
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe("VALIDATION_FAILED");

    const notUuid = await request(
      mod,
      TO_SAVED,
      withdrawing(mod, { "idempotency-key": "withdrawal-1" }),
    );
    expect(notUuid.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("refuses a withdrawal from another site, without the CSRF header, or not in JSON", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: PROCESSING() }));

    const foreign = await request(
      mod,
      TO_SAVED,
      withdrawing(mod, { origin: "https://evil.example" }),
    );
    expect(foreign.status).toBe(403);
    const crossSite = await request(
      mod,
      TO_SAVED,
      withdrawing(mod, { "sec-fetch-site": "cross-site" }),
    );
    expect(crossSite.status).toBe(403);
    const noHeader = await request(
      mod,
      TO_SAVED,
      without(withdrawing(mod), CSRF_HEADER),
    );
    expect(noHeader.status).toBe(403);
    const form = await request(
      mod,
      "method=telebirr&amount=2000.00",
      withdrawing(mod, { "content-type": "application/x-www-form-urlencoded" }),
    );
    expect(form.status).toBe(415);
    expect(sent).toHaveLength(0);
  });

  it("refuses a body that is not a withdrawal, before sending anything", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: PROCESSING() }));

    for (const value of [
      { ...TO_SAVED, method: "paypal" },
      // Not an amount at all: a 422, never a check that throws into a 500.
      { ...TO_SAVED, amount: "abc" },
      { ...TO_SAVED, amount: "5e2" },
      { ...TO_SAVED, amount: "2000" },
      { ...TO_SAVED, amount: "2000.001" },
      { ...TO_SAVED, amount: "0.00" },
      { ...TO_SAVED, amount: "-5.00" },
      { ...TO_SAVED, amount: 2000 },
      { method: "telebirr", amount: "2000.00" },
      { ...TO_SAVED, to: { kind: "saved", payoutAccountId: "../me" } },
      { ...TO_SAVED, to: { kind: "saved", payoutAccountId: "" } },
      { ...TO_SAVED, to: { kind: "new", account: "0911234567" } },
      {
        ...TO_SAVED,
        to: {
          kind: "saved",
          payoutAccountId: ACCOUNT_ID,
          account: "+251911234567",
        },
      },
      { ...TO_SAVED, to: { kind: "bank", account: "1000123456789" } },
      // The contract's field names are the server's to send.
      { method: "telebirr", amount: "2000.00", payout_account_id: ACCOUNT_ID },
      { ...TO_SAVED, forfeit_bonus: true },
      null,
      "not json",
    ]) {
      const response = await request(mod, value);
      expect(response.status, JSON.stringify(value)).toBe(422);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    expect(sent).toHaveLength(0);
  });

  it("refuses a body far bigger than any withdrawal, before reading it all", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: PROCESSING() }));

    const response = await request(mod, {
      ...TO_SAVED,
      note: "x".repeat(8000),
    });

    expect(response.status).toBe(413);
    expect(sent).toHaveLength(0);
  });

  it("answers 401 AUTH_TOKEN_EXPIRED without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: PROCESSING() }));

    const response = await request(
      mod,
      TO_SAVED,
      without(withdrawing(mod), "cookie"),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    expect(sent).toHaveLength(0);
  });

  it("forwards Prism's example Prefer under next dev only", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: REVIEW() }));
    const prefer = "example=review";

    vi.stubEnv("NODE_ENV", "development");
    await request(mod, TO_SAVED, withdrawing(mod, { prefer }));
    vi.stubEnv("NODE_ENV", "test");
    await request(mod, TO_SAVED, withdrawing(mod, { prefer }));

    expect(sent.map((r) => r.headers.get("prefer"))).toEqual([prefer, null]);
  });
});

describe("/api/withdrawals/[id]", () => {
  it("reads and cancels one withdrawal for this player, never cached (AC-10)", async () => {
    const mod = await load();
    upstreamAnswers((upstream) =>
      upstream.method === "DELETE"
        ? { status: 200, body: CANCELLED() }
        : { status: 200, body: PAID() },
    );

    const read = await readOne(mod, WITHDRAWAL_ID);
    expect(read.status).toBe(200);
    expect(read.headers.get("cache-control")).toBe("no-store");
    expect(withdrawalSchema.parse(await read.json())).toMatchObject({
      status: "paid",
      paidAt: "2026-10-04T09:04:12Z",
    });

    const cancelled = await cancelOne(mod, WITHDRAWAL_ID);
    expect(cancelled.status).toBe(200);
    expect(cancelled.headers.get("cache-control")).toBe("no-store");
    expect(withdrawalSchema.parse(await cancelled.json())).toMatchObject({
      id: WITHDRAWAL_ID,
      status: "cancelled",
    });

    expect(sent.map((r) => `${r.method} ${path(r)}`)).toEqual([
      `GET /v1/withdrawals/${WITHDRAWAL_ID}`,
      `DELETE /v1/withdrawals/${WITHDRAWAL_ID}`,
    ]);
    for (const upstream of sent) {
      expect(bearer(upstream)).toBe("eyJ.live.access");
      expect(upstream.headers.get("x-tenant-id")).toBe("demo");
      // A cancel is no new intent: the contract takes no key for it.
      expect(upstream.headers.get("idempotency-key")).toBeNull();
    }
  });

  it("passes the API's 409 through when it can no longer be cancelled, and its 404 for one not on this account (AC-10)", async () => {
    const mod = await load();
    const tooLate = {
      type: "https://api.example.et/errors/withdrawal-not-cancellable",
      title: "This withdrawal can no longer be cancelled",
      status: 409,
      code: "PAY_WITHDRAWAL_NOT_CANCELLABLE",
      request_id: "req_y",
    };
    const missing = responseExample("/v1/withdrawals/{id}", "get", 404);
    upstreamAnswers((upstream) =>
      upstream.method === "DELETE"
        ? { status: 409, body: tooLate }
        : { status: 404, body: missing },
    );

    const cancel = await cancelOne(mod, WITHDRAWAL_ID);
    expect(cancel.status).toBe(409);
    expect(await cancel.json()).toEqual(tooLate);

    const read = await readOne(mod, "01J9A7Y0000000000000000009");
    expect(read.status).toBe(404);
    expect((await read.json()).code).toBe("NOT_FOUND");
  });

  it.each(["../me", "a b", "x".repeat(65), "01J9/../me", ""])(
    "answers 404 and sends nothing for a withdrawal id that can't be one (%s)",
    async (id) => {
      const mod = await load();
      upstreamAnswers(() => ({ status: 200, body: PAID() }));

      for (const response of [
        await readOne(mod, id),
        await cancelOne(mod, id),
      ]) {
        expect(response.status).toBe(404);
        expect((await response.json()).code).toBe("NOT_FOUND");
      }
      expect(sent).toHaveLength(0);
    },
  );

  it("refuses a cancel from another site or without the CSRF header, but needs no JSON body", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: CANCELLED() }));

    const foreign = await cancelOne(
      mod,
      WITHDRAWAL_ID,
      deleting(mod, { origin: "https://evil.example" }),
    );
    expect(foreign.status).toBe(403);
    const noHeader = await cancelOne(
      mod,
      WITHDRAWAL_ID,
      without(deleting(mod), CSRF_HEADER),
    );
    expect(noHeader.status).toBe(403);
    expect(sent).toHaveLength(0);

    expect((await cancelOne(mod, WITHDRAWAL_ID)).status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it("answers 401 AUTH_TOKEN_EXPIRED without a session and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: PAID() }));

    for (const response of [
      await readOne(mod, WITHDRAWAL_ID, { host: "localhost:3000" }),
      await cancelOne(mod, WITHDRAWAL_ID, without(deleting(mod), "cookie")),
    ]) {
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    }
    expect(sent).toHaveLength(0);
  });
});

describe("Prefer and the real API", () => {
  it("never sends Prefer to the real API, even under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("API_REAL_URL", "http://real.test");
    vi.stubEnv("API_REAL_TAGS", "Payments");
    const mod = await load();
    upstreamAnswers((upstream) => {
      if (path(upstream).startsWith("/v1/me/payout-accounts")) {
        return upstream.method === "GET"
          ? { status: 200, body: example("/v1/me/payout-accounts") }
          : upstream.method === "POST"
            ? {
                status: 201,
                body: responseExample("/v1/me/payout-accounts", "post", 201),
              }
            : { status: 204 };
      }
      return upstream.method === "POST"
        ? { status: 201, body: PROCESSING() }
        : upstream.method === "DELETE"
          ? { status: 200, body: CANCELLED() }
          : { status: 200, body: PAID() };
    });
    const prefer = { prefer: "code=409" };

    await listAccounts(mod, reading(mod, prefer));
    await addAccount(mod, NEW_ACCOUNT, posting(mod, prefer));
    await removeAccount(mod, ACCOUNT_ID, deleting(mod, prefer));
    await request(mod, TO_SAVED, withdrawing(mod, prefer));
    await readOne(mod, WITHDRAWAL_ID, reading(mod, prefer));
    await cancelOne(mod, WITHDRAWAL_ID, deleting(mod, prefer));

    expect(sent).toHaveLength(6);
    expect(new Set(sent.map((r) => new URL(r.url).host))).toEqual(
      new Set(["real.test"]),
    );
    expect(sent.map((r) => r.headers.get("prefer"))).toEqual(
      Array(6).fill(null),
    );
  });
});
