import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BetSlip } from "@/features/bet-slip/components/BetSlip";
import { BookingView } from "@/features/bookings/components/BookingView";
import {
  selectionFrom,
  useBetSlipStore,
} from "@/features/bet-slip/stores/bet-slip.store";
import { toBooking, toBookingReceipt } from "@/lib/api/mappers/bookings";
import type { components } from "@/lib/api/schema";
import { useUiStore } from "@/stores/ui.store";
import { example, responseExample } from "../contract";
import { render as renderAs } from "./render";

/** Booking codes are a guest's path into the slip: every screen here is a guest's. */
const render = (
  ui: Parameters<typeof renderAs>[0],
  options: Parameters<typeof renderAs>[1] = {},
) => renderAs(ui, { session: "guest", ...options });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: vi.fn(() => "/"),
}));

/** What `/api/bookings/7KQ2M9X` answers: the contract's booking, mapped. */
const BOOKING = () => {
  const raw = example("/v1/bookings/{code}");
  return toBooking({ en: raw, am: raw });
};
/**
 * The contract's 201, issued (by the API's clock) at 09:00 on 3 October: a
 * code that lasts 28 hours, to 13:00 the next day. Its lifetime is counted
 * from when it arrives, so these tests pass whatever today's date is.
 */
const ISSUED = "2026-10-03T09:00:00.000Z";
const LIFETIME_MS = Date.parse("2026-10-04T13:00:00Z") - Date.parse(ISSUED);
const RECEIPT = () =>
  toBookingReceipt(
    responseExample(
      "/v1/bookings",
      "post",
      201,
    ) as components["schemas"]["BookingCreated"],
    ISSUED,
  );

interface Sent {
  method: string;
  path: string;
  key: string | null;
  body: unknown;
}

/** Stubs this app's own `/api/*`; every call is recorded in `sent`. */
let sent: Sent[] = [];
function api(answer: (call: Sent) => [number, unknown]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const call: Sent = {
      method: init?.method ?? "GET",
      path: url.pathname,
      key: headers.get("Idempotency-Key"),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    sent.push(call);
    const [status, body] = answer(call);
    return Response.json(body, { status });
  });
}

const pick = (eventId: string, odds: string, team: string) =>
  selectionFrom({
    outcomeId: `oc_${eventId}`,
    ref: { eventId, marketType: "1x2", line: null, outcomeCode: "1" },
    marketId: `${eventId}:1x2:`,
    eventName: { en: `${team} match`, am: `${team} match` },
    marketName: { en: "Match result", am: "የጨዋታ ውጤት" },
    outcomeName: { en: team, am: team },
    odds,
  });

async function loadCode(code: string) {
  await userEvent.type(screen.getByLabelText("Load booking code"), code);
  await userEvent.click(screen.getByRole("button", { name: "Load" }));
}

beforeEach(() => {
  sent = [];
  useBetSlipStore.getState().clear();
  useBetSlipStore.setState({ mode: "multiple", stake: "100", systemK: 2 });
  useUiStore.setState({ lang: "en", clock: "eat", calendar: "gregorian" });
});

afterEach(() => vi.restoreAllMocks());

