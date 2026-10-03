import { afterEach, describe, expect, it, vi } from "vitest";
import { ticketMetadata } from "@/features/tickets/lib/metadata";
import { toTicketCheck } from "@/lib/api/mappers/tickets";
import type { components } from "@/lib/api/schema";
import { example, responseExample } from "../contract";

vi.mock("server-only", () => ({}));
const { lookupTicket } = await import("@/lib/server/tickets");

type ApiTicketCheck = components["schemas"]["TicketCheck"];

const RAW = () => example("/v1/tickets/{ticket_id}");
const TICKET = () => toTicketCheck({ en: RAW(), am: RAW() });

/** The contract's ticket as the Amharic read would name it. */
const inAmharic = (ticket: ApiTicketCheck): ApiTicketCheck => ({
  ...ticket,
  legs: ticket.legs.map((leg) => ({
    ...leg,
    fixture_name: `${leg.fixture_name} (am)`,
    market_name: `${leg.market_name} (am)`,
    outcome_name: `${leg.outcome_name} (am)`,
  })),
});

const URL_K7Q = "https://example.et/t/K7Q2-M9XP-M";
const page = { lang: "en" as const, siteName: "Demo Bet", url: URL_K7Q };

afterEach(() => vi.restoreAllMocks());

describe("toTicketCheck", () => {
  it("maps the contract's ticket check, names in both languages, figures untouched", () => {
    expect(toTicketCheck({ en: RAW(), am: inAmharic(RAW()) })).toEqual({
      ticketId: "K7Q2-M9XP-M",
      status: "won",
      betType: "multiple",
      placedAt: "2026-10-03T14:05:22Z",
      settledAt: "2026-10-04T21:02:00Z",
      stake: "100.00",
      payout: "289.17",
      legs: [
        {
          match: { en: "Arsenal v Chelsea", am: "Arsenal v Chelsea (am)" },
          market: { en: "1X2", am: "1X2 (am)" },
          pick: { en: "1", am: "1 (am)" },
          odds: "2.10",
          result: "win",
        },
        {
          match: {
            en: "Real Madrid v Barcelona",
            am: "Real Madrid v Barcelona (am)",
          },
          market: { en: "Total 2.5", am: "Total 2.5 (am)" },
          pick: { en: "Over 2.5", am: "Over 2.5 (am)" },
          odds: "1.62",
          result: "win",
        },
      ],
    });
  });

  it("keeps a payout and a settlement time the API didn't send empty", () => {
    const raw = { ...RAW(), status: "open" as const };
    delete raw.payout;
    delete raw.settled_at;
    expect(toTicketCheck({ en: raw, am: raw })).toMatchObject({
      payout: null,
      settledAt: null,
    });
  });
});

