// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api/schema";
import {
  terminalActivationSchema,
  terminalStatusSchema,
  tokenRotationSchema,
} from "@/lib/api/schemas";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import pkg from "../../package.json";
import { example, responseExample } from "../contract";

// Route handlers are server-only; the marker package refuses to load outside
// React's server build, which a unit test is not.
vi.mock("server-only", () => ({}));

type Activation = components["schemas"]["TerminalActivation"];

/** A fresh module graph per test, so env (NODE_ENV, host maps) is read anew. */
async function load() {
  vi.resetModules();
  const [activate, status, token, terminalSession, session] = await Promise.all(
    [
      import("@/app/api/terminal/activate/route"),
      import("@/app/api/terminal/status/route"),
      import("@/app/api/terminal/token/route"),
      import("@/lib/server/terminal-session"),
      import("@/lib/server/session"),
    ],
  );
  return {
    activate: activate.POST,
    status: status.GET,
    token: token.POST,
    ...terminalSession,
    seal: session.seal,
    open: session.open,
  };
}
type Loaded = Awaited<ReturnType<typeof load>>;

const NOW = Date.parse("2026-10-06T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ACTIVATION = () =>
  responseExample("/v1/retail/terminals/activate", "post", 200) as Activation;
const ROTATED = () =>
  responseExample("/v1/retail/terminal/token", "post", 200) as {
    access_token: string;
    expires_in: number;
  };

let sent: Request[] = [];

/** Answers each upstream call from `answer`, recording what was sent. */
function upstreamAnswers(
  answer: (request: Request) => {
    status: number;
    body?: unknown;
    headers?: Record<string, string>;
  },
) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    sent.push(request);
    const { status, body, headers } = answer(request);
    return Response.json(body, {
      status,
      headers: {
        "Content-Type":
          status >= 400 ? "application/problem+json" : "application/json",
        Date: new Date(NOW).toUTCString(),
        ...headers,
      },
    });
  });
}

const path = (request: Request) => new URL(request.url).pathname;

/** The terminal's own host (the default outside production, F8a). */
const TERMINAL_HOST = "terminal.localhost:3000";
const BASE = `http://${TERMINAL_HOST}`;

/** A real P-256 public key, as the activation screen sends it. */
async function publicKey(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  );
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  return Buffer.from(spki).toString("base64");
}

/** What the terminal's own page sends with a POST (`terminalRequest`). */
const SAME_SITE = {
  host: TERMINAL_HOST,
  "content-type": "application/json",
  [CSRF_HEADER]: CSRF_VALUE,
};

