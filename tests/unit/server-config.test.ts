import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const load = async () => {
  vi.resetModules();
  return import("@/lib/server/config");
};

afterEach(() => vi.unstubAllEnvs());

describe("server configuration", () => {
  it("routes tags to the real API as configured (D7)", async () => {
    vi.stubEnv("API_REAL_URL", "http://localhost:8000");
    vi.stubEnv("API_REAL_TAGS", "Catalogue, Config");

    const { usesRealApi, baseUrlFor } = await load();

    expect(usesRealApi("Catalogue")).toBe(true);
    expect(baseUrlFor("Catalogue")).toBe("http://localhost:8000");
    expect(usesRealApi("Bookings")).toBe(false);
  });

  it("refuses to send anonymous bookings to the real API before contract request 004", async () => {
    vi.stubEnv("API_REAL_URL", "http://localhost:8000");
    vi.stubEnv("API_REAL_TAGS", "Catalogue,Bookings");

    await expect(load()).rejects.toThrow(/contract request 004/);
  });
});

describe("the session secret", () => {
  it("refuses to start in production without SESSION_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const { sessionSecret } = await load();
    expect(() => sessionSecret()).toThrow(/SESSION_SECRET/);
    // The server's startup hook is what asks.
    const { register } = await import("@/instrumentation");
    await expect(register()).rejects.toThrow(/SESSION_SECRET/);
  });

  it("refuses a short secret, and the development key, in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { sessionSecret, DEVELOPMENT_SESSION_SECRET } = await load();

    vi.stubEnv("SESSION_SECRET", "too-short");
    expect(() => sessionSecret()).toThrow(/SESSION_SECRET/);
    vi.stubEnv("SESSION_SECRET", DEVELOPMENT_SESSION_SECRET);
    expect(() => sessionSecret()).toThrow(/SESSION_SECRET/);
    vi.stubEnv("SESSION_SECRET", "a".repeat(48));
    expect(sessionSecret()).toBe("a".repeat(48));
  });

  it("refuses to send logins to the real API before contract request 004, like bookings", async () => {
    vi.stubEnv("API_REAL_URL", "http://localhost:8000");
    vi.stubEnv("API_REAL_TAGS", "Catalogue,Auth");
    await expect(load()).rejects.toThrow(/contract request 004/);
  });

  it("falls back to a development key outside production, and the build needs none", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_SECRET", "");
    const { sessionSecret } = await load();
    expect(sessionSecret().length).toBeGreaterThanOrEqual(32);

    // `next build` evaluates the server modules with NODE_ENV=production and
    // no secret: importing must not throw; only using the secret does.
    vi.stubEnv("NODE_ENV", "production");
    const built = await load();
    expect(() => built.sessionSecret()).toThrow(/SESSION_SECRET/);
    const { register } = await import("@/instrumentation");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await expect(register()).resolves.toBeUndefined();
  });
});

