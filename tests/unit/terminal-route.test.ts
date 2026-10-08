// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api/schema";
import { z } from "zod";
import { boardSectionSchema, sportSchema } from "@/lib/api/catalogue-schemas";
import { toBettingRules } from "@/lib/api/mappers/config";
import {
  terminalActivationSchema,
  terminalConfigSchema,
  terminalStatusSchema,
  tokenRotationSchema,
} from "@/lib/api/terminal-schemas";
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

  it("keeps saying the activation lapsed, read after read, when the token has expired (S1)", async () => {
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
    // The cookie stays (its token is dead either way), so the next read says
    // the same and the technician still sees why: a new activation replaces it.
    for (let read = 0; read < 2; read += 1) {
      const expired = await status(mod, withCookie(mod, terminal(), signed()));
      expect(await expired.json()).toEqual({
        state: "inactive",
        reason: "expired",
      });
      expect(expired.headers.get("set-cookie")).toBeNull();
    }
    expect(sent).toHaveLength(2);

    // A token past its expiry is known lapsed without asking, signed or not.
    const lapsed = await status(mod, withCookie(mod, terminal(NOW - 1)));
    expect(await lapsed.json()).toEqual({
      state: "inactive",
      reason: "expired",
    });
    expect(lapsed.headers.get("set-cookie")).toBeNull();
    expect(sent).toHaveLength(2);
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

/** The kiosk's reads (F8ca), with the cookie helpers of the routes above. */
async function loadReads() {
  const mod = await load();
  const [config, sports, board, top, countries, event, search, booking, books] =
    await Promise.all([
      import("@/app/api/terminal/config/route"),
      import("@/app/api/terminal/catalogue/sports/route"),
      import("@/app/api/terminal/catalogue/board/route"),
      import("@/app/api/terminal/catalogue/competitions/top/route"),
      import("@/app/api/terminal/catalogue/competitions/countries/route"),
      import("@/app/api/terminal/catalogue/events/[id]/route"),
      import("@/app/api/terminal/catalogue/search/route"),
      import("@/app/api/terminal/bookings/[code]/route"),
      import("@/app/api/terminal/bookings/route"),
    ]);
  return {
    ...mod,
    config: config.GET,
    sports: sports.GET,
    board: board.GET,
    top: top.GET,
    countries: countries.GET,
    search: search.GET,
    bookBet: books.POST,
    booking: (request: Request) =>
      booking.GET(request, {
        params: Promise.resolve({
          code: decodeURIComponent(
            new URL(request.url).pathname.split("/").at(-1)!,
          ),
        }),
      }),
    /** The match route, called as Next calls it: with its id. */
    event: (request: Request) =>
      event.GET(request, {
        params: Promise.resolve({
          id: decodeURIComponent(
            new URL(request.url).pathname.split("/").at(-1)!,
          ),
        }),
      }),
  };
}
type Reads = Awaited<ReturnType<typeof loadReads>>;

/** Answers the catalogue's and config's operations from the contract's examples. */
function catalogueAnswers() {
  upstreamAnswers((request) => {
    switch (path(request)) {
      case "/v1/dictionary":
        return { status: 200, body: example("/v1/dictionary") };
      case "/v1/sports":
        return { status: 200, body: example("/v1/sports") };
      case "/v1/events":
        return { status: 200, body: example("/v1/events") };
      case "/v1/config/public":
        return { status: 200, body: example("/v1/config/public") };
      case "/v1/search":
        return { status: 200, body: example("/v1/search") };
      case "/v1/bookings/7KQ2M9X":
        return { status: 200, body: example("/v1/bookings/{code}") };
      default:
        if (path(request).startsWith("/v1/events/")) {
          return { status: 200, body: example("/v1/events/{id}") };
        }
        return { status: 404, body: { code: "NOT_FOUND" } };
    }
  });
}

const read = async (
  route: (request: Request) => Response | Promise<Response>,
  url: string,
  headers: Record<string, string>,
) => route(new Request(`${BASE}${url}`, { headers }));

/** Each of the kiosk's reads, with what it is asked. */
const READS = (mod: Reads) =>
  [
    [mod.config, "/api/terminal/config"],
    [mod.sports, "/api/terminal/catalogue/sports"],
    [mod.board, "/api/terminal/catalogue/board?sport=s_football"],
    [mod.top, "/api/terminal/catalogue/competitions/top"],
    [mod.countries, "/api/terminal/catalogue/competitions/countries"],
    [mod.event, `/api/terminal/catalogue/events/${EVENT_ID}`],
    [mod.search, "/api/terminal/catalogue/search?q=saint"],
    [mod.booking, "/api/terminal/bookings/7KQ2M9X"],
  ] as const;

/** The contract's match: the one `/v1/events/{id}`'s example describes. */
const EVENT_ID = example("/v1/events/{id}").id;

describe("the kiosk's reads (F8ca AC-1, AC-5)", () => {
  it("answers the kiosk's reads only on a terminal host (AC-5)", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    for (const [route, url] of READS(mod)) {
      const response = await route(
        new Request(`http://localhost:3000${url}`, {
          headers: {
            host: "localhost:3000",
            cookie: `${mod.TERMINAL_COOKIE}=${mod.sealTerminal(terminal())}`,
          },
        }),
      );
      expect(response.status, url).toBe(404);
      // Never cached: a shared cache must not serve one host's 404 to the other (review SEC2).
      expect(response.headers.get("cache-control"), url).toBe("no-store");
    }
    expect(sent).toHaveLength(0);
  });

  it("refuses the kiosk's reads without an activated terminal, and calls nothing (AC-5)", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    for (const headers of [
      withCookie(mod, null),
      withCookie(mod, terminal(NOW + 80 * DAY, "kelal")),
      withCookie(mod, terminal(NOW - 1)),
      { host: TERMINAL_HOST, cookie: `${mod.TERMINAL_COOKIE}=v1.x.y.z` },
    ]) {
      for (const [route, url] of READS(mod)) {
        const response = await read(route, url, headers);
        expect(response.status, url).toBe(401);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toMatchObject({
          code: "AUTH_INVALID_CREDENTIALS",
        });
      }
    }
    expect(sent).toHaveLength(0);
  });

  it("reads the sports for a terminal (AC-1)", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    const response = await read(
      mod.sports,
      "/api/terminal/catalogue/sports",
      withCookie(mod, terminal()),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const sports = z.array(sportSchema).parse(await response.json());
    expect(sports.map((sport) => sport.id)).toEqual(
      example("/v1/sports").items.map((sport) => sport.id),
    );
    // Anonymous, as the contract allows (decision 2): no token, no device.
    for (const request of sent) {
      expect(request.headers.get("authorization")).toBeNull();
      expect(request.headers.get("x-device-id")).toBeNull();
      expect(request.headers.get("x-tenant-id")).toBe("demo");
    }
  });

  it("reads the board for a terminal: the sport, the day and the filter go upstream, the board comes back (AC-1)", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    const response = await read(
      mod.board,
      "/api/terminal/catalogue/board?sport=s_football&date=2026-10-07&filter=upcoming",
      withCookie(mod, terminal()),
    );
    expect(response.status).toBe(200);
    const board = z.array(boardSectionSchema).parse(await response.json());
    const events = board.flatMap((section) => section.events);
    expect(events.map((row) => row.event.id).sort()).toEqual(
      example("/v1/events")
        .items.map((event) => event.id)
        .sort(),
    );

    const asked = sent.filter((request) => path(request) === "/v1/events");
    expect(asked.length).toBeGreaterThan(0);
    for (const request of asked) {
      const query = new URL(request.url).searchParams;
      expect(query.get("sport")).toBe("s_football");
      expect(query.get("date")).toBe("2026-10-07");
      expect(query.get("sort")).toBe("start_time");
    }
  });

  it("refuses a board query it doesn't know before calling the API (AC-5)", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    for (const [query, field] of [
      ["sport=football", "sport"],
      ["sport=s_football%2F..%2Fx", "sport"],
      [`sport=s_${"x".repeat(65)}`, "sport"],
      ["sport=s_football&date=07-10-2026", "date"],
      ["sport=s_football&date=2026-10-07T00:00", "date"],
      ["sport=s_football&filter=live", "filter"],
      ["sport=s_football&live=1", "live"],
      ["sport=s_football&competition=t_epl%2F..", "competition"],
      ["sport=s_football&sport=s_tennis", "sport"],
      // A date that is the right shape but not a day (review SEC3).
      ["sport=s_football&date=2026-02-30", "date"],
      ["sport=s_football&date=9999-99-99", "date"],
      // An unknown key is named only when it is a plain name.
      [`sport=s_football&${"x".repeat(80)}=1`, "query"],
      ["sport=s_football&%3Cscript%3E=1", "query"],
    ]) {
      const response = await read(
        mod.board,
        `/api/terminal/catalogue/board?${query}`,
        withCookie(mod, terminal()),
      );
      expect(response.status, query).toBe(400);
      const body = await response.json();
      expect(body.code, query).toBe("VALIDATION_FAILED");
      expect(body.errors, query).toEqual([expect.objectContaining({ field })]);
    }
    expect(sent).toHaveLength(0);
  });

  it("takes any sport id the API might use, as long as it is one of the kiosk's sports (review S4)", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    const response = await read(
      mod.board,
      "/api/terminal/catalogue/board?sport=s_ice-hockey.nhl",
      withCookie(mod, terminal()),
    );
    expect(response.status).toBe(200);
    expect(
      new URL(
        sent.find((request) => path(request) === "/v1/events")!.url,
      ).searchParams.get("sport"),
    ).toBe("s_ice-hockey.nhl");
  });

  it("keeps in-play and finished matches off the kiosk's board: it sells before the match only (D8, review U3)", async () => {
    const mod = await loadReads();
    const events = example("/v1/events");
    const [first, second, ...rest] = events.items;
    upstreamAnswers((request) => {
      switch (path(request)) {
        case "/v1/dictionary":
          return { status: 200, body: example("/v1/dictionary") };
        case "/v1/events":
          return {
            status: 200,
            body: {
              ...events,
              items: [
                { ...first, status: "live" },
                { ...second, status: "ended" },
                ...rest,
              ],
            },
          };
        default:
          return { status: 404, body: { code: "NOT_FOUND" } };
      }
    });
    const response = await read(
      mod.board,
      "/api/terminal/catalogue/board?sport=s_football",
      withCookie(mod, terminal()),
    );
    const board = z.array(boardSectionSchema).parse(await response.json());
    const ids = board.flatMap((section) =>
      section.events.map((row) => row.event.id),
    );
    expect(ids.sort()).toEqual(rest.map((event) => event.id).sort());
    // A competition left with nothing to sell is not shown either.
    for (const section of board)
      expect(section.events.length).toBeGreaterThan(0);
  });

  it("reads one competition's board, for its page (AC-6)", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    const response = await read(
      mod.board,
      "/api/terminal/catalogue/board?sport=s_football&competition=t_epl",
      withCookie(mod, terminal()),
    );
    expect(response.status).toBe(200);
    for (const request of sent.filter((r) => path(r) === "/v1/events")) {
      expect(new URL(request.url).searchParams.get("tournament")).toBe("t_epl");
    }
  });

  it("reads the top competitions and the countries for a terminal's sidebar (AC-6)", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    for (const [route, url] of [
      [mod.top, "/api/terminal/catalogue/competitions/top"],
      [mod.countries, "/api/terminal/catalogue/competitions/countries"],
    ] as const) {
      const response = await read(route, url, withCookie(mod, terminal()));
      expect(response.status, url).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect((await response.json()).length, url).toBeGreaterThan(0);
    }
    for (const request of sent) {
      expect(request.headers.get("authorization")).toBeNull();
    }
  });

  it("reads a match's whole book for a terminal, and nothing of a match in play (AC-7)", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    const response = await read(
      mod.event,
      `/api/terminal/catalogue/events/${EVENT_ID}`,
      withCookie(mod, terminal()),
    );
    expect(response.status).toBe(200);
    const detail = await response.json();
    expect(detail.event.id).toBe(EVENT_ID);
    expect(detail.markets.length).toBeGreaterThan(0);
    expect(
      sent.some((request) => path(request) === `/v1/events/${EVENT_ID}`),
    ).toBe(true);

    // In play: the kiosk sells before kick-off only (D8), so there is no book.
    sent = [];
    upstreamAnswers((request) =>
      path(request) === "/v1/dictionary"
        ? { status: 200, body: example("/v1/dictionary") }
        : {
            status: 200,
            body: { ...example("/v1/events/{id}"), status: "live" },
          },
    );
    const live = await read(
      mod.event,
      `/api/terminal/catalogue/events/${EVENT_ID}`,
      withCookie(mod, terminal()),
    );
    expect(live.status).toBe(200);
    expect(await live.json()).toBeNull();
  });

  it("refuses a match id or a search it can't send upstream, before calling the API", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    for (const [route, url, field] of [
      [mod.event, "/api/terminal/catalogue/events/a%2Fb", "id"],
      [mod.event, `/api/terminal/catalogue/events/${"x".repeat(65)}`, "id"],
      [mod.event, `/api/terminal/catalogue/events/${EVENT_ID}?live=1`, "live"],
      [mod.search, `/api/terminal/catalogue/search?q=${"a".repeat(51)}`, "q"],
      [mod.search, "/api/terminal/catalogue/search?q=a&q=b", "q"],
      [mod.search, "/api/terminal/catalogue/search?q=a&lite=0", "lite"],
    ] as const) {
      const response = await read(route, url, withCookie(mod, terminal()));
      expect(response.status, url).toBe(400);
      expect((await response.json()).errors, url).toEqual([
        expect.objectContaining({ field }),
      ]);
    }
    expect(sent).toHaveLength(0);
  });

  it("never puts an id of dots into an upstream path, whatever reaches the route (review SEC1)", async () => {
    const { eventQuery, boardQuery } = await import("@/lib/server/terminal");
    for (const id of [".", "..", "...", "a", "fx_arsenal_chelsea"]) {
      const result = eventQuery(id, new URLSearchParams());
      if (/^\.+$/.test(id)) {
        expect(result, id).toEqual({ field: "id", code: "FORMAT" });
      } else {
        expect(result, id).toEqual({ id });
      }
    }
    expect(
      boardQuery(new URLSearchParams("sport=s_football&competition=..")),
    ).toEqual({ field: "competition", code: "FORMAT" });
  });

  it("asks nothing for a search under the contract's two characters (review S2)", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    const response = await read(
      mod.search,
      "/api/terminal/catalogue/search?q=a",
      withCookie(mod, terminal()),
    );
    expect(await response.json()).toEqual({ leagues: [], events: [] });
    expect(sent.filter((r) => path(r) === "/v1/search")).toHaveLength(0);
  });

  it("searches for a terminal, before kick-off only (AC-8)", async () => {
    const mod = await loadReads();
    const results = example("/v1/search");
    upstreamAnswers((request) => {
      switch (path(request)) {
        case "/v1/dictionary":
          return { status: 200, body: example("/v1/dictionary") };
        case "/v1/sports":
          return { status: 200, body: example("/v1/sports") };
        case "/v1/search":
          return {
            status: 200,
            body: {
              ...results,
              // The contract's match in play, and a copy of it before kick-off.
              events: [
                { ...results.events[0], status: "live" },
                { ...results.events[0], id: "fx_before_kickoff" },
              ],
            },
          };
        default:
          return { status: 404, body: { code: "NOT_FOUND" } };
      }
    });
    const response = await read(
      mod.search,
      "/api/terminal/catalogue/search?q=saint",
      withCookie(mod, terminal()),
    );
    expect(response.status).toBe(200);
    const found = await response.json();
    expect(
      found.events.map((row: { event: { id: string } }) => row.event.id),
    ).toEqual(["fx_before_kickoff"]);
    expect(
      new URL(sent.find((r) => path(r) === "/v1/search")!.url).searchParams.get(
        "q",
      ),
    ).toBe("saint");

    // Nothing typed: nothing asked.
    sent = [];
    const empty = await read(
      mod.search,
      "/api/terminal/catalogue/search?q=%20",
      withCookie(mod, terminal()),
    );
    expect(await empty.json()).toEqual({ leagues: [], events: [] });
    expect(sent.filter((r) => path(r) === "/v1/search")).toHaveLength(0);
  });

  it("reads the kiosk's config for a terminal: retail, the languages, the default, the shop's rules (AC-3, AC-4)", async () => {
    const mod = await loadReads();
    catalogueAnswers();
    const response = await read(
      mod.config,
      "/api/terminal/config",
      withCookie(mod, terminal()),
    );
    expect(response.status).toBe(200);
    expect(terminalConfigSchema.parse(await response.json())).toEqual({
      retail: true,
      bookingCodes: true,
      languages: ["am", "en"],
      defaultLanguage: "am",
      // The shop's rule set (F8cb AC-3), never the online one.
      rules: toBettingRules(example("/v1/config/public").retail_betting!),
    });
  });

  it("loads a well-formed booking only for an activated terminal and never forwards Prefer", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const mod = await loadReads();
    catalogueAnswers();
    const response = await read(
      mod.booking,
      "/api/terminal/bookings/7KQ2M9X",
      withCookie(mod, terminal(), { prefer: "code=500" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).code).toBe("7KQ2M9X");
    // Read in both languages, for the names of each leg.
    const reads = sent.filter((request) =>
      path(request).includes("/v1/bookings/"),
    );
    expect(
      reads.map((request) => request.headers.get("accept-language")).sort(),
    ).toEqual(["am", "en"]);
    expect(
      sent.every((request) => request.headers.get("prefer") === null),
    ).toBe(true);

    sent.length = 0;
    const invalid = await read(
      mod.booking,
      "/api/terminal/bookings/not-a-code",
      withCookie(mod, terminal()),
    );
    expect(invalid.status).toBe(422);
    expect(invalid.headers.get("cache-control")).toBe("no-store");
    expect((await invalid.json()).code).toBe("VALIDATION_FAILED");
    expect(sent).toHaveLength(0);
  });

  it("books a slip for an activated terminal, with the browser's key, and refuses it otherwise before calling the API (the user's third review)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const mod = await loadReads();
    upstreamAnswers((request) =>
      path(request) === "/v1/bookings" && request.method === "POST"
        ? { status: 201, body: responseExample("/v1/bookings", "post", 201) }
        : { status: 404, body: { code: "NOT_FOUND" } },
    );
    const key = "0b7e2a5c-5d1e-4f43-9a2b-6c1d2e3f4a5b";
    const body = JSON.stringify({
      betType: "single",
      systemSizes: [],
      outcomeIds: ["oc_ac_1"],
      stake: null,
    });
    const book = (headers: Record<string, string>, payload = body) =>
      mod.bookBet(
        new Request(`${BASE}/api/terminal/bookings`, {
          method: "POST",
          headers,
          body: payload,
        }),
      );
    const signed = (extra: Record<string, string> = {}) =>
      withCookie(mod, terminal(), {
        ...SAME_SITE,
        "idempotency-key": key,
        prefer: "code=500",
        ...extra,
      });

    const created = await book(signed());
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("no-store");
    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe("POST");
    expect(sent[0].headers.get("idempotency-key")).toBe(key);
    expect(sent[0].headers.get("prefer")).toBeNull();

    sent.length = 0;
    const refusals = [
      // A player host: not the terminal's route at all.
      await book({ ...signed(), host: "localhost:3000" }),
      // No terminal cookie.
      await book({ ...SAME_SITE, "idempotency-key": key }),
      // Another site's page.
      await book(signed({ origin: "https://evil.example" })),
      // No key, or not a booking.
      await book(signed({ "idempotency-key": "" })),
      await book(signed(), JSON.stringify({ outcomeIds: [] })),
    ];
    expect(refusals.map((response) => response.status)).toEqual([
      404, 401, 403, 400, 422,
    ]);
    expect(sent).toHaveLength(0);
  });

  it("never sends Prism's Prefer upstream, not even under next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const mod = await loadReads();
    catalogueAnswers();
    for (const [route, url] of READS(mod)) {
      await read(
        route,
        url,
        withCookie(mod, terminal(), { prefer: "code=500" }),
      );
    }
    expect(sent.length).toBeGreaterThan(0);
    for (const request of sent) {
      expect(request.headers.get("prefer")).toBeNull();
    }
  });
});