const activate = (
  mod: Loaded,
  body: unknown,
  headers: Record<string, string> = SAME_SITE,
) =>
  mod.activate(
    new Request(`${BASE}/api/terminal/activate`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );

/** A signature's shape: base64 of WebCrypto's 64 bytes. Its bytes are the API's to check. */
const SIGNATURE = Buffer.alloc(64, 7).toString("base64");

const signed = (timestamp: number = NOW) => ({
  "X-Device-Timestamp": String(timestamp),
  "X-Device-Signature": SIGNATURE,
});

const terminal = (expiresAt = NOW + 80 * DAY, tenant = "demo") => ({
  tenant,
  terminalId: "01J9A900000000000000000001",
  token: "eyJ.terminal.token",
  expiresAt,
});

function withCookie(
  mod: Loaded,
  session: ReturnType<typeof terminal> | null,
  headers: Record<string, string> = {},
) {
  return {
    host: TERMINAL_HOST,
    ...(session
      ? { cookie: `${mod.TERMINAL_COOKIE}=${mod.sealTerminal(session)}` }
      : {}),
    ...headers,
  };
}

const status = (mod: Loaded, headers: Record<string, string>) =>
  mod.status(new Request(`${BASE}/api/terminal/status`, { headers }));

const rotate = (mod: Loaded, headers: Record<string, string>) =>
  mod.token(
    new Request(`${BASE}/api/terminal/token`, { method: "POST", headers }),
  );

/** The terminal session a `Set-Cookie` stores, or null when it clears it. */
function storedIn(mod: Loaded, response: Response) {
  const header = response.headers.get("set-cookie") ?? "";
  const value = header.match(
    new RegExp(`^${mod.TERMINAL_COOKIE}=([^;]*)`),
  )?.[1];
  return value ? mod.openTerminal(value) : null;
}

beforeEach(() => {
  sent = [];
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/terminal/activate (AC-4)", () => {
  it("activates: the token goes into a sealed httpOnly cookie, never the answer", async () => {
    const mod = await load();
    const key = await publicKey();
    upstreamAnswers(() => ({ status: 200, body: ACTIVATION() }));

    const response = await activate(mod, {
      activationCode: "K7Q2M9XP",
      devicePublicKey: key,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(terminalActivationSchema.parse(body)).toEqual({
      id: "01J9A900000000000000000001",
      label: "PC 3",
      shop: { code: "ADM-004", name: "Adama Kebele 04" },
    });
    expect(JSON.stringify(body)).not.toContain(ACTIVATION().access_token);

    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe("POST");
    expect(path(sent[0])).toBe("/v1/retail/terminals/activate");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(sent[0].headers.get("authorization")).toBeNull();
    expect(await sent[0].json()).toEqual({
      activation_code: "K7Q2M9XP",
      device_public_key: key,
      app_version: pkg.version,
    });

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^kelal\.terminal=v1\./);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain");
    expect(cookie).not.toContain(ACTIVATION().access_token);
    // The token's 90 days, plus the 30 that let a lapsed terminal be told so.
    expect(cookie).toContain(`Max-Age=${7_776_000 + 30 * 24 * 60 * 60}`);
    expect(storedIn(mod, response)).toEqual({
      tenant: "demo",
      terminalId: "01J9A900000000000000000001",
      token: ACTIVATION().access_token,
      expiresAt: NOW + 7_776_000 * 1000,
    });
  });

  it("passes a wrong code (404), an expired code (410) and too many tries (429, Retry-After) through, and stores nothing", async () => {
    const key = await publicKey();
    const cases = [
      { status: 404, code: "NOT_FOUND", retryAfter: null },
      { status: 410, code: "RETAIL_ACTIVATION_EXPIRED", retryAfter: null },
      { status: 429, code: "RATE_LIMITED", retryAfter: "1800" },
    ];
    for (const refusal of cases) {
      const mod = await load();
      const problem = {
        ...(responseExample(
          "/v1/retail/terminals/activate",
          "post",
          refusal.status,
        ) as object),
        code: refusal.code,
      };
      upstreamAnswers(() => ({
        status: refusal.status,
        body: problem,
        headers: refusal.retryAfter
          ? { "Retry-After": refusal.retryAfter }
          : undefined,
      }));
      const response = await activate(mod, {
        activationCode: "K7Q2M9XP",
        devicePublicKey: key,
      });
      expect(response.status).toBe(refusal.status);
      expect((await response.json()).code).toBe(refusal.code);
      expect(response.headers.get("retry-after")).toBe(refusal.retryAfter);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });

  it("refuses a malformed code, another site and a player host before calling the API", async () => {
    const mod = await load();
    const key = await publicKey();
    upstreamAnswers(() => ({ status: 200, body: ACTIVATION() }));

    const malformed = await activate(mod, {
      activationCode: "k7q2-m9xp",
      devicePublicKey: key,
    });
    expect(malformed.status).toBe(422);
    const notAKey = await activate(mod, {
      activationCode: "K7Q2M9XP",
      devicePublicKey: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...",
    });
    expect(notAKey.status).toBe(422);

    const crossSite = await activate(
      mod,
      { activationCode: "K7Q2M9XP", devicePublicKey: key },
      { ...SAME_SITE, origin: "https://evil.example" },
    );
    expect(crossSite.status).toBe(403);
    const noHeader = await activate(
      mod,
      { activationCode: "K7Q2M9XP", devicePublicKey: key },
      { host: TERMINAL_HOST, "content-type": "application/json" },
    );
    expect(noHeader.status).toBe(403);

    const playerHost = await activate(
      mod,
      { activationCode: "K7Q2M9XP", devicePublicKey: key },
      { ...SAME_SITE, host: "localhost:3000" },
    );
    expect(playerHost.status).toBe(404);

    expect(sent).toHaveLength(0);
  });
});

describe("GET /api/terminal/status (AC-2, AC-4, AC-5)", () => {
  it("says inactive without calling the API when the PC holds no terminal cookie of its own", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/retail/terminal"),
    }));

    for (const headers of [
      withCookie(mod, null),
      // Another tenant's, garbage, and a player's session cookie under the terminal's name.
      withCookie(mod, terminal(NOW + 80 * DAY, "kelal")),
      { host: TERMINAL_HOST, cookie: `${mod.TERMINAL_COOKIE}=v1.x.y.z` },
      {
        host: TERMINAL_HOST,
        cookie: `${mod.TERMINAL_COOKIE}=${mod.seal({
          tenant: "demo",
          access: "eyJ.player",
          refresh: "rt_player",
          expiresAt: NOW + DAY,
        })}`,
      },
    ]) {
      const response = await status(mod, { ...headers, ...signed() });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        state: "inactive",
        reason: "new",
      });
    }
    expect(sent).toHaveLength(0);
  });

  it("forwards the device id, timestamp, signature and token to the API (AC-2)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/retail/terminal"),
    }));

    const timestamp = NOW - 2_000;
    const response = await status(
      mod,
      withCookie(mod, terminal(), signed(timestamp)),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(terminalStatusSchema.parse(await response.json())).toEqual({
      state: "active",
      rotateDue: false,
      terminal: {
        id: "01J9A900000000000000000001",
        label: "PC 3",
        shop: { code: "ADM-004", name: "Adama Kebele 04", openNow: true },
        idleResetSeconds: 90,
        codeDisplaySeconds: 60,
      },
    });
    expect(sent).toHaveLength(1);
    const call = sent[0];
    expect(call.method).toBe("GET");
    expect(path(call)).toBe("/v1/retail/terminal");
    expect(call.headers.get("authorization")).toBe("Bearer eyJ.terminal.token");
    expect(call.headers.get("x-device-id")).toBe("01J9A900000000000000000001");
    expect(call.headers.get("x-device-timestamp")).toBe(String(timestamp));
    expect(call.headers.get("x-device-signature")).toBe(SIGNATURE);
    expect(call.headers.get("x-tenant-id")).toBe("demo");
  });

  it("names the device from the sealed cookie, never from the browser (AC-2)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/retail/terminal"),
    }));
    await status(
      mod,
      withCookie(mod, terminal(), {
        ...signed(),
        "X-Device-Id": "someone-else",
      }),
    );
    expect(sent[0].headers.get("x-device-id")).toBe(
      "01J9A900000000000000000001",
    );
  });

  it("refuses a status read without valid device headers, and calls nothing (AC-2)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/retail/terminal"),
    }));
    for (const headers of <Record<string, string>[]>[
      {},
      { "X-Device-Signature": SIGNATURE },
      { "X-Device-Timestamp": String(NOW) },
      { "X-Device-Timestamp": "soon", "X-Device-Signature": SIGNATURE },
      { "X-Device-Timestamp": `${NOW}.5`, "X-Device-Signature": SIGNATURE },
      {
        "X-Device-Timestamp": String(NOW),
        "X-Device-Signature": "not base64!",
      },
      {
        "X-Device-Timestamp": String(NOW),
        "X-Device-Signature": "A".repeat(400),
      },
    ]) {
      const response = await status(mod, withCookie(mod, terminal(), headers));
      expect(response.status, JSON.stringify(headers)).toBe(400);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    expect(sent).toHaveLength(0);
  });

  it("answers a skewed clock with the server's time instead of calling the API (AC-2)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/retail/terminal"),
    }));

    for (const timestamp of [NOW - 21_000, NOW + 21_000, NOW - 3_600_000]) {
      const response = await status(
        mod,
        withCookie(mod, terminal(), signed(timestamp)),
      );
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const problem = await response.json();
      expect(problem.code).toBe("VALIDATION_FAILED");
      expect(problem.errors).toEqual([
        {
          field: "X-Device-Timestamp",
          code: "CLOCK_SKEW",
          current: String(NOW),
        },
      ]);
    }
    expect(sent).toHaveLength(0);
  });

  it("says rotation is due when fewer than 7 days of the token remain, and not before (AC-5)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/retail/terminal"),
    }));
    const due = async (expiresAt: number) =>
      (
        await (
          await status(mod, withCookie(mod, terminal(expiresAt), signed()))
        ).json()
      ).rotateDue;

    expect(await due(NOW + 80 * DAY)).toBe(false);
    expect(await due(NOW + 7 * DAY)).toBe(false);
    expect(await due(NOW + 7 * DAY - 60_000)).toBe(true);
    expect(await due(NOW + 60_000)).toBe(true);
  });

  it("says blocked for a revoked status and for AUTH_INVALID_CREDENTIALS, and keeps the cookie (AC-4)", async () => {
    const answers = [
      {
        status: 200,
        body: { ...example("/v1/retail/terminal"), status: "revoked" },
      },
      { status: 401, body: responseExample("/v1/retail/terminal", "get", 401) },
    ];
    for (const answer of answers) {
      const mod = await load();
      upstreamAnswers(() => answer);
      const response = await status(mod, withCookie(mod, terminal(), signed()));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        state: "blocked",
        reason: "revoked",
      });
      // Kept, so a reload asks the API again and is told the same.
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });

  it("says the PC isn't allowed when the API answers RETAIL_DEVICE_NOT_ALLOWED (AC-4)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 403,
      body: {
        type: "https://api.example.et/errors/device-not-allowed",
        title: "This device is not allowed",
        status: 403,
        code: "RETAIL_DEVICE_NOT_ALLOWED",
      },
    }));
    const response = await status(mod, withCookie(mod, terminal(), signed()));
    expect(await response.json()).toEqual({
      state: "blocked",
      reason: "device_not_allowed",
    });
  });

  it("clears the cookie and asks for a new code when the token has expired", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 401,
      body: {
        type: "https://api.example.et/errors/token-expired",
        title: "Token expired",
        status: 401,
        code: "AUTH_TOKEN_EXPIRED",
      },
    }));
    const expired = await status(mod, withCookie(mod, terminal(), signed()));
    expect(await expired.json()).toEqual({
      state: "inactive",
      reason: "expired",
    });
    expect(expired.headers.get("set-cookie")).toMatch(
      /^kelal\.terminal=; Max-Age=0/,
    );
    expect(sent).toHaveLength(1);

    // A token past its expiry is known lapsed without asking, signed or not.
    const lapsed = await status(mod, withCookie(mod, terminal(NOW - 1)));
    expect(await lapsed.json()).toEqual({
      state: "inactive",
      reason: "expired",
    });
    expect(lapsed.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect(sent).toHaveLength(1);
  });

  it("passes any other API failure through as its Problem", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 503,
      body: {
        type: "https://api.example.et/errors/unavailable",
        title: "Unavailable",
        status: 503,
        code: "SERVICE_UNAVAILABLE",
      },
    }));
    const response = await status(mod, withCookie(mod, terminal(), signed()));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("SERVICE_UNAVAILABLE");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("forwards Prism's Prefer under next dev only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const dev = await load();
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/retail/terminal"),
    }));
    await status(
      dev,
      withCookie(dev, terminal(), { ...signed(), prefer: "code=401" }),
    );
    expect(sent[0].headers.get("prefer")).toBe("code=401");

    vi.stubEnv("NODE_ENV", "test");
    const test = await load();
    sent = [];
    upstreamAnswers(() => ({
      status: 200,
      body: example("/v1/retail/terminal"),
    }));
    await status(
      test,
      withCookie(test, terminal(), { ...signed(), prefer: "code=401" }),
    );
    expect(sent[0].headers.get("prefer")).toBeNull();
  });
});

