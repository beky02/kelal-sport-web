import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiClient } from "@/lib/api/client";

/** What `fetch` was asked for, by the shared client. */
function stubFetch() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json({ ok: true }));
}

afterEach(() => {
  vi.restoreAllMocks();
  delete document.documentElement.dataset.api;
  document.documentElement.lang = "";
});

const ok = z.object({ ok: z.literal(true) });
const askedUrl = (spy: ReturnType<typeof stubFetch>) =>
  new URL(String(spy.mock.calls[0][0])).pathname;
const askedLanguage = (spy: ReturnType<typeof stubFetch>) =>
  new Headers(spy.mock.calls[0][1]?.headers).get("Accept-Language");

describe("the browser's API client (F8ca R2)", () => {
  it("calls this app's /api routes, in the page's language", async () => {
    const spy = stubFetch();
    document.documentElement.lang = "am";
    await apiClient.get("/catalogue/sports", ok);
    expect(askedUrl(spy)).toBe("/api/catalogue/sports");
    expect(askedLanguage(spy)).toBe("am");
  });

  it("sends the catalogue to the terminal's own routes on a terminal page", async () => {
    const spy = stubFetch();
    document.documentElement.dataset.api = "/api/terminal/";
    await apiClient.get("/catalogue/board", ok);
    expect(askedUrl(spy)).toBe("/api/terminal/catalogue/board");
  });

  it("re-roots only the catalogue the terminal mirrors, nothing else (review Q8)", async () => {
    const spy = stubFetch();
    document.documentElement.dataset.api = "/api/terminal/";
    await apiClient.get("/config", ok);
    expect(askedUrl(spy)).toBe("/api/config");
  });

  it("routes booking detail reads to terminal's guarded mirror but leaves writes on the player API", async () => {
    const read = stubFetch();
    document.documentElement.dataset.api = "/api/terminal/";
    await apiClient.get("/bookings/7KQ2M9X", ok);
    expect(askedUrl(read)).toBe("/api/terminal/bookings/7KQ2M9X");
    read.mockRestore();

    // Book bet is mirrored too (the user's third review)…
    const create = stubFetch();
    await apiClient.post("/bookings", ok, {});
    expect(askedUrl(create)).toBe("/api/terminal/bookings");
    create.mockRestore();

    // …but no other write.
    const nestedWrite = stubFetch();
    await apiClient.post("/bookings/7KQ2M9X", ok, {});
    expect(askedUrl(nestedWrite)).toBe("/api/bookings/7KQ2M9X");
    nestedWrite.mockRestore();

    // The player's site books on its own route.
    delete document.documentElement.dataset.api;
    const player = stubFetch();
    await apiClient.post("/bookings", ok, {});
    expect(askedUrl(player)).toBe("/api/bookings");
  });

  it("re-roots a booking read only by its code, and nothing with a dot segment (review SEC1)", async () => {
    document.documentElement.dataset.api = "/api/terminal/";
    for (const [path, expected] of [
      // Not a code: the player's own booking reads, if one is ever added.
      ["/bookings/mine", "/api/bookings/mine"],
      ["/bookings/7KQ2M9X/legs", "/api/bookings/7KQ2M9X/legs"],
      // A dot segment can't climb out of the mirror.
      ["/catalogue/../me", "/api/me"],
      ["/catalogue/./sports", "/api/catalogue/sports"],
    ] as const) {
      const spy = stubFetch();
      await apiClient.get(path, ok);
      expect(askedUrl(spy), path).toBe(expected);
      spy.mockRestore();
    }
  });

  it("takes no base it doesn't know, whatever the page says (review SEC2)", async () => {
    for (const forged of [
      "https://evil.example/",
      "//evil.example/",
      "/api/other/",
    ]) {
      const spy = stubFetch();
      document.documentElement.dataset.api = forged;
      await apiClient.get("/catalogue/board", ok);
      expect(new URL(String(spy.mock.calls[0][0])).href, forged).toBe(
        `${window.location.origin}/api/catalogue/board`,
      );
      spy.mockRestore();
    }
  });
});
