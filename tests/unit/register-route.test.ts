// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { components } from "@/lib/api/schema";
import {
  faydaChallengeSchema,
  kycResultSchema,
  otpChallengeSchema,
  registerResultSchema,
} from "@/lib/api/schemas";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { example, responseExample } from "../contract";

// Route handlers are server-only; the marker package refuses to load outside
// React's server build, which a unit test is not.
vi.mock("server-only", () => ({}));

type AuthResult = components["schemas"]["AuthResult"];

/** A fresh module graph per test, so the config and refresh caches start clean. */
async function load() {
  vi.resetModules();
  const [otp, register, reset, faydaOtp, faydaVerify, session] =
    await Promise.all([
      import("@/app/api/auth/otp/route"),
      import("@/app/api/auth/register/route"),
      import("@/app/api/auth/password/reset/route"),
      import("@/app/api/kyc/fayda/otp/route"),
      import("@/app/api/kyc/fayda/verify/route"),
      import("@/lib/server/session"),
    ]);
  return {
    otp: otp.POST,
    register: register.POST,
    reset: reset.POST,
    faydaOtp: faydaOtp.POST,
    faydaVerify: faydaVerify.POST,
    ...session,
  };
}
type Loaded = Awaited<ReturnType<typeof load>>;

let sent: Request[] = [];
let config: unknown;

/**
 * Stubs the API. `/v1/config/public` answers with `config` (the contract's
 * example unless a test changes it); everything else with `answer`.
 */
function upstreamAnswers(
  answer: (request: Request) => { status: number; body?: unknown },
) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const { status, body } =
      new URL(request.url).pathname === "/v1/config/public"
        ? { status: 200, body: config }
        : (sent.push(request), answer(request));
    if (status === 204) return new Response(null, { status });
    return Response.json(body, {
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

/** What this site's own pages send on every POST (`apiClient`). */
const SAME_SITE = {
  host: "localhost:3000",
  "content-type": "application/json",
  [CSRF_HEADER]: CSRF_VALUE,
};

const post = (
  handler: (request: Request) => Promise<Response>,
  url: string,
  body: unknown,
  headers: Record<string, string> = SAME_SITE,
) =>
  handler(
    new Request(url, { method: "POST", headers, body: JSON.stringify(body) }),
  );

const OTP = "http://localhost:3000/api/auth/otp";
const REGISTER = "http://localhost:3000/api/auth/register";
const RESET = "http://localhost:3000/api/auth/password/reset";
const FAYDA_OTP = "http://localhost:3000/api/kyc/fayda/otp";
const FAYDA_VERIFY = "http://localhost:3000/api/kyc/fayda/verify";

const NOW = Date.parse("2026-10-03T09:00:00Z");

const REGISTRATION = {
  challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1S",
  otp: "482913",
  fullName: "Abebe Kebede",
  dateOfBirth: "1998-04-12",
  password: "correct horse battery",
  acceptTerms: true,
};
const RESET_FORM = {
  challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1U",
  otp: "551203",
  newPassword: "another long passphrase",
};

const live = (tenant = "demo") => ({
  tenant,
  access: "eyJ.live.access",
  refresh: "rt_live",
  expiresAt: NOW + 10 * 60_000,
});
const withSession = (mod: Loaded, session = live()) => ({
  ...SAME_SITE,
  cookie: `${mod.SESSION_COOKIE}=${mod.seal(session)}`,
});

const setCookies = (response: Response) => response.headers.getSetCookie();
const sessionCookieOf = (mod: Loaded, response: Response) =>
  setCookies(response).find((c) => c.startsWith(`${mod.SESSION_COOKIE}=`));
const deviceCookieOf = (mod: Loaded, response: Response) =>
  setCookies(response).find((c) => c.startsWith(`${mod.DEVICE_COOKIE}=`));
const valueOf = (cookie: string) =>
  cookie.split(";")[0].split("=").slice(1).join("=");

beforeEach(() => {
  sent = [];
  config = example("/v1/config/public");
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.stubEnv("TENANT_HOST_MAP", "localhost=demo,kelalsport.et=kelal");
  vi.stubEnv("TRUSTED_PROXY_HOPS", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/auth/otp", () => {
  it("sends the phone as +251… with the purpose and answers the challenge", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 202,
      body: responseExample("/v1/auth/otp", "post", 202),
    }));

    const response = await post(mod.otp, OTP, {
      phone: "0911 234 567",
      purpose: "register",
    });

    expect(response.status).toBe(200);
    expect(otpChallengeSchema.parse(await response.json())).toEqual({
      challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1S",
      expiresIn: 300,
      resendAfter: 60,
    });
    expect(sent).toHaveLength(1);
    expect(path(sent[0])).toBe("/v1/auth/otp");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(sent[0].headers.get("authorization")).toBeNull();
    expect(await sent[0].json()).toEqual({
      phone: "+251911234567",
      purpose: "register",
    });
  });

  it("passes the contract's 409 REG_PHONE_TAKEN through unchanged (AC-2)", async () => {
    const mod = await load();
    const taken = responseExample("/v1/auth/otp", "post", 409);
    upstreamAnswers(() => ({ status: 409, body: taken }));

    const response = await post(mod.otp, OTP, {
      phone: "911234567",
      purpose: "register",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(taken);
    expect((taken as { code: string }).code).toBe("REG_PHONE_TAKEN");
  });

  it("asks for a reset code the same way, and never for a login code", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 202,
      body: responseExample("/v1/auth/otp", "post", 202),
    }));

    const reset = await post(mod.otp, OTP, {
      phone: "911234567",
      purpose: "reset",
    });
    expect(reset.status).toBe(200);
    expect(await sent[0].json()).toEqual({
      phone: "+251911234567",
      purpose: "reset",
    });

    // The login code comes from login's own 202.
    sent = [];
    const login = await post(mod.otp, OTP, {
      phone: "911234567",
      purpose: "login",
    });
    expect(login.status).toBe(422);
    expect(sent).toHaveLength(0);
  });
});

