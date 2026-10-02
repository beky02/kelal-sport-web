import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BetSlip } from "@/features/bet-slip/components/BetSlip";
import { priceSlip } from "@/features/bet-slip/lib/calculate";
import {
  selectionFrom,
  useBetSlipStore,
} from "@/features/bet-slip/stores/bet-slip.store";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { toBetReceipt } from "@/lib/api/mappers/bets";
import type { components } from "@/lib/api/schema";
import { useUiStore } from "@/stores/ui.store";
import { responseExample } from "../contract";
import { CONTRACT_PLAYER, CONTRACT_RULES, render } from "./render";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: vi.fn(() => "/"),
}));

type PlacedBet = components["schemas"]["PlacedBet"];

/** What `/api/bets` answers for the contract's 201: its ticket, mapped. */
const TICKET = () =>
  toBetReceipt(
    responseExample("/v1/bets", "post", 201) as unknown as PlacedBet,
  );

interface Sent {
  key: string | null;
  csrf: string | null;
  /** Placing gives up waiting after a while (and offers Try again). */
  signal: AbortSignal | null;
  body: {
    betType: string;
    systemSizes: number[];
    legs: { outcomeId: string; odds: string }[];
    stake: string;
    oddsPolicy: string;
  };
}

/** Every POST to `/api/bets` — the request log. */
let sent: Sent[] = [];

type Answer = [number, unknown] | "drop" | Promise<[number, unknown]>;

/** Stubs this app's `/api/bets`, one answer per attempt, in order. */
function bets(...answers: Answer[]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname !== "/api/bets") throw new Error(`unexpected ${url}`);
    const headers = new Headers(init?.headers);
    sent.push({
      key: headers.get("Idempotency-Key"),
      csrf: headers.get("X-Requested-With"),
      signal: init?.signal ?? null,
      body: JSON.parse(String(init?.body)),
    });
    const answer = answers.shift() ?? [500, {}];
    if (answer === "drop") throw new TypeError("Failed to fetch");
    const [status, body] = await answer;
    return Response.json(body, {
      status,
      headers: {
        "Content-Type":
          status >= 400 ? "application/problem+json" : "application/json",
      },
    });
  });
}

const problem = (
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
): [number, unknown] => [
  status,
  {
    type: "https://api.example.et/errors/x",
    title: code,
    status,
    code,
    request_id: "req_test",
    ...extra,
  },
];

const pick = (eventId: string, code: string, odds: string, team: string) =>
  selectionFrom({
    outcomeId: `oc_${eventId}_${code}`,
    ref: { eventId, marketType: "1x2", line: null, outcomeCode: code },
    marketId: `${eventId}:1x2:`,
    eventName: { en: `${team} match`, am: `${team} match` },
    marketName: { en: "Match result", am: "የጨዋታ ውጤት" },
    outcomeName: { en: team, am: team },
    odds,
  });

/** The design's reference slip: 1.62 × 3.05 × 1.38 at 100 previews 594.40. */
function seedReferenceSlip() {
  const store = useBetSlipStore.getState();
  store.toggleSelection(pick("m3", "1", "1.62", "Man City"));
  store.toggleSelection(pick("m4", "X", "3.05", "Draw"));
  store.toggleSelection(pick("m6", "1", "1.38", "Barcelona"));
}

const placeBet = async () =>
  userEvent.click(await screen.findByRole("button", { name: /Place bet/ }));

beforeEach(() => {
  sent = [];
  push.mockClear();
  useBetSlipStore.getState().clear();
  useBetSlipStore.setState({ mode: "multiple", stake: "100", systemK: 2 });
  useUiStore.setState({ lang: "en", clock: "eat", calendar: "gregorian" });
  useAuthStore.getState().close();
  seedReferenceSlip();
});

afterEach(() => vi.restoreAllMocks());