describe("POST /api/terminal/slip-codes (F8cc AC-c1, AC-6)", () => {
  async function loadCodes() {
    const mod = await load();
    const route = await import("@/app/api/terminal/slip-codes/route");
    return { ...mod, getCode: route.POST };
  }
  type Codes = Awaited<ReturnType<typeof loadCodes>>;

  const KEY = "0b7e2a5c-5d1e-4f43-9a2b-6c1d2e3f4a5b";
  /**
   * The slip as the browser sends it: its exact text, with the keys in an
   * order and a spacing no serialiser of ours would produce — so a body that
   * reaches the API unchanged was forwarded, not rebuilt.
   */
  const TEXT =
    '{"legs":[{"odds":"2.10","outcome_id":"oc_ac_1"}, {"outcome_id":"oc_sg_1","odds":"1.85"}],\n "stake_hint":"50.00","bet_type":"multiple"}';

  const CREATED = () =>
    responseExample("/v1/retail/slip-codes", "post", 201) as {
      expires_at: string;
    };

  const headers = (mod: Codes, extra: Record<string, string> = {}) =>
    withCookie(mod, terminal(), {
      ...SAME_SITE,
      ...signed(),
      "idempotency-key": KEY,
      ...extra,
    });

  const getCode = (
    mod: Codes,
    head: Record<string, string>,
    body: BodyInit | null = TEXT,
  ) =>
    mod.getCode(
      new Request(`${BASE}/api/terminal/slip-codes`, {
        method: "POST",
        headers: head,
        body,
      }),
    );

  it("forwards the body byte for byte with the device headers, the device id from the cookie, the token and the key", async () => {
    const mod = await loadCodes();
    upstreamAnswers(() => ({ status: 201, body: CREATED() }));
    const response = await getCode(
      mod,
      // A device id the browser names is never the one sent.
      headers(mod, { "x-device-id": "someone-else" }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");

    expect(sent).toHaveLength(1);
    const [call] = sent;
    expect(call.method).toBe("POST");
    expect(path(call)).toBe("/v1/retail/slip-codes");
    expect(await call.text()).toBe(TEXT);
    expect(call.headers.get("x-device-id")).toBe(terminal().terminalId);
    expect(call.headers.get("x-device-timestamp")).toBe(String(NOW));
    expect(call.headers.get("x-device-signature")).toBe(SIGNATURE);
    expect(call.headers.get("authorization")).toBe(
      `Bearer ${terminal().token}`,
    );
    expect(call.headers.get("idempotency-key")).toBe(KEY);
    expect(call.headers.get("x-tenant-id")).toBe("demo");
  });

  it("answers with the code to show: the contract's 201, mapped", async () => {
    const mod = await loadCodes();
    // The real API's own expiry, in the future, is passed on untouched.
    const later = new Date(NOW + 3 * 60 * 60 * 1000).toISOString();
    upstreamAnswers(() => ({
      status: 201,
      body: { ...CREATED(), expires_at: later },
    }));
    const response = await getCode(mod, headers(mod));
    expect(await response.json()).toEqual({
      code: "48291735",
      display: "4829 1735",
      expiresAt: later,
      qr: "https://example.et/r/48291735",
    });
  });

  it("gives the mock's past example a code's life from the API's clock, and only the mock's", async () => {
    const mod = await loadCodes();
    upstreamAnswers(() => ({ status: 201, body: CREATED() }));
    const response = await getCode(mod, headers(mod));
    const { expiresAt } = (await response.json()) as { expiresAt: string };
    expect(CREATED().expires_at < new Date(NOW).toISOString()).toBe(true);
    expect(expiresAt).toBe(new Date(NOW + 240 * 60 * 1000).toISOString());
  });

  it("passes a 429 through with its Retry-After, and the API's refusals with their code and fix", async () => {
    const mod = await loadCodes();
    upstreamAnswers(() => ({
      status: 429,
      body: responseExample("/v1/retail/slip-codes", "post", 429),
      headers: { "Retry-After": "240" },
    }));
    const limited = await getCode(mod, headers(mod));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("240");
    expect(limited.headers.get("cache-control")).toBe("no-store");
    expect(await limited.json()).toMatchObject({ code: "RATE_LIMITED" });

    sent = [];
    upstreamAnswers(() => ({
      status: 422,
      body: responseExample(
        "/v1/retail/slip-codes",
        "post",
        422,
        "stake_too_low",
      ),
    }));
    const low = await getCode(mod, headers(mod));
    expect(low.status).toBe(422);
    expect(await low.json()).toMatchObject({
      code: "BET_STAKE_TOO_LOW",
      errors: [{ field: "stake", code: "MIN", limit: "5.00" }],
    });
  });

  it("refuses another host, another site, no terminal, no or a malformed key, an unsigned call or a skewed clock, and an oversized, non-UTF-8, non-JSON or off-contract body — before calling the API", async () => {
    const mod = await loadCodes();
    upstreamAnswers(() => ({ status: 201, body: CREATED() }));
    const big = JSON.stringify({
      bet_type: "multiple",
      legs: [{ outcome_id: "x".repeat(17_000) }],
    });
    const cases: [string, Promise<Response>, number, string?][] = [
      [
        "a player host",
        getCode(mod, headers(mod, { host: "localhost:3000" })),
        404,
      ],
      [
        "another site's page",
        getCode(mod, headers(mod, { origin: "https://evil.example" })),
        403,
      ],
      [
        "no CSRF header",
        getCode(mod, headers(mod, { [CSRF_HEADER]: "" })),
        403,
      ],
      [
        "not JSON's content type",
        getCode(mod, headers(mod, { "content-type": "text/plain" })),
        415,
      ],
      [
        "no terminal cookie",
        getCode(mod, {
          ...SAME_SITE,
          ...signed(),
          "idempotency-key": KEY,
        }),
        401,
        "AUTH_INVALID_CREDENTIALS",
      ],
      [
        "an expired terminal",
        getCode(mod, {
          ...withCookie(mod, terminal(NOW - 1)),
          ...SAME_SITE,
          ...signed(),
          "idempotency-key": KEY,
        }),
        401,
      ],
      [
        "no key",
        getCode(mod, headers(mod, { "idempotency-key": "" })),
        400,
        "VALIDATION_FAILED",
      ],
      [
        "a key that isn't a UUID",
        getCode(mod, headers(mod, { "idempotency-key": "again" })),
        400,
      ],
      [
        "unsigned",
        getCode(mod, headers(mod, { "X-Device-Signature": "" })),
        400,
      ],
      ["a skewed clock", getCode(mod, headers(mod, signed(NOW - 60_000))), 400],
      ["over 16 KiB", getCode(mod, headers(mod), big), 413],
      [
        "not UTF-8",
        getCode(
          mod,
          headers(mod),
          new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x7d]),
        ),
        422,
      ],
      ["a byte-order mark", getCode(mod, headers(mod), `﻿${TEXT}`), 422],
      ["not JSON", getCode(mod, headers(mod), "{legs"), 422],
      ["no body", getCode(mod, headers(mod), null), 422],
      [
        "something beside the slip",
        getCode(
          mod,
          headers(mod),
          JSON.stringify({ ...JSON.parse(TEXT), shop: "ADM-004" }),
        ),
        422,
      ],
      [
        "an id that isn't ASCII",
        getCode(
          mod,
          headers(mod),
          JSON.stringify({
            bet_type: "single",
            legs: [{ outcome_id: "oc_é" }],
          }),
        ),
        422,
      ],
    ];
    for (const [name, response, status, code] of cases) {
      const answer = await response;
      expect(answer.status, name).toBe(status);
      if (code) expect((await answer.json()).code, name).toBe(code);
      if (status !== 404) {
        expect(answer.headers.get("cache-control"), name).toBe("no-store");
      }
    }
    expect(sent).toHaveLength(0);
  });

  it("forwards Prism's Prefer under next dev only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const dev = await loadCodes();
    upstreamAnswers(() => ({ status: 201, body: CREATED() }));
    await getCode(dev, headers(dev, { prefer: "code=429" }));
    expect(sent[0].headers.get("prefer")).toBe("code=429");

    vi.stubEnv("NODE_ENV", "test");
    const test = await loadCodes();
    sent = [];
    upstreamAnswers(() => ({ status: 201, body: CREATED() }));
    await getCode(test, headers(test, { prefer: "code=429" }));
    expect(sent[0].headers.get("prefer")).toBeNull();
  });
});