describe("loading a booking code in the slip", () => {
  it("loads booking 7KQ2M9X into the slip and reports the leg it could not add", async () => {
    api(() => [200, BOOKING()]);
    render(<BetSlip />);

    await loadCode("7kq2m9x");

    await waitFor(() =>
      expect(
        useBetSlipStore.getState().selections.map((s) => s.outcomeId),
      ).toEqual(["oc_ac_1"]),
    );
    expect(sent).toEqual([
      expect.objectContaining({ method: "GET", path: "/api/bookings/7KQ2M9X" }),
    ]);
    expect(useBetSlipStore.getState()).toMatchObject({
      stake: "50.00",
      mode: "multiple",
    });

    const notice = screen.getByTestId("booking-notice");
    expect(notice).toHaveTextContent("Booking 7KQ2M9X is in your slip.");
    expect(notice).toHaveTextContent(
      "Saint George v Fasil Kenema · 1X2 · 1: match has started",
    );
    // The price moved since the code was made: 2.05 → 2.10 is shown. A rise
    // is what the tenant's `higher` policy takes without asking, so there is
    // nothing to accept…
    expect(screen.getByText("2.05")).toBeInTheDocument();
    expect(screen.getByText(/▲ 2\.10/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accept all" }),
    ).not.toBeInTheDocument();

    // …until the player asks to be asked. (A guest has no Place button; the
    // odds-changed alert offers the accept.)
    await userEvent.selectOptions(
      screen.getByLabelText("When odds change"),
      "Ask me",
    );
    expect(
      screen.getByRole("button", { name: "Accept all" }),
    ).toBeInTheDocument();
  });

  it("replaces what was in the slip, and forgets the notice when dismissed", async () => {
    useBetSlipStore.getState().toggleSelection(pick("m9", "1.50", "Old pick"));
    api(() => [200, BOOKING()]);
    render(<BetSlip />);

    await loadCode("7KQ2M9X");

    await screen.findByTestId("booking-notice");
    expect(screen.queryByText("Old pick")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("booking-notice")).not.toBeInTheDocument();
  });

  it("prices the loaded leg at today's 2.10: a 50.00 stake pays 89.25", async () => {
    api(() => [200, BOOKING()]);
    render(<BetSlip />);
    await loadCode("7KQ2M9X");
    await screen.findByTestId("booking-notice");

    // Stake tax floor(5000 × 0.15) = 7.50; floor(4250 × 2.10) = 89.25, not
    // the 87.12 the code's 2.05 would give.
    expect(screen.getByTestId("net-payout")).toHaveTextContent("ETB 89.25");
    expect(screen.getByText("− ETB 7.50")).toBeInTheDocument();
  });

  it("starts a loaded slip without standing consent to price moves", async () => {
    useBetSlipStore.getState().setOddsPolicy("any");
    api(() => [200, BOOKING()]);
    render(<BetSlip />);
    await loadCode("7KQ2M9X");
    await screen.findByTestId("booking-notice");
    // Back to the tenant's own policy (`higher`), not "accept any".
    expect(useBetSlipStore.getState().oddsPolicy).toBeNull();
    expect(screen.getByLabelText("When odds change")).toHaveValue("higher");
  });

  it("keeps the slip when nothing in the code can be added, and says so", async () => {
    const nothing = BOOKING();
    nothing.legs = nothing.legs.filter((leg) => leg.unavailable !== null);
    useBetSlipStore.getState().toggleSelection(pick("m9", "1.50", "Old pick"));
    api(() => [200, nothing]);
    render(<BetSlip />);

    await loadCode("7KQ2M9X");

    const notice = await screen.findByTestId("booking-notice");
    expect(notice).toHaveTextContent(
      "Nothing in booking 7KQ2M9X can be added now.",
    );
    expect(notice).toHaveTextContent(
      "Saint George v Fasil Kenema · 1X2 · 1: match has started",
    );
    expect(
      useBetSlipStore.getState().selections.map((s) => s.outcomeId),
    ).toEqual(["oc_m9"]);
    expect(useBetSlipStore.getState().stake).toBe("100");
  });

  it("names the system the slip prices when it isn't the code's", async () => {
    const patent = BOOKING();
    patent.betType = "system";
    patent.systemSizes = [1, 2, 3];
    patent.legs = [
      { ...patent.legs[0], outcomeId: "oc_a", eventId: "fx_a" },
      { ...patent.legs[0], outcomeId: "oc_b", eventId: "fx_b" },
      { ...patent.legs[0], outcomeId: "oc_c", eventId: "fx_c" },
    ];
    api(() => [200, patent]);
    render(<BetSlip />);
    await loadCode("7KQ2M9X");

    expect(await screen.findByTestId("booking-notice")).toHaveTextContent(
      "This code is a 1, 2, 3 system; the slip prices 2/3.",
    );
  });

  it("says when too few selections are left for the code's system", async () => {
    const system = BOOKING();
    system.betType = "system";
    system.systemSizes = [2];
    system.legs = [
      { ...system.legs[0], outcomeId: "oc_a", eventId: "fx_a" },
      { ...system.legs[0], outcomeId: "oc_b", eventId: "fx_b" },
      system.legs[1],
    ];
    api(() => [200, system]);
    render(<BetSlip />);
    await loadCode("7KQ2M9X");

    expect(await screen.findByTestId("booking-notice")).toHaveTextContent(
      "This code is a 2 system; with the selections left, the slip can't price a system.",
    );
  });

  it("says nothing about the system when the slip prices the code's own", async () => {
    const system = BOOKING();
    system.betType = "system";
    system.systemSizes = [2];
    system.legs = ["a", "b", "c"].map((id) => ({
      ...system.legs[0],
      outcomeId: `oc_${id}`,
      eventId: `fx_${id}`,
    }));
    api(() => [200, system]);
    render(<BetSlip />);
    await loadCode("7KQ2M9X");

    expect(await screen.findByTestId("booking-notice")).not.toHaveTextContent(
      "system",
    );
  });

  it("says the code has expired on a 410", async () => {
    api(() => [410, responseExample("/v1/bookings/{code}", "get", 410)]);
    render(<BetSlip />);

    await loadCode("7KQ2M9X");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Code 7KQ2M9X has expired.",
    );
    expect(useBetSlipStore.getState().selections).toHaveLength(0);
  });

  it("says no booking has that code on a 404, whichever not-found code it carries", async () => {
    api(() => [404, responseExample("/v1/bookings/{code}", "get", 404)]);
    render(<BetSlip />);
    await loadCode("7KQ2M9X");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No booking with code 7KQ2M9X. Check it and try again.",
    );

    vi.restoreAllMocks();
    api(() => [
      404,
      { type: "x", title: "x", status: 404, code: "BOOKING_NOT_FOUND" },
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No booking with code 7KQ2M9X.",
    );
  });

  it("labels the code input in each slip on the page — the aside and the sheet", () => {
    render(
      <>
        <BetSlip />
        <BetSlip />
      </>,
    );
    expect(screen.getAllByLabelText("Load booking code")).toHaveLength(2);
  });

  it("drops the notice once the player changes the loaded slip", async () => {
    api(() => [200, BOOKING()]);
    render(<BetSlip />);
    await loadCode("7KQ2M9X");
    await screen.findByTestId("booking-notice");

    act(() => useBetSlipStore.getState().removeSelection("oc_ac_1"));

    expect(screen.queryByTestId("booking-notice")).not.toBeInTheDocument();
  });

  it("checks the code before calling the API", async () => {
    api(() => [200, BOOKING()]);
    render(<BetSlip />);

    await loadCode("7KQ2");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A booking code is 7 letters and numbers, like 7KQ2M9X.",
    );
    expect(sent).toHaveLength(0);
  });

  it("switches the expired message to Amharic", async () => {
    useUiStore.setState({ lang: "am" });
    api(() => [410, responseExample("/v1/bookings/{code}", "get", 410)]);
    render(<BetSlip />);

    await userEvent.type(screen.getByLabelText("የትኬት ኮድ ያስገቡ"), "7KQ2M9X");
    await userEvent.click(screen.getByRole("button", { name: "ጫን" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ኮድ 7KQ2M9X ጊዜው አልፏል።",
    );
  });
});

describe("booking the slip", () => {
  beforeEach(() => {
    const store = useBetSlipStore.getState();
    store.toggleSelection(pick("m3", "1.62", "Man City"));
    store.toggleSelection(pick("m4", "3.05", "Draw"));
  });

  it("books the slip and shows the real code with its expiry", async () => {
    api(() => [201, RECEIPT()]);
    render(<BetSlip />);

    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));

    const panel = await screen.findByTestId("booking-code");
    expect(within(panel).getByText("7KQ2M9X")).toBeInTheDocument();
    // 13:00 UTC is 16:00 in East Africa Time; 4 October 2026 is a Sunday.
    expect(panel).toHaveTextContent("Valid until Sun 4 Oct, 16:00");
    expect(
      within(panel).getByRole("link", { name: /Share on Telegram/ }),
    ).toHaveAttribute(
      "href",
      "https://t.me/share/url?url=https%3A%2F%2Fexample.et%2Fb%2F7KQ2M9X&text=Bet%20slip%207KQ2M9X",
    );

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      method: "POST",
      path: "/api/bookings",
      body: {
        betType: "multiple",
        systemSizes: [],
        outcomeIds: ["oc_m3", "oc_m4"],
        stake: "100.00",
      },
    });
    expect(sent[0].key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reuses the Idempotency-Key when retrying the same slip, and makes a new one when the slip changes", async () => {
    let fail = true;
    api(() =>
      fail
        ? [
            503,
            { type: "x", title: "x", status: 503, code: "SERVICE_UNAVAILABLE" },
          ]
        : [201, RECEIPT()],
    );
    render(<BetSlip />);

    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn’t reach the bookings service. Try again.",
    );

    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));
    await screen.findByTestId("booking-code");
    expect(sent[1].key).toBe(sent[0].key);

    // A different slip is a different intent: the old code no longer applies.
    await userEvent.click(screen.getByRole("button", { name: "50" }));
    expect(screen.queryByTestId("booking-code")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));
    await screen.findByTestId("booking-code");
    expect(sent[2].key).not.toBe(sent[0].key);
    expect(sent[2].body).toMatchObject({ stake: "50.00" });
  });

  it("keeps the code when the slip is closed and reopened, and doesn't book it twice", async () => {
    api(() => [201, RECEIPT()]);
    const { unmount } = render(<BetSlip />);
    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));
    await screen.findByTestId("booking-code");
    unmount();

    render(<BetSlip />);

    expect(screen.getByTestId("booking-code")).toHaveTextContent("7KQ2M9X");
    const booked = screen.getByRole("button", { name: "Booked" });
    expect(booked).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(booked);
    expect(sent).toHaveLength(1);
  });

  it("retries with the same Idempotency-Key even after the slip was closed", async () => {
    let fail = true;
    api(() =>
      fail
        ? [
            503,
            { type: "x", title: "x", status: 503, code: "SERVICE_UNAVAILABLE" },
          ]
        : [201, RECEIPT()],
    );
    const { unmount } = render(<BetSlip />);
    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));
    await screen.findByRole("alert");
    unmount();

    fail = false;
    render(<BetSlip />);
    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));
    await screen.findByTestId("booking-code");

    expect(sent[1].key).toBe(sent[0].key);
  });

  it("drops the code once its lifetime has passed, so the slip can be booked afresh", async () => {
    const bookedAt = Date.now();
    api(() => [201, RECEIPT()]);
    const { unmount } = render(<BetSlip />);
    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));
    await screen.findByTestId("booking-code");
    unmount();

    vi.spyOn(Date, "now").mockReturnValue(bookedAt + LIFETIME_MS + 60_000);
    render(<BetSlip />);

    await waitFor(() =>
      expect(screen.queryByTestId("booking-code")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Book bet" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("keeps a fresh code on a phone whose clock is days ahead", async () => {
    // Timers are under the test's control; the clock itself stays mocked.
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout"],
      shouldAdvanceTime: true,
    });
    try {
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2031-01-01T00:00:00Z"));
      api(() => [201, RECEIPT()]);
      render(<BetSlip />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole("button", { name: "Book bet" }));
      expect(await screen.findByTestId("booking-code")).toBeInTheDocument();

      // A wrongly-timed expiry would fire at once; an hour on, it's still here.
      act(() => vi.advanceTimersByTime(60 * 60 * 1000));
      expect(screen.getByTestId("booking-code")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves focus to the new code so it is read out, and keeps Book focusable while asking", async () => {
    api(() => [201, RECEIPT()]);
    render(<BetSlip />);
    const book = screen.getByRole("button", { name: "Book bet" });

    await userEvent.click(book);

    const panel = await screen.findByTestId("booking-code");
    await waitFor(() => expect(panel).toHaveFocus());
    expect(panel).toHaveAttribute("role", "status");
    // Announced as done, not removed from the tab order.
    const booked = screen.getByRole("button", { name: "Booked" });
    expect(booked).toHaveAttribute("aria-disabled", "true");
    expect(booked).not.toBeDisabled();
  });

  it("offers the stake the API will take when it refuses the booking's stake", async () => {
    api(() => [
      422,
      responseExample("/v1/bookings", "post", 422, "stake_too_low"),
    ]);
    render(<BetSlip />);

    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The smallest stake this slip accepts is ETB 5.00.",
    );
    await userEvent.click(
      within(alert).getByRole("button", { name: "Set 5.00" }),
    );
    expect(useBetSlipStore.getState().stake).toBe("5.00");
  });

  it("says the slip can't be booked for any other refusal, not that the service is down", async () => {
    api(() => [
      422,
      { type: "x", title: "x", status: 422, code: "BET_TOO_MANY_LEGS" },
    ]);
    render(<BetSlip />);
    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This slip can’t be booked as it is.",
    );
  });

  it("says to try later when rate-limited", async () => {
    api(() => [429, responseExample("/v1/bookings", "post", 429)]);
    render(<BetSlip />);

    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many booking codes for now. Try again later.",
    );
  });

  it("can't book two picks from one match", async () => {
    // Same event as Man City, a different outcome.
    useBetSlipStore.getState().toggleSelection({
      ...pick("m3", "4.10", "Draw again"),
      outcomeId: "oc_m3_x",
    });
    expect(useBetSlipStore.getState().selections).toHaveLength(3);
    api(() => [201, RECEIPT()]);
    render(<BetSlip />);
    const book = screen.getByRole("button", { name: "Book bet" });
    expect(book).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(book);
    expect(sent).toHaveLength(0);
  });

  it("hides booking when the tenant turns booking codes off", () => {
    render(<BetSlip />, { bookingCodes: false });
    expect(
      screen.queryByRole("button", { name: "Book bet" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Load booking code"),
    ).not.toBeInTheDocument();
  });
});