describe("POST /api/auth/register", () => {
  it("sends the contract's RegisterRequest with the tenant's terms version, the UI language and this browser's device (AC-1)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 201,
      body: responseExample("/v1/auth/register", "post", 201),
    }));

    const response = await post(mod.register, REGISTER, REGISTRATION, {
      ...SAME_SITE,
      "accept-language": "am",
    });

    expect(response.status).toBe(201);
    const device = deviceCookieOf(mod, response);
    expect(device).toBeDefined();
    expect(sent).toHaveLength(1);
    expect(path(sent[0])).toBe("/v1/auth/register");
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(await sent[0].json()).toEqual({
      challenge_id: "01J9A7QK3M8X2B7Y4Z5N6P0R1S",
      otp: "482913",
      full_name: "Abebe Kebede",
      date_of_birth: "1998-04-12",
      password: "correct horse battery",
      language: "am",
      // The contract's config example: `legal.terms_version`.
      accept_terms_version: "2026-10",
      marketing_consent: false,
      device: {
        fingerprint: valueOf(device!),
        platform: "web",
        app_version: expect.any(String),
      },
    });
  });

  it("answers who was created and seals the session, never the tokens (AC-1)", async () => {
    const mod = await load();
    const result = responseExample(
      "/v1/auth/register",
      "post",
      201,
    ) as AuthResult;
    upstreamAnswers(() => ({ status: 201, body: result }));

    const response = await post(mod.register, REGISTER, REGISTRATION);

    const text = await response.text();
    expect(text).not.toContain(result.tokens.access_token);
    expect(text).not.toContain(result.tokens.refresh_token);
    expect(registerResultSchema.parse(JSON.parse(text))).toEqual({
      player: {
        id: "01J9A7R0000000000000000001",
        phone: "+251911234567",
        fullName: "Abebe Kebede",
        kycStatus: "unverified",
        language: "am",
      },
    });
    const cookie = sessionCookieOf(mod, response);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).not.toContain(result.tokens.access_token);
    expect(mod.open(valueOf(cookie!))).toEqual({
      tenant: "demo",
      access: result.tokens.access_token,
      refresh: result.tokens.refresh_token,
      expiresAt: NOW + result.tokens.expires_in * 1000,
    });
  });

  it("answers 503 when the tenant has no terms version, creating nothing", async () => {
    const mod = await load();
    delete (config as { legal?: unknown }).legal;
    upstreamAnswers(() => ({ status: 201, body: {} }));

    const response = await post(mod.register, REGISTER, REGISTRATION);

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("SERVICE_UNAVAILABLE");
    expect(sent).toHaveLength(0);
    expect(sessionCookieOf(mod, response)).toBeUndefined();
  });

  it("passes a refused code through and sets no session (AC-2)", async () => {
    const mod = await load();
    const invalid = {
      type: "https://api.example.et/errors/otp-invalid",
      title: "Wrong code",
      status: 422,
      code: "AUTH_OTP_INVALID",
      request_id: "req_1",
    };
    upstreamAnswers(() => ({ status: 422, body: invalid }));

    const response = await post(mod.register, REGISTER, REGISTRATION);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(invalid);
    expect(sessionCookieOf(mod, response)).toBeUndefined();
  });

  it("validates the body before sending anything on", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 201, body: {} }));

    for (const body of [
      { ...REGISTRATION, acceptTerms: false },
      { ...REGISTRATION, otp: "12345" },
      { ...REGISTRATION, fullName: "Ab" },
      { ...REGISTRATION, dateOfBirth: "12/04/1998" },
      { ...REGISTRATION, dateOfBirth: "1998-02-30" },
      { ...REGISTRATION, password: "short" },
      // The browser never chooses the terms version.
      { ...REGISTRATION, acceptTermsVersion: "1999-01" },
      { ...REGISTRATION, nationalId: "1234" },
    ]) {
      const response = await post(mod.register, REGISTER, body);
      expect(response.status, JSON.stringify(body)).toBe(422);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    expect(sent).toHaveLength(0);
  });
});

