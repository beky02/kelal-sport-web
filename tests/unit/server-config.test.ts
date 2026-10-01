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