describe("the /t/{ticket} page's metadata (AC-9)", () => {
  it("names the ticket, its status and its matches — and no amounts", () => {
    const meta = ticketMetadata({ status: "ok", ticket: TICKET() }, page);

    expect(meta.title).toBe("Ticket K7Q2-M9XP-M · Demo Bet");
    expect(meta.description).toBe(
      "Won · Arsenal v Chelsea · Real Madrid v Barcelona",
    );
    expect(meta.openGraph).toMatchObject({
      title: "Ticket K7Q2-M9XP-M",
      description: "Won · Arsenal v Chelsea · Real Madrid v Barcelona",
      url: URL_K7Q,
      siteName: "Demo Bet",
      type: "website",
    });
    // Tickets are shared by hand; nobody should find one by searching.
    expect(meta.robots).toMatchObject({ index: false, follow: false });
    // A preview a whole chat sees carries no money.
    expect(JSON.stringify(meta)).not.toContain("100.00");
    expect(JSON.stringify(meta)).not.toContain("289.17");
  });

  it("names each match once", () => {
    const raw = RAW();
    raw.legs = [raw.legs[0], { ...raw.legs[0], market_name: "Total 2.5" }];
    const ticket = toTicketCheck({ en: raw, am: raw });
    expect(ticketMetadata({ status: "ok", ticket }, page).description).toBe(
      "Won · Arsenal v Chelsea",
    );
  });

  it("writes them in the language it is given", () => {
    const meta = ticketMetadata(
      {
        status: "ok",
        ticket: toTicketCheck({ en: RAW(), am: inAmharic(RAW()) }),
      },
      { ...page, lang: "am" },
    );
    expect(meta.openGraph?.title).toBe("ትኬት K7Q2-M9XP-M");
    expect(meta.description).toBe(
      "አሸንፏል · Arsenal v Chelsea (am) · Real Madrid v Barcelona (am)",
    );
  });

  it("titles an unknown number as such", () => {
    const meta = ticketMetadata(
      { status: "not_found", ticketId: "K7Q2-M9XP-M" },
      page,
    );
    expect(meta.title).toBe("No ticket with this number. · Demo Bet");
    expect(meta.openGraph).toMatchObject({
      title: "No ticket with this number.",
      description: "No ticket with this number.",
    });
  });

  it("offers no preview card for a passing failure, which a bot would cache", () => {
    const meta = ticketMetadata(
      { status: "failed", ticketId: "K7Q2-M9XP-M" },
      page,
    );
    expect(meta.title).toBe("Ticket K7Q2-M9XP-M · Demo Bet");
    expect(meta.description).toBeUndefined();
    expect(meta.openGraph).toBeUndefined();
  });

  it("names no brand when the tenant's config could not be read", () => {
    const meta = ticketMetadata(
      { status: "ok", ticket: TICKET() },
      { ...page, siteName: null },
    );
    expect(meta.title).toBe("Ticket K7Q2-M9XP-M");
    expect(meta.openGraph).not.toHaveProperty("siteName");
  });
});

describe("lookupTicket (the /t/{ticket} page)", () => {
  /** Every request made upstream, and how each was answered. */
  const sent: Request[] = [];
  const answer = (status: number, body: (request: Request) => unknown) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      sent.push(request);
      return Response.json(body(request), { status });
    });

  afterEach(() => {
    sent.length = 0;
  });

  it("checks the ticket in both languages, with no session", async () => {
    answer(200, (request) =>
      request.headers.get("accept-language") === "am"
        ? inAmharic(RAW())
        : RAW(),
    );

    const result = await lookupTicket("demo", "K7Q2-M9XP-M");

    expect(result.status).toBe("ok");
    expect(result.status === "ok" && result.ticket.legs[0].match).toEqual({
      en: "Arsenal v Chelsea",
      am: "Arsenal v Chelsea (am)",
    });
    expect(sent).toHaveLength(2);
    for (const request of sent) {
      expect(new URL(request.url).pathname).toBe("/v1/tickets/K7Q2-M9XP-M");
      expect(request.headers.get("x-tenant-id")).toBe("demo");
      expect(request.headers.get("authorization")).toBeNull();
    }
  });

  it.each(["NOT_FOUND", "RETAIL_TICKET_NOT_FOUND"])(
    "calls a 404 %s not found",
    async (code) => {
      answer(404, () => ({ type: "x", title: "x", status: 404, code }));
      expect(await lookupTicket("demo", "K7Q2-M9XP-M")).toEqual({
        status: "not_found",
        ticketId: "K7Q2-M9XP-M",
      });
    },
  );

  it("calls the contract's NotFound example not found", async () => {
    answer(404, () => responseExample("/v1/tickets/{ticket_id}", "get", 404));
    expect((await lookupTicket("demo", "K7Q2-M9XP-M")).status).toBe(
      "not_found",
    );
  });

  it("calls a 404 without a not-found code a failure, as Prism's own errors are", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    answer(404, () => ({
      type: "https://stoplight.io/prism/errors#NOT_FOUND",
      title: "The server cannot find the requested content",
      status: 404,
    }));
    expect((await lookupTicket("demo", "K7Q2-M9XP-M")).status).toBe("failed");
  });

  it("calls an API it can't reach a failure, not a missing ticket", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("down"));
    expect(await lookupTicket("demo", "K7Q2-M9XP-M")).toEqual({
      status: "failed",
      ticketId: "K7Q2-M9XP-M",
    });
  });

  it("calls an answer that isn't a ticket a failure, not a broken page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    answer(200, () => ({ ...RAW(), status: "pending", stake: "1,000" }));
    expect((await lookupTicket("demo", "K7Q2-M9XP-M")).status).toBe("failed");
  });
});