describe("placing the slip", () => {
  it("shows the API's ticket and figures, not the preview's (AC-3)", async () => {
    bets([201, TICKET()]);
    render(<BetSlip />);
    expect(screen.getByTestId("net-payout")).toHaveTextContent("ETB 594.40");

    await placeBet();

    const ticket = await screen.findByTestId("ticket-code");
    expect(within(ticket).getByText("K7Q2-M9XP-M")).toBeInTheDocument();
    expect(
      within(ticket).getByRole("img", { name: "Ticket: K7Q2-M9XP-M" }),
    ).toBeInTheDocument();
    expect(
      within(ticket).getByRole("button", { name: "Copy code" }),
    ).toBeInTheDocument();
    // Prism's ticket: 100.00 at 3.40, stake tax 15.00, potential payout 289.17.
    const figures = screen.getByTestId("ticket-figures");
    expect(figures).toHaveTextContent("Multiple · 2 picks");
    expect(figures).toHaveTextContent("3.40");
    expect(figures).toHaveTextContent("ETB 100.00");
    expect(figures).toHaveTextContent("− ETB 15.00");
    expect(figures).toHaveTextContent("Potential payout");
    expect(figures).toHaveTextContent("ETB 289.17");
    expect(screen.queryByText(/594\.40/)).not.toBeInTheDocument();
    // No winnings tax on the ticket: the API sends none until settlement.
    expect(figures).not.toHaveTextContent("Winnings tax");
    expect(screen.getByRole("heading", { name: "Bet placed" })).toHaveFocus();
  });

  it("sends the contract's request: the odds on screen, the total stake as typed and the odds policy (AC-6)", async () => {
    bets([201, TICKET()]);
    render(<BetSlip />);

    await placeBet();
    await screen.findByTestId("ticket-code");

    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual({
      betType: "multiple",
      systemSizes: [],
      legs: [
        { outcomeId: "oc_m3_1", odds: "1.62" },
        { outcomeId: "oc_m4_X", odds: "3.05" },
        { outcomeId: "oc_m6_1", odds: "1.38" },
      ],
      stake: "100.00",
      oddsPolicy: "higher",
    });
    expect(sent[0].key).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent[0].csrf).toBe("KelalSport");
    // A request that hangs ends in "couldn't confirm", not a spinner forever.
    expect(sent[0].signal).toBeInstanceOf(AbortSignal);
  });

  it("starts at the tenant's odds policy and sends the player's choice (AC-6)", async () => {
    bets([201, TICKET()]);
    render(<BetSlip />);
    const setting = screen.getByLabelText("When odds change");
    expect(setting).toHaveValue(CONTRACT_RULES.defaultOddsPolicy);

    await userEvent.selectOptions(setting, "Accept any");
    await placeBet();
    await screen.findByTestId("ticket-code");

    expect(sent[0].body.oddsPolicy).toBe("any");
  });

  it("sends the same Idempotency-Key again when the first attempt got no answer (AC-1)", async () => {
    bets("drop", [201, TICKET()]);
    render(<BetSlip />);

    await placeBet();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn’t confirm your bet");
    expect(alert).toHaveTextContent("you’ll see the same ticket");

    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );
    await screen.findByTestId("ticket-code");

    expect(sent).toHaveLength(2);
    expect(sent[1].key).toBe(sent[0].key);
    expect(sent[1].body).toEqual(sent[0].body);
  });

  it("reuses the key from the slip's own Place too, while that request is owed an answer (AC-1)", async () => {
    bets([503, { code: "SERVICE_UNAVAILABLE" }], [201, TICKET()]);
    render(<BetSlip />);

    await placeBet();
    await screen.findByText("We couldn’t confirm your bet");
    await placeBet();
    await screen.findByTestId("ticket-code");

    expect(sent[1].key).toBe(sent[0].key);
  });

  it("gives a second bet on the same slip, after Keep selections, a new key (AC-1)", async () => {
    bets([201, TICKET()], [201, TICKET()]);
    render(<BetSlip />);

    await placeBet();
    await userEvent.click(
      await screen.findByRole("button", { name: "Keep selections" }),
    );
    await placeBet();
    await screen.findByTestId("ticket-code");

    expect(sent).toHaveLength(2);
    expect(sent[1].body).toEqual(sent[0].body);
    expect(sent[1].key).not.toBe(sent[0].key);
  });

  it("waits while a bet is on its way: Place can't send a second one", async () => {
    let answer!: (value: [number, unknown]) => void;
    bets(new Promise((resolve) => (answer = resolve)));
    render(<BetSlip />);

    await placeBet();
    expect(screen.getByRole("button", { name: /Place bet/ })).toBeDisabled();
    // Another mounted slip (the aside and the sheet) sees the same.
    const { unmount } = render(<BetSlip />);
    expect(
      screen.getAllByRole("button", { name: /Place bet/ })[1],
    ).toBeDisabled();
    unmount();

    answer([201, TICKET()]);
    await screen.findByTestId("ticket-code");
    expect(sent).toHaveLength(1);
  });

  it("keeps the ticket when the slip that asked closed before the answer", async () => {
    let answer!: (value: [number, unknown]) => void;
    bets(new Promise((resolve) => (answer = resolve)));
    const first = render(<BetSlip />);
    await placeBet();
    first.unmount();

    answer([201, TICKET()]);
    await waitFor(() =>
      expect(useBetSlipStore.getState().placement.receipt?.ticketId).toBe(
        "K7Q2-M9XP-M",
      ),
    );

    render(<BetSlip />);
    expect(await screen.findByTestId("ticket-code")).toHaveTextContent(
      "K7Q2-M9XP-M",
    );
  });
});

