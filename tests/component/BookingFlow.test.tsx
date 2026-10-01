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
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import { example, responseExample } from "../contract";
import { render } from "./render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

/** What `/api/bookings/7KQ2M9X` answers: the contract's booking, mapped. */
const BOOKING = () => {
  const raw = example("/v1/bookings/{code}");
  return toBooking({ en: raw, am: raw });
};
const RECEIPT = () =>
  toBookingReceipt(
    responseExample(
      "/v1/bookings",
      "post",
      201,
    ) as components["schemas"]["BookingCreated"],
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
  useSessionStore.setState({ isGuest: true });
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
      "Saint George v Fasil Kenema · 1: match has started",
    );
    // The price moved since the code was made: 2.05 → 2.10, to accept. (A
    // guest has no Place button; the odds-changed alert offers the accept.)
    expect(screen.getByText("2.05")).toBeInTheDocument();
    expect(screen.getByText(/▲ 2\.10/)).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Book bet" })).toBeDisabled();
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

  it("drops the code once it has expired, so the slip can be booked afresh", async () => {
    api(() => [201, RECEIPT()]);
    const { unmount } = render(<BetSlip />);
    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));
    await screen.findByTestId("booking-code");
    unmount();

    // The contract's code expires at 2026-10-04T13:00:00Z.
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-04T13:00:01Z"));
    render(<BetSlip />);

    await waitFor(() =>
      expect(screen.queryByTestId("booking-code")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Book bet" })).toBeEnabled();
  });

  it("says to try later when rate-limited", async () => {
    api(() => [429, responseExample("/v1/bookings", "post", 429)]);
    render(<BetSlip />);

    await userEvent.click(screen.getByRole("button", { name: "Book bet" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many booking codes for now. Try again later.",
    );
  });

  it("can't book two picks from one match", () => {
    // Same event as Man City, a different outcome.
    useBetSlipStore.getState().toggleSelection({
      ...pick("m3", "4.10", "Draw again"),
      outcomeId: "oc_m3_x",
    });
    expect(useBetSlipStore.getState().selections).toHaveLength(3);
    render(<BetSlip />);
    expect(screen.getByRole("button", { name: "Book bet" })).toBeDisabled();
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
  });

  it("warns that loading replaces the picks already in the slip", () => {
    useBetSlipStore.getState().toggleSelection(pick("m9", "1.50", "Old pick"));
    useBetSlipStore
      .getState()
      .toggleSelection(pick("m8", "2.50", "Older pick"));
    render(<BookingView booking={BOOKING()} />);

    expect(
      screen.getByText("Replaces the 2 selections in your slip."),
    ).toBeInTheDocument();
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
