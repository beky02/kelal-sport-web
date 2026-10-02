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

describe("the tenant and its public address", () => {
  it("takes the first host of a forwarded list instead of failing", async () => {
    vi.stubEnv("TENANT_HOST_MAP", "kelalsport.et=kelal,localhost=demo");
    const { tenantFromHeaders } = await load();
    expect(
      tenantFromHeaders(
        new Headers({ "x-forwarded-host": "kelalsport.et, proxy.internal" }),
      ),
    ).toBe("kelal");
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
    const { publicOrigin } = await load();
    expect(publicOrigin(new Headers({ host: "localhost:3000" }), "demo")).toBe(
      "http://localhost:3000",
    );
    expect(
      publicOrigin(
        new Headers({
          "x-forwarded-host": "kelalsport.et",
          "x-forwarded-proto": "https,http",
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