describe("when the engine refuses", () => {
  it("shows the old and new odds from a 409 and places the accepted price with a new key (AC-2)", async () => {
    bets(
      [409, responseExample("/v1/bets", "post", 409, "odds_changed")],
      [201, TICKET()],
    );
    render(<BetSlip />);

    await placeBet();

    // legs[1] is the second pick sent: Draw, 3.05 → 1.55.
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Odds changed");
    expect(status).toHaveTextContent(
      "Your bet wasn’t placed: 1 selection changed price.",
    );
    expect(screen.getByText("3.05")).toHaveClass("line-through");
    expect(screen.getByText(/▼ 1\.55/)).toBeInTheDocument();
    // The preview is slipcalc's at the new price.
    const repriced = priceSlip(
      {
        betType: "multiple",
        legs: [{ odds: "1.62" }, { odds: "1.55" }, { odds: "1.38" }],
        stake: "100",
        systemSizes: [],
      },
      CONTRACT_RULES.calc,
    );
    expect(repriced.ok).toBe(true);
    if (!repriced.ok) return;
    expect(screen.getByTestId("net-payout")).toHaveTextContent(
      `ETB ${repriced.quote.netPayout}`,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Accept changes" }),
    );
    await placeBet();
    await screen.findByTestId("ticket-code");

    expect(sent).toHaveLength(2);
    expect(sent[1].body.legs[1]).toEqual({
      outcomeId: "oc_m4_X",
      odds: "1.55",
    });
    expect(sent[1].key).not.toBe(sent[0].key);
  });

  it("still says the bet wasn't placed when the new price is a rise the policy takes without asking", async () => {
    bets(
      problem(409, "BET_ODDS_CHANGED", {
        errors: [
          { field: "legs[1].odds", code: "ODDS_CHANGED", current: "3.40" },
        ],
      }),
    );
    render(<BetSlip />);

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Your bet wasn’t placed: the odds changed. Check the prices and place it again.",
    );
    expect(screen.getByText(/▲ 3\.40/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Place bet/ })).toBeEnabled();
  });

  it("marks a started match from a 409 and offers to remove it (AC-7)", async () => {
    bets(
      [
        409,
        responseExample("/v1/bets", "post", 409, "event_started") as object,
      ],
      [201, TICKET()],
    );
    render(<BetSlip />);

    await placeBet();

    // legs[0] is Man City.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Match started");
    expect(alert).toHaveTextContent(
      "Your bet wasn’t placed: a match in your slip has started.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remove suspended pick" }),
    );
    expect(
      useBetSlipStore.getState().selections.map((s) => s.outcomeId),
    ).toEqual(["oc_m4_X", "oc_m6_1"]);
    expect(screen.queryByText("Match started")).not.toBeInTheDocument();

    await placeBet();
    await screen.findByTestId("ticket-code");
    expect(sent[1].key).not.toBe(sent[0].key);
  });

  it("offers the API's limit when the stake is too high (AC-7)", async () => {
    bets(
      problem(422, "BET_STAKE_TOO_HIGH", {
        errors: [{ field: "stake", code: "MAX", limit: "50.00" }],
      }),
    );
    render(<BetSlip />);

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Stake too high");
    expect(alert).toHaveTextContent("The maximum total stake is ETB 50.00.");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Set 50.00" }),
    );
    expect(useBetSlipStore.getState().stake).toBe("50.00");
    expect(screen.queryByText("Stake too high")).not.toBeInTheDocument();
  });

  it("offers Deposit when the balance is too low (AC-7)", async () => {
    bets([422, responseExample("/v1/bets", "post", 422, "insufficient_funds")]);
    render(<BetSlip />);

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your balance is too low for this stake.");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Deposit to continue" }),
    );
    expect(push).toHaveBeenCalledWith("/wallet?action=deposit");
  });

  it("offers View limits when a limit is reached, with the API's own detail (AC-7)", async () => {
    bets(
      problem(403, "RG_LIMIT_REACHED", {
        detail: "Your daily stake limit resets at 00:00.",
      }),
    );
    render(<BetSlip />);

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Limit reached");
    expect(alert).toHaveTextContent("Your daily stake limit resets at 00:00.");
    await userEvent.click(
      within(alert).getByRole("button", { name: "View limits" }),
    );
    expect(push).toHaveBeenCalledWith("/responsible-gaming");
  });

  it("says betting is paused during a break, until the end the API gives (AC-7)", async () => {
    bets(problem(403, "RG_COOLING_OFF"));
    render(<BetSlip />, {
      session: {
        ...CONTRACT_PLAYER,
        flags: {
          ...CONTRACT_PLAYER.flags,
          excludedUntil: "2026-10-09T09:00:00Z",
        },
      },
    });

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You’re taking a break");
    // 09:00 UTC is 12:00 in East Africa Time.
    expect(alert).toHaveTextContent("Betting is paused until 09/10 · 12:00.");
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers Verify when the API needs the player's ID first (AC-7)", async () => {
    bets([403, responseExample("/v1/bets", "post", 403)]);
    render(<BetSlip />);

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Verify your ID");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Verify" }),
    );
    expect(useAuthStore.getState().entry).toBe("verify");
  });

  it("says real-money betting isn't available, with nothing to retry", async () => {
    bets(problem(503, "REAL_MONEY_DISABLED"));
    render(<BetSlip />);

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Real-money betting isn’t available yet.");
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
    expect(useBetSlipStore.getState().placement.attempt).toBeNull();
  });

  it("shows the API's own title for a code it doesn't know", async () => {
    bets(
      problem(422, "BET_FREE_BET_INVALID", {
        title: "This free bet has expired",
      }),
    );
    render(<BetSlip />);

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bet not accepted");
    expect(alert).toHaveTextContent("This free bet has expired");
  });

  it("forgets a refusal once the slip changes", async () => {
    bets(
      problem(422, "BET_STAKE_TOO_HIGH", {
        errors: [{ field: "stake", code: "MAX", limit: "50.00" }],
      }),
    );
    render(<BetSlip />);

    await placeBet();
    await screen.findByText("Stake too high");
    await userEvent.click(screen.getByRole("button", { name: "Remove Draw" }));

    expect(screen.queryByText("Stake too high")).not.toBeInTheDocument();
  });

  it("switches a refusal to Amharic", async () => {
    useUiStore.setState({ lang: "am" });
    bets([409, responseExample("/v1/bets", "post", 409, "odds_changed")]);
    render(<BetSlip />);

    await userEvent.click(
      await screen.findByRole("button", { name: /ውርርድ አስይዝ/ }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent("ውርርዱ አልተያዘም");
  });
});