describe("POST /api/auth/password/reset", () => {
  it("sends the contract's request, answers 204 and signs nobody in (AC-9)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 204 }));

    const response = await post(mod.reset, RESET, RESET_FORM);

    expect(response.status).toBe(204);
    expect(await sent[0].json()).toEqual({
      challenge_id: "01J9A7QK3M8X2B7Y4Z5N6P0R1U",
      otp: "551203",
      new_password: "another long passphrase",
    });
    expect(sessionCookieOf(mod, response)).toBeUndefined();
  });

  it("passes a refused code through", async () => {
    const mod = await load();
    const expired = {
      type: "https://api.example.et/errors/otp-expired",
      title: "Code expired",
      status: 422,
      code: "AUTH_OTP_EXPIRED",
    };
    upstreamAnswers(() => ({ status: 422, body: expired }));

    const response = await post(mod.reset, RESET, RESET_FORM);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(expired);
  });
});

describe("POST /api/kyc/fayda/*", () => {
  it("without a session answers 401 AUTH_TOKEN_EXPIRED and sends nothing", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: {} }));

    for (const [handler, url, body] of [
      [mod.faydaOtp, FAYDA_OTP, { faydaNumber: "482109375516" }],
      [mod.faydaVerify, FAYDA_VERIFY, { caseId: "c1", otp: "123456" }],
    ] as const) {
      const response = await post(handler, url, body);
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("AUTH_TOKEN_EXPIRED");
    }
    expect(sent).toHaveLength(0);
  });

  it("starts Fayda with the player's bearer token and answers the challenge (AC-1)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({
      status: 202,
      body: responseExample("/v1/kyc/fayda/otp", "post", 202),
    }));

    const response = await post(
      mod.faydaOtp,
      FAYDA_OTP,
      { faydaNumber: "482109375516" },
      withSession(mod),
    );

    expect(response.status).toBe(200);
    expect(faydaChallengeSchema.parse(await response.json())).toEqual({
      caseId: "01J9A7T0000000000000000001",
      otpSentTo: "+2519••••567",
      expiresIn: 300,
    });
    expect(path(sent[0])).toBe("/v1/kyc/fayda/otp");
    expect(sent[0].headers.get("authorization")).toBe("Bearer eyJ.live.access");
    expect(await sent[0].json()).toEqual({ fayda_number: "482109375516" });
  });

  it("verifies with Fayda's code and answers each verdict the contract names (AC-10)", async () => {
    const mod = await load();
    for (const [name, expected] of [
      ["verified", { status: "verified", reasonCode: null }],
      ["pending", { status: "pending", reasonCode: null }],
      ["needs_info", { status: "needs_info", reasonCode: "NAME_MISMATCH" }],
    ] as const) {
      sent = [];
      upstreamAnswers(() => ({
        status: 200,
        body: responseExample("/v1/kyc/fayda/verify", "post", 200, name),
      }));
      const response = await post(
        mod.faydaVerify,
        FAYDA_VERIFY,
        { caseId: "01J9A7T0000000000000000001", otp: "123456" },
        withSession(mod),
      );
      expect(kycResultSchema.parse(await response.json())).toEqual(expected);
      expect(await sent[0].json()).toEqual({
        case_id: "01J9A7T0000000000000000001",
        otp: "123456",
      });
    }
  });

  it("refreshes a lapsed access token first, as for every player call", async () => {
    const mod = await load();
    upstreamAnswers((request) =>
      path(request) === "/v1/auth/refresh"
        ? {
            status: 200,
            body: {
              access_token: "eyJ.fresh",
              expires_in: 900,
              refresh_token: "rt_fresh",
            },
          }
        : {
            status: 202,
            body: responseExample("/v1/kyc/fayda/otp", "post", 202),
          },
    );

    const response = await post(
      mod.faydaOtp,
      FAYDA_OTP,
      { faydaNumber: "482109375516" },
      withSession(mod, { ...live(), expiresAt: NOW - 1 }),
    );

    expect(response.status).toBe(200);
    expect(sent.map(path)).toEqual(["/v1/auth/refresh", "/v1/kyc/fayda/otp"]);
    expect(sent[1].headers.get("authorization")).toBe("Bearer eyJ.fresh");
    expect(sessionCookieOf(mod, response)).toBeDefined();
  });

  it("passes KYC_PROVIDER_UNAVAILABLE through unchanged", async () => {
    const mod = await load();
    const down = {
      type: "https://api.example.et/errors/kyc-provider-unavailable",
      title: "Fayda is not reachable",
      status: 503,
      code: "KYC_PROVIDER_UNAVAILABLE",
    };
    upstreamAnswers(() => ({ status: 503, body: down }));

    const response = await post(
      mod.faydaOtp,
      FAYDA_OTP,
      { faydaNumber: "482109375516" },
      withSession(mod),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(down);
  });

  it("validates the body before sending anything on", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: {} }));

    for (const [handler, url, body] of [
      [mod.faydaOtp, FAYDA_OTP, { faydaNumber: "12345" }],
      [mod.faydaOtp, FAYDA_OTP, { faydaNumber: "4821 0937 5516" }],
      [mod.faydaVerify, FAYDA_VERIFY, { caseId: "c1", otp: "12" }],
      [mod.faydaVerify, FAYDA_VERIFY, { caseId: "", otp: "123456" }],
    ] as const) {
      const response = await post(handler, url, body, withSession(mod));
      expect(response.status, JSON.stringify(body)).toBe(422);
    }
    expect(sent).toHaveLength(0);
  });
});

