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

  it("refuses to send terminal activations to the real API before contract request 004 (F8b)", async () => {
    // Five activation attempts per IP per hour: through this server, every
    // shop would share one address and one bucket.
    vi.stubEnv("API_REAL_URL", "http://localhost:8000");
    vi.stubEnv("API_REAL_TAGS", "Catalogue,Retail - terminal");
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

describe("the payment redirect allow-list (AC-3)", () => {
  it("follows a provider page only on an allow-listed https host (AC-3)", async () => {
    vi.stubEnv(
      "PAYMENT_REDIRECT_HOSTS",
      "checkout.chapa.co, App.Ethiotelecom.et",
    );
    const { isAllowedProviderUrl } = await load();

    expect(
      isAllowedProviderUrl("https://checkout.chapa.co/checkout/payment/abc123"),
    ).toBe(true);
    expect(
      isAllowedProviderUrl("https://app.ethiotelecom.et/pay/abc?x=1#y"),
    ).toBe(true);
    // Host names are case-blind, and 443 is the default port.
    expect(isAllowedProviderUrl("https://CHECKOUT.chapa.co:443/x")).toBe(true);

    for (const url of [
      "http://checkout.chapa.co/x", // not https
      "https://evil.example/x", // another host
      "https://pay.checkout.chapa.co/x", // a subdomain of a listed host
      "https://checkout.chapa.co.evil.et/x", // a listed host as a prefix
      "https://checkout.chapa.co./x", // a trailing dot
      "https://checkout.chapa.co@evil.et/x", // the host is evil.et
      "https://player:secret@checkout.chapa.co/x", // credentials in the URL
      "https://checkout.chapa.co:8443/x", // another port
      "https:\\\\evil.et\\x", // backslashes are slashes to a browser
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "//checkout.chapa.co/x", // no scheme
      "checkout.chapa.co/x",
      "https://",
      "",
    ]) {
      expect(isAllowedProviderUrl(url), url).toBe(false);
    }
  });

  it("returns the page as it was read, so what is followed is what was checked (SEC3)", async () => {
    vi.stubEnv("PAYMENT_REDIRECT_HOSTS", "checkout.chapa.co");
    const { allowedProviderUrl } = await load();

    expect(allowedProviderUrl(" https://CHECKOUT.chapa.co:443/x?y=1#z")).toBe(
      "https://checkout.chapa.co/x?y=1#z",
    );
    expect(allowedProviderUrl("https://checkout.chapa.co\\@evil.com/")).toBe(
      "https://checkout.chapa.co/@evil.com/",
    );
    expect(allowedProviderUrl("https://evil.example/x")).toBeNull();
  });

  it("allows no host in production unless one is listed, and the contract's example hosts in development", async () => {
    vi.stubEnv("PAYMENT_REDIRECT_HOSTS", "");
    vi.stubEnv("NODE_ENV", "production");
    const production = await load();
    expect(production.serverConfig.paymentRedirectHosts).toEqual([]);
    expect(
      production.isAllowedProviderUrl(
        "https://checkout.chapa.co/checkout/payment/abc123",
      ),
    ).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    const development = await load();
    expect(development.serverConfig.paymentRedirectHosts).toEqual([
      "checkout.chapa.co",
      "app.ethiotelecom.et",
    ]);

    // A list, when given, is the list — in development too.
    vi.stubEnv("PAYMENT_REDIRECT_HOSTS", "pay.santimpay.com");
    const listed = await load();
    expect(listed.serverConfig.paymentRedirectHosts).toEqual([
      "pay.santimpay.com",
    ]);
    expect(listed.isAllowedProviderUrl("https://checkout.chapa.co/x")).toBe(
      false,
    );
  });

  it("refuses to start with an entry that is not a host name", async () => {
    vi.stubEnv("PAYMENT_REDIRECT_HOSTS", "checkout.chapa.co,https://evil.et");
    await expect(load()).rejects.toThrow(/PAYMENT_REDIRECT_HOSTS/);

    vi.stubEnv("PAYMENT_REDIRECT_HOSTS", "*.chapa.co");
    await expect(load()).rejects.toThrow(/PAYMENT_REDIRECT_HOSTS/);
  });
});

describe("the shop terminal's hosts (F8a, FD1)", () => {
  it("maps a terminal host to its tenant and marks it as a terminal", async () => {
    vi.stubEnv("TENANT_HOST_MAP", "kelalsport.et=kelal,localhost=demo");
    vi.stubEnv(
      "TERMINAL_HOST_MAP",
      "terminal.kelalsport.et=kelal, Terminal.Demo.et=demo",
    );
    const { isTerminalHost, tenantForHost, tenantFromHeaders } = await load();

    expect(isTerminalHost("terminal.kelalsport.et")).toBe(true);
    expect(isTerminalHost("terminal.demo.et:443")).toBe(true);
    expect(tenantForHost("terminal.kelalsport.et")).toBe("kelal");
    expect(
      tenantFromHeaders(new Headers({ host: "terminal.demo.et:3000" })),
    ).toBe("demo");

    // The player's hosts, and hosts in neither map, are the player site.
    for (const host of ["kelalsport.et", "localhost:3000", "other.example"]) {
      expect(isTerminalHost(host), host).toBe(false);
    }
    expect(isTerminalHost(null)).toBe(false);
    expect(tenantForHost("kelalsport.et")).toBe("kelal");
    expect(tenantForHost("other.example")).toBe("demo");
    // A fully qualified name, with its root dot, is the same host.
    expect(isTerminalHost("terminal.kelalsport.et.")).toBe(true);
    expect(isTerminalHost("terminal.kelalsport.et.:443")).toBe(true);
    expect(tenantForHost("kelalsport.et.")).toBe("kelal");
    expect(isTerminalHost("terminal.kelalsport.et..")).toBe(false);
    // Only the maps' own entries: never a name every object inherits.
    for (const host of ["toString", "constructor", "__proto__"]) {
      expect(isTerminalHost(host), host).toBe(false);
      expect(tenantForHost(host), host).toBe("demo");
    }
  });

  it("refuses to start with a host in both TENANT_HOST_MAP and TERMINAL_HOST_MAP", async () => {
    vi.stubEnv("TENANT_HOST_MAP", "kelalsport.et=kelal");
    vi.stubEnv("TERMINAL_HOST_MAP", "KelalSport.et=kelal");
    await expect(load()).rejects.toThrow(/TERMINAL_HOST_MAP/);
  });

  it("has no terminal host in production unless one is configured, and terminal.localhost elsewhere", async () => {
    vi.stubEnv("TERMINAL_HOST_MAP", "");
    vi.stubEnv("DEFAULT_TENANT", "demo");

    vi.stubEnv("NODE_ENV", "production");
    const production = await load();
    expect(production.serverConfig.terminalHostMap).toEqual({});
    expect(production.isTerminalHost("terminal.localhost:3000")).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    const development = await load();
    expect(development.serverConfig.terminalHostMap).toEqual({
      "terminal.localhost": "demo",
    });
    expect(development.isTerminalHost("terminal.localhost:3000")).toBe(true);

    // A map, when given, is the map — in development too.
    vi.stubEnv("TERMINAL_HOST_MAP", "kiosk.demo.et=demo");
    const listed = await load();
    expect(listed.isTerminalHost("terminal.localhost")).toBe(false);
    expect(listed.isTerminalHost("kiosk.demo.et")).toBe(true);
  });

  it("decides by the host tenants are read from: a forwarded host counts only behind a trusted proxy", async () => {
    vi.stubEnv("TERMINAL_HOST_MAP", "terminal.kelalsport.et=kelal");
    const { isTerminalHost, requestHost } = await load();
    const forged = new Headers({
      host: "kelalsport.et",
      "x-forwarded-host": "terminal.kelalsport.et",
    });
    expect(isTerminalHost(requestHost(forged))).toBe(false);

    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    const trusted = await load();
    expect(trusted.isTerminalHost(trusted.requestHost(forged))).toBe(true);
  });

  it("never makes a player link on a terminal host", async () => {
    vi.stubEnv("TENANT_HOST_MAP", "kelalsport.et=kelal");
    vi.stubEnv("TERMINAL_HOST_MAP", "terminal.kelalsport.et=kelal");
    const { publicOrigin, ownedOrigin } = await load();
    const onTerminal = new Headers({ host: "terminal.kelalsport.et" });

    expect(publicOrigin(onTerminal, "kelal")).toBe("https://kelalsport.et");
    expect(ownedOrigin(onTerminal, "kelal")).toBe("https://kelalsport.et");

    // A tenant with only a terminal host owns no player origin.
    vi.stubEnv("TENANT_HOST_MAP", "");
    const terminalOnly = await load();
    expect(terminalOnly.ownedOrigin(onTerminal, "kelal")).toBeNull();
  });
});