describe("the /b/[code] page", () => {
  it("shows booking 7KQ2M9X: today's prices, the move since the code, and what can't be added", () => {
    render(<BookingView booking={BOOKING()} />);

    expect(
      screen.getByRole("heading", { name: "Bet slip 7KQ2M9X" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Arsenal v Chelsea")).toBeInTheDocument();
    expect(screen.getByText("2.10")).toBeInTheDocument();
    expect(screen.getByText("was 2.05")).toBeInTheDocument();
    expect(screen.getByText("Saint George v Fasil Kenema")).toBeInTheDocument();
    expect(screen.getByText("match has started")).toBeInTheDocument();
    expect(screen.getByText("ETB 50.00")).toBeInTheDocument();
  });

  it("loads it into the slip and opens the slip", async () => {
    api(() => [200, BOOKING()]);
    render(<BookingView booking={BOOKING()} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Load into bet slip" }),
    );

    await waitFor(() =>
      expect(
        useBetSlipStore.getState().selections.map((s) => s.outcomeId),
      ).toEqual(["oc_ac_1"]),
    );
    // Loaded fresh: a booking is re-priced every time it is loaded.
    expect(sent[0].path).toBe("/api/bookings/7KQ2M9X");
    expect(useUiStore.getState().asidePanel).toBe("slip");
    // Loaded: the action now is to look at the slip, not to load it again.
    expect(
      screen.getByRole("button", { name: "Open bet slip" }),
    ).toBeInTheDocument();
  });

  it("opens the slip's sheet on a phone, where there is no aside", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    useUiStore.setState({ mobileSlipOpen: false });
    api(() => [200, BOOKING()]);
    render(<BookingView booking={BOOKING()} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Load into bet slip" }),
    );

    await waitFor(() =>
      expect(useUiStore.getState().mobileSlipOpen).toBe(true),
    );
    vi.unstubAllGlobals();
  });

  it("warns that loading replaces the picks already in the slip", () => {
    useBetSlipStore.getState().toggleSelection(pick("m9", "1.50", "Old pick"));
    useBetSlipStore
      .getState()
      .toggleSelection(pick("m8", "2.50", "Older pick"));
    render(<BookingView booking={BOOKING()} />);

    expect(
      screen.getByText("Loading replaces what's in your slip now."),
    ).toBeInTheDocument();
  });

  it("says so when a fresh read finds nothing left to load, and keeps focus on the button", async () => {
    const nothing = BOOKING();
    nothing.legs = nothing.legs.map((leg) => ({
      ...leg,
      odds: null,
      unavailable: "MARKET_SUSPENDED" as const,
    }));
    api(() => [200, nothing]);
    render(<BookingView booking={BOOKING()} />);
    const button = screen.getByRole("button", { name: "Load into bet slip" });

    await userEvent.click(button);

    expect(
      await screen.findByText("Nothing in booking 7KQ2M9X can be added now."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Booking 7KQ2M9X is in your slip.")).toBeNull();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
  });

  it("suggests a stake only when the code has a positive one", () => {
    render(<BookingView booking={{ ...BOOKING(), stakeHint: "0.00" }} />);
    expect(screen.queryByText("Suggested stake")).not.toBeInTheDocument();
  });

  it("says when the code expired between opening the page and loading it", async () => {
    api(() => [410, responseExample("/v1/bookings/{code}", "get", 410)]);
    render(<BookingView booking={BOOKING()} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Load into bet slip" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Code 7KQ2M9X has expired.",
    );
  });
});

describe("the /b/[code] not-found page", () => {
  it("repeats a well-formed code, and never text from the address that isn't one", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/b/7kq2m9x");
    const { BookingNotFound } =
      await import("@/features/bookings/components/BookingNotFound");

    const { unmount } = render(<BookingNotFound />);
    expect(
      screen.getByText("Check code 7KQ2M9X and try again."),
    ).toBeInTheDocument();
    unmount();

    vi.mocked(usePathname).mockReturnValue(
      "/b/CALL%200911000000%20TO%20CLAIM%20YOUR%20WIN",
    );
    render(<BookingNotFound />);
    expect(
      screen.getByText("Check the code and try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/0911000000/)).not.toBeInTheDocument();
  });
});