describe("the tenant and its public address (AC-7: forwarded headers only behind a trusted proxy)", () => {
  it("ignores X-Forwarded-Host without a trusted proxy", async () => {
    vi.stubEnv("TENANT_HOST_MAP", "kelalsport.et=kelal,localhost=demo");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "");
    const { tenantFromHeaders, clientIpFromHeaders, publicOrigin } =
      await load();
    const forged = new Headers({
      host: "localhost:3000",
      "x-forwarded-host": "kelalsport.et",
      "x-forwarded-proto": "https",
      "x-forwarded-for": "203.0.113.9",
    });
    expect(tenantFromHeaders(forged)).toBe("demo");
    expect(clientIpFromHeaders(forged)).toBeNull();
    expect(publicOrigin(forged, "demo")).toBe("http://localhost:3000");
  });

  it("takes the host and the player's address from the trusted hop", async () => {
    vi.stubEnv("TENANT_HOST_MAP", "kelalsport.et=kelal,localhost=demo");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    const { tenantFromHeaders, clientIpFromHeaders, publicOrigin } =
      await load();
    const headers = new Headers({
      host: "web.internal:3000",
      "x-forwarded-host": "kelalsport.et",
      "x-forwarded-proto": "https",
      // The edge appended the player's address after whatever the client sent.
      "x-forwarded-for": "1.2.3.4, 196.188.120.7",
    });
    expect(tenantFromHeaders(headers)).toBe("kelal");
    expect(clientIpFromHeaders(headers)).toBe("196.188.120.7");
    expect(publicOrigin(headers, "kelal")).toBe("https://kelalsport.et");
  });

  it("counts the trusted hops from the right of X-Forwarded-For, never the first entry", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    const { clientIpFromHeaders } = await load();
    expect(
      clientIpFromHeaders(
        new Headers({ "x-forwarded-for": "1.2.3.4, 196.188.120.7, 10.0.0.2" }),
      ),
    ).toBe("196.188.120.7");
    // Fewer entries than hops: nothing trustworthy.
    expect(
      clientIpFromHeaders(new Headers({ "x-forwarded-for": "10.0.0.2" })),
    ).toBeNull();
    // Not an address: nothing.
    expect(
      clientIpFromHeaders(
        new Headers({ "x-forwarded-for": "1.2.3.4, unknown, 10.0.0.2" }),
      ),
    ).toBeNull();
    expect(
      clientIpFromHeaders(
        new Headers({ "x-forwarded-for": "1.2.3.4, 2001:db8::7, 10.0.0.2" }),
      ),
    ).toBe("2001:db8::7");
  });

  it("refuses a trusted-proxy setting that is not a whole number", async () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "yes");
    await expect(load()).rejects.toThrow(/TRUSTED_PROXY_HOPS|trustedProxyHops/);
  });

  it("takes the forwarded host the trusted edge appended, never one the client sent", async () => {
    vi.stubEnv("TENANT_HOST_MAP", "kelalsport.et=kelal,localhost=demo");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    const { tenantFromHeaders } = await load();
    // The same rule as X-Forwarded-For: the n-th entry from the right.
    expect(
      tenantFromHeaders(
        new Headers({ "x-forwarded-host": "evil.example, kelalsport.et" }),
      ),
    ).toBe("kelal");
    expect(
      tenantFromHeaders(new Headers({ "x-forwarded-host": "kelalsport.et" })),
    ).toBe("kelal");
    // Fewer entries than hops: nothing trustworthy, so Host decides.
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    const two = await load();
    expect(
      two.tenantFromHeaders(
        new Headers({
          host: "localhost:3000",
          "x-forwarded-host": "kelalsport.et",
        }),
      ),
    ).toBe("demo");
  });

  it("links a booking from the tenant's own host, never a forwarded one it doesn't own", async () => {
    vi.stubEnv("TENANT_HOST_MAP", "kelalsport.et=kelal,localhost=demo");
    const { publicOrigin } = await load();
    expect(
      publicOrigin(
        new Headers({
          host: "kelalsport.et",
          "x-forwarded-host": "evil.example",
        }),
        "kelal",
      ),
    ).toBe("https://kelalsport.et");
  });

  it("keeps the request's own host (and port) when the tenant owns it", async () => {
    vi.stubEnv("TENANT_HOST_MAP", "kelalsport.et=kelal,localhost=demo");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    const { publicOrigin } = await load();
    expect(publicOrigin(new Headers({ host: "localhost:3000" }), "demo")).toBe(
      "http://localhost:3000",
    );
    expect(
      publicOrigin(
        new Headers({
          "x-forwarded-host": "kelalsport.et",
          "x-forwarded-proto": "http, https",
        }),
        "kelal",
      ),
    ).toBe("https://kelalsport.et");
  });

  it("never throws on a malformed host", async () => {
    vi.stubEnv("TENANT_HOST_MAP", "");
    const { publicOrigin } = await load();
    expect(publicOrigin(new Headers({ host: "bad host/../" }), "demo")).toBe(
      "http://localhost",
    );
  });
});