describe("every F4b POST", () => {
  it("is refused cross-origin, without the CSRF header, or when it is not JSON (AC-4)", async () => {
    const mod = await load();
    upstreamAnswers(() => ({ status: 200, body: {} }));

    const handlers = [
      [mod.otp, OTP],
      [mod.register, REGISTER],
      [mod.reset, RESET],
      [mod.faydaOtp, FAYDA_OTP],
      [mod.faydaVerify, FAYDA_VERIFY],
    ] as const;
    for (const [handler, url] of handlers) {
      const foreign = await post(
        handler,
        url,
        {},
        {
          ...SAME_SITE,
          origin: "https://evil.example",
        },
      );
      expect(foreign.status, url).toBe(403);
      const noHeader = await post(
        handler,
        url,
        {},
        {
          host: "localhost:3000",
          "content-type": "application/json",
        },
      );
      expect(noHeader.status, url).toBe(403);
      const form = await post(
        handler,
        url,
        {},
        {
          ...SAME_SITE,
          "content-type": "application/x-www-form-urlencoded",
        },
      );
      expect(form.status, url).toBe(415);
    }
    expect(sent).toHaveLength(0);
  });

  it("forwards Prism's Prefer under next dev only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const mod = await load();
    upstreamAnswers(() => ({
      status: 409,
      body: responseExample("/v1/auth/otp", "post", 409),
    }));

    await post(
      mod.otp,
      OTP,
      { phone: "911234567", purpose: "register" },
      { ...SAME_SITE, prefer: "code=409" },
    );
    expect(sent[0].headers.get("prefer")).toBe("code=409");
  });
});
