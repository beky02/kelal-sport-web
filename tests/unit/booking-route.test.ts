// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingReceiptSchema, bookingSchema } from "@/lib/api/schemas";
import { requestExample, responseExample } from "../contract";

// Route handlers are server-only; the marker package refuses to load outside
// React's server build, which a unit test is not.
vi.mock("server-only", () => ({}));

const { GET } = await import("@/app/api/bookings/[code]/route");
const { POST } = await import("@/app/api/bookings/route");

/** Every request the route handler made upstream. */
let sent: Request[] = [];

/** Answers upstream calls with a contract example. */
function upstreamAnswers(status: number, body: unknown) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    sent.push(request);
    return Response.json(body, {
      status,
      headers: {
        "Content-Type":
          status >= 400 ? "application/problem+json" : "application/json",
        // The API's clock, which a receipt's lifetime is measured from.
        Date: "Sat, 03 Oct 2026 09:00:00 GMT",
      },
    });
  });
}

const get = (code: string, headers: Record<string, string> = {}) =>
  GET(
    new Request(`http://localhost:3000/api/bookings/${code}`, {
      headers: { host: "localhost:3000", ...headers },
    }),
    { params: Promise.resolve({ code }) },
  );

const KEY = "3f0c8b8e-6a3d-4c1e-9d0f-1b2a3c4d5e6f";

/** What this site's own pages send on every POST (`apiClient`). */
const SAME_SITE = {
  "content-type": "application/json",
  "idempotency-key": KEY,
  "x-requested-with": "KelalSport",
};

const post = (body: unknown, headers: Record<string, string> = SAME_SITE) =>
  POST(
    new Request("http://localhost:3000/api/bookings", {
      method: "POST",
      headers: { host: "localhost:3000", ...headers },
      body: JSON.stringify(body),
    }),
  );

const request = {
  betType: "multiple",
  systemSizes: [],
  outcomeIds: ["oc_ac_1", "oc_sg_1"],
  stake: "50.00",
};

beforeEach(() => {
  sent = [];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/bookings/[code]", () => {
  it("returns booking 7KQ2M9X, read in both languages for the tenant", async () => {
    upstreamAnswers(200, responseExample("/v1/bookings/{code}", "get", 200));
    const response = await get("7KQ2M9X");

    expect(response.status).toBe(200);
    const booking = bookingSchema.parse(await response.json());
    expect(booking.code).toBe("7KQ2M9X");
    expect(booking.legs.map((l) => l.unavailable)).toEqual([
      null,
      "EVENT_STARTED",
    ]);

    expect(sent.map((r) => new URL(r.url).pathname)).toEqual([
      "/v1/bookings/7KQ2M9X",
      "/v1/bookings/7KQ2M9X",
    ]);
    expect(sent.map((r) => r.headers.get("accept-language")).sort()).toEqual([
      "am",
      "en",
    ]);
    expect(sent.every((r) => r.headers.get("x-tenant-id") === "demo")).toBe(
      true,
    );
  });

  it("passes a 410 BOOKING_EXPIRED through unchanged", async () => {
    const gone = responseExample("/v1/bookings/{code}", "get", 410);
    upstreamAnswers(410, gone);
    const response = await get("7KQ2M9X");

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual(gone);
  });

  it("passes a 404 through unchanged", async () => {
    upstreamAnswers(404, responseExample("/v1/bookings/{code}", "get", 404));
    const response = await get("7KQ2M9X");
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("NOT_FOUND");
  });

  it("asks for the canonical code when given a typed one", async () => {
    upstreamAnswers(200, responseExample("/v1/bookings/{code}", "get", 200));
    await get("7kq2-m9x");
    expect(new URL(sent[0].url).pathname).toBe("/v1/bookings/7KQ2M9X");
  });

  it("refuses a malformed code without calling the API", async () => {
    upstreamAnswers(200, {});
    const response = await get("..%2F..%2Fv1%2Fme");

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("VALIDATION_FAILED");
    expect(sent).toHaveLength(0);
  });

  it("forwards Prism's Prefer header under next dev only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    upstreamAnswers(200, responseExample("/v1/bookings/{code}", "get", 200));
    await get("7KQ2M9X", { prefer: "code=410" });
    expect(sent[0].headers.get("prefer")).toBe("code=410");

    sent = [];
    await get("7KQ2M9X", { prefer: "respond-async, wait=5" });
    expect(sent[0].headers.get("prefer")).toBeNull();

    // Fails closed: production, and any other build (test, staging).
    for (const env of ["production", "test", "staging"]) {
      sent = [];
      vi.stubEnv("NODE_ENV", env);
      await get("7KQ2M9X", { prefer: "code=410" });
      expect(sent[0].headers.get("prefer"), env).toBeNull();
    }
  });
});