describe("POST /api/terminal/token (AC-5)", () => {
  it("rotates: the new token replaces the cookie, from a signed call made with the old one", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: ROTATED() }));

    const response = await rotate(
      mod,
      withCookie(mod, terminal(NOW + 6 * DAY), {
        [CSRF_HEADER]: CSRF_VALUE,
        ...signed(),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(tokenRotationSchema.parse(await response.json())).toEqual({
      rotated: true,
    });
    expect(sent).toHaveLength(1);
    const call = sent[0];
    expect(call.method).toBe("POST");
    expect(path(call)).toBe("/v1/retail/terminal/token");
    expect(call.headers.get("authorization")).toBe("Bearer eyJ.terminal.token");
    expect(call.headers.get("x-device-id")).toBe("01J9A900000000000000000001");
    expect(call.headers.get("x-device-timestamp")).toBe(String(NOW));
    expect(call.headers.get("x-device-signature")).toBe(SIGNATURE);
    // Signed over no body: nothing goes up.
    expect(await call.text()).toBe("");

    expect(storedIn(mod, response)).toEqual({
      ...terminal(),
      token: ROTATED().access_token,
      expiresAt: NOW + ROTATED().expires_in * 1000,
    });
  });

  it("refuses a rotation from another site, or with no terminal cookie, or unsigned, before calling the API", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: ROTATED() }));

    const noHeader = await rotate(mod, withCookie(mod, terminal(), signed()));
    expect(noHeader.status).toBe(403);
    const crossSite = await rotate(
      mod,
      withCookie(mod, terminal(), {
        [CSRF_HEADER]: CSRF_VALUE,
        "sec-fetch-site": "cross-site",
        ...signed(),
      }),
    );
    expect(crossSite.status).toBe(403);
    const noCookie = await rotate(
      mod,
      withCookie(mod, null, { [CSRF_HEADER]: CSRF_VALUE, ...signed() }),
    );
    expect(noCookie.status).toBe(401);
    const unsigned = await rotate(
      mod,
      withCookie(mod, terminal(), { [CSRF_HEADER]: CSRF_VALUE }),
    );
    expect(unsigned.status).toBe(400);
    const playerHost = await rotate(mod, {
      ...withCookie(mod, terminal(), {
        [CSRF_HEADER]: CSRF_VALUE,
        ...signed(),
      }),
      host: "localhost:3000",
    });
    expect(playerHost.status).toBe(404);

    expect(sent).toHaveLength(0);
  });

  it("passes a refused rotation through without touching the cookie", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 401,
      body: responseExample("/v1/retail/terminal/token", "post", 401),
    }));
    const response = await rotate(
      mod,
      withCookie(mod, terminal(), { [CSRF_HEADER]: CSRF_VALUE, ...signed() }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("the terminal cookie", () => {
  it("never opens as a player's session, nor a player's session as a terminal's", async () => {
    const mod = await load();
    const player = {
      tenant: "demo",
      access: "eyJ.player",
      refresh: "rt_player",
      expiresAt: NOW + DAY,
    };
    expect(mod.openTerminal(mod.seal(player))).toBeNull();
    expect(mod.open(mod.sealTerminal(terminal()))).toBeNull();
    expect(mod.openTerminal(mod.sealTerminal(terminal()))).toEqual(terminal());
  });
});