describe("POST /api/bookings", () => {
  it("forwards the Idempotency-Key and the contract's body, and answers 201", async () => {
    upstreamAnswers(201, responseExample("/v1/bookings", "post", 201));
    const response = await post(request);

    expect(response.status).toBe(201);
    expect(bookingReceiptSchema.parse(await response.json())).toEqual({
      code: "7KQ2M9X",
      expiresAt: "2026-10-04T13:00:00Z",
      shareUrl: "https://example.et/b/7KQ2M9X",
      issuedAt: "2026-10-03T09:00:00.000Z",
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].method).toBe("POST");
    expect(new URL(sent[0].url).pathname).toBe("/v1/bookings");
    expect(sent[0].headers.get("idempotency-key")).toBe(KEY);
    expect(sent[0].headers.get("x-tenant-id")).toBe("demo");
    expect(await sent[0].json()).toEqual(
      requestExample("/v1/bookings", "post"),
    );
  });

  it("refuses a request without an Idempotency-Key", async () => {
    upstreamAnswers(201, {});
    const response = await post(request, {
      "content-type": "application/json",
      "x-requested-with": "KelalSport",
    });
    expect(response.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("refuses anything but JSON, so a cross-site form cannot post", async () => {
    upstreamAnswers(201, {});
    const response = await post(request, {
      ...SAME_SITE,
      "content-type": "application/x-www-form-urlencoded",
    });
    expect(response.status).toBe(415);
    expect(sent).toHaveLength(0);
  });

  it("refuses a POST without the X-Requested-With header (AC-4)", async () => {
    upstreamAnswers(201, {});
    const response = await post(request, {
      "content-type": "application/json",
      "idempotency-key": KEY,
    });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("PERMISSION_DENIED");
    expect(sent).toHaveLength(0);
  });

  it("refuses a POST whose Origin is another site, and takes its own (AC-4)", async () => {
    upstreamAnswers(201, responseExample("/v1/bookings", "post", 201));
    const foreign = await post(request, {
      ...SAME_SITE,
      origin: "https://evil.example",
    });
    expect(foreign.status).toBe(403);
    expect(sent).toHaveLength(0);

    const own = await post(request, {
      ...SAME_SITE,
      origin: "http://localhost:3000",
    });
    expect(own.status).toBe(201);
  });

  it("validates the body before sending anything on", async () => {
    upstreamAnswers(201, {});
    const response = await post({ ...request, outcomeIds: [], extra: "x" });
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("VALIDATION_FAILED");
    expect(sent).toHaveLength(0);
  });

  it("refuses a POST another site's page sent", async () => {
    upstreamAnswers(201, {});
    const response = await post(request, {
      ...SAME_SITE,
      "sec-fetch-site": "cross-site",
    });
    expect(response.status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it("takes a POST from its own pages", async () => {
    upstreamAnswers(201, responseExample("/v1/bookings", "post", 201));
    const response = await post(request, {
      ...SAME_SITE,
      "sec-fetch-site": "same-origin",
    });
    expect(response.status).toBe(201);
  });

  it("refuses a body far bigger than any slip, before reading it all", async () => {
    upstreamAnswers(201, {});
    const response = await post({
      ...request,
      outcomeIds: Array.from(
        { length: 2000 },
        (_, i) => `oc_${i}_${"x".repeat(20)}`,
      ),
    });
    expect(response.status).toBe(413);
    expect(sent).toHaveLength(0);
  });

  it("refuses a zero or negative stake", async () => {
    upstreamAnswers(201, {});
    for (const stake of ["0.00", "-5.00"]) {
      const response = await post({ ...request, stake });
      expect(response.status).toBe(422);
    }
    expect(sent).toHaveLength(0);
  });

  it("passes a 429 RATE_LIMITED through unchanged", async () => {
    upstreamAnswers(429, responseExample("/v1/bookings", "post", 429));
    const response = await post(request);
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("RATE_LIMITED");
  });
});
