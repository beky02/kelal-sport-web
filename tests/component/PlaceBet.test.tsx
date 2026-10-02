import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Player } from "@/features/auth/types";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { BetSlip } from "@/features/bet-slip/components/BetSlip";
import {
  selectionFrom,
  useBetSlipStore,
} from "@/features/bet-slip/stores/bet-slip.store";
import { toBetReceipt } from "@/lib/api/mappers/bets";
import type { components } from "@/lib/api/schema";
import { sessionKeys } from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import { responseExample } from "../contract";
import { CONTRACT_PLAYER, CONTRACT_RULES, render } from "./render";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: vi.fn(() => "/"),
}));

type PlacedBet = components["schemas"]["PlacedBet"];

const PLACED = () =>
  responseExample("/v1/bets", "post", 201) as unknown as PlacedBet;

/** What `/api/bets` answers for the contract's 201: its ticket, mapped. */
const TICKET = (changes: Partial<PlacedBet> = {}) =>
  toBetReceipt({ ...PLACED(), ...changes });

/** Someone else, signing in on the same phone. */
const OTHER_PLAYER: Player = {
  ...CONTRACT_PLAYER,
  id: "01J9A7R0000000000000000099",
};

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

/** Who `/api/me` says is signed in when the slip reads it again. */
let signedIn: Player = CONTRACT_PLAYER;

type Answer =
  | [number, unknown, Record<string, string>?]
  | "drop"
  | "timeout"
  | Promise<[number, unknown]>;

/**
 * Stubs this app's `/api/bets`, one answer per attempt, in order, and
 * `/api/me` (read again after a 401 or an RG refusal) with the same player.
 */
function bets(...answers: Answer[]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/me") {
      return Response.json({ player: signedIn });
    }
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
    // What fetch throws when AbortSignal.timeout gives up.
    if (answer === "timeout") {
      throw new DOMException("signal timed out", "TimeoutError");
    }
    const [status, body, extra] = await answer;
    return Response.json(body, {
      status,
      headers: {
        "Content-Type":
          status >= 400 ? "application/problem+json" : "application/json",
        ...extra,
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

/** The slip's main button while a bet is unconfirmed (the alert has its own). */
const mainTryAgain = () =>
  screen.getAllByRole("button", { name: "Try again" }).at(-1)!;

/** Place, and lose the answer: the bet is unconfirmed. */
async function placeAndLoseTheAnswer() {
  await placeBet();
  return screen.findByText("We couldn’t confirm your bet");
}

const slip = () => useBetSlipStore.getState();

beforeEach(() => {
  sent = [];
  signedIn = CONTRACT_PLAYER;
  push.mockClear();
  slip().clear();
  slip().forgetPlacement();
  useBetSlipStore.setState({ mode: "multiple", stake: "100", systemK: 2 });
  useUiStore.setState({ lang: "en", clock: "eat", calendar: "gregorian" });
  useAuthStore.getState().close();
  seedReferenceSlip();
});

afterEach(() => vi.restoreAllMocks());

describe("placing the slip", () => {
  it("shows the API's ticket and figures, not the preview's (AC-3)", async () => {
    // The engine's figures differ from the slip's preview on every line: its
    // stake tax, its bonus, its payout.
    bets([
      201,
      TICKET({
        stake_tax: "14.00",
        acca_bonus: "12.34",
        potential_payout: "321.09",
      }),
    ]);
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
    const figures = screen.getByTestId("ticket-figures");
    expect(figures).toHaveTextContent("Multiple · 2 picks");
    expect(figures).toHaveTextContent("3.40");
    expect(figures).toHaveTextContent("ETB 100.00");
    expect(figures).toHaveTextContent("− ETB 14.00");
    expect(figures).toHaveTextContent("+ ETB 12.34");
    expect(figures).toHaveTextContent("Potential payout");
    expect(figures).toHaveTextContent("ETB 321.09");
    // None of the preview's: stake tax 15.00, bonus 14.83, payout 594.40.
    expect(figures).not.toHaveTextContent("15.00");
    expect(figures).not.toHaveTextContent("14.83");
    expect(screen.queryByText(/594\.40/)).not.toBeInTheDocument();
    // No winnings tax on the ticket: the API decides it at settlement.
    expect(figures).not.toHaveTextContent("Winnings tax");
    expect(screen.getByRole("heading", { name: "Bet placed" })).toHaveFocus();
    // Sharing comes with `/t/{ticket}` (F5b): no button that does nothing.
    expect(
      screen.queryByRole("button", { name: "Share on Telegram" }),
    ).not.toBeInTheDocument();
  });

  it("counts the bets of a several-line ticket instead of quoting odds it doesn't have", async () => {
    const placed = PLACED();
    bets([
      201,
      TICKET({
        bet_type: "single",
        lines: 3,
        total_odds: null,
        legs: [...placed.legs, placed.legs[0]],
      }),
    ]);
    render(<BetSlip />);

    await placeBet();

    const figures = await screen.findByTestId("ticket-figures");
    expect(figures).toHaveTextContent("Single");
    expect(figures).toHaveTextContent("3 bets");
    expect(figures).not.toHaveTextContent("3.40");
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
  });

  it("starts at the tenant's own odds policy and sends the player's choice (AC-6)", async () => {
    for (const tenantDefault of ["none", "any"] as const) {
      sent = [];
      slip().forgetPlacement();
      bets([201, TICKET()]);
      const { unmount } = render(<BetSlip />, {
        rules: { ...CONTRACT_RULES, defaultOddsPolicy: tenantDefault },
      });
      expect(screen.getByLabelText("When odds change")).toHaveValue(
        tenantDefault,
      );

      await placeBet();
      await screen.findByTestId("ticket-code");
      expect(sent[0].body.oddsPolicy).toBe(tenantDefault);
      unmount();
      vi.restoreAllMocks();
    }

    slip().forgetPlacement();
    bets([201, TICKET()]);
    render(<BetSlip />);
    await userEvent.selectOptions(
      screen.getByLabelText("When odds change"),
      "Accept any",
    );
    await placeBet();
    await screen.findByTestId("ticket-code");
    expect(sent.at(-1)?.body.oddsPolicy).toBe("any");
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

  it("says Placing… while a bet is on its way, and no slip can send a second one", async () => {
    let answer!: (value: [number, unknown]) => void;
    bets(new Promise((resolve) => (answer = resolve)));
    render(<BetSlip />);

    await placeBet();
    // Still focusable, so the player's focus stays where they pressed.
    const placing = screen.getByRole("button", { name: /Placing/ });
    expect(placing).toHaveAttribute("aria-busy", "true");
    expect(placing).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(placing);
    // Another mounted slip (the aside and the sheet) sees the same.
    const { unmount } = render(<BetSlip />);
    const second = screen.getAllByRole("button", { name: /Placing/ })[1];
    await userEvent.click(second);
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
      expect(slip().placement.receipt?.ticketId).toBe("K7Q2-M9XP-M"),
    );

    render(<BetSlip />);
    expect(await screen.findByTestId("ticket-code")).toHaveTextContent(
      "K7Q2-M9XP-M",
    );
  });
});

describe("a bet that had no answer (AC-1; SEC1, M1)", () => {
  it("sends the same Idempotency-Key again from the alert's Try again", async () => {
    bets("drop", [201, TICKET()]);
    render(<BetSlip />);

    const title = await placeAndLoseTheAnswer();
    const alert = title.closest("[role=alert]") as HTMLElement;
    expect(alert).toHaveTextContent("you’ll see the same ticket");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );
    await screen.findByTestId("ticket-code");

    expect(sent).toHaveLength(2);
    expect(sent[1].key).toBe(sent[0].key);
    expect(sent[1].body).toEqual(sent[0].body);
  });

  it("gives up waiting after 30 s and offers the same bet again with its key (Q3)", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    bets("timeout", [201, TICKET()]);
    render(<BetSlip />);

    await placeAndLoseTheAnswer();
    expect(timeout).toHaveBeenCalledWith(30_000);
    await userEvent.click(mainTryAgain());
    await screen.findByTestId("ticket-code");
    expect(sent[1].key).toBe(sent[0].key);
  });

  it("turns Place into Try again, which a 5xx keeps owed too", async () => {
    bets([503, { code: "SERVICE_UNAVAILABLE" }], [201, TICKET()]);
    render(<BetSlip />);

    await placeAndLoseTheAnswer();
    expect(
      screen.queryByRole("button", { name: /Place bet/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(mainTryAgain());
    await screen.findByTestId("ticket-code");
    expect(sent[1].key).toBe(sent[0].key);
  });

  it("keeps it through a tap that changes nothing, and through an edit and back", async () => {
    bets("drop", [201, TICKET()]);
    render(<BetSlip />);

    await placeAndLoseTheAnswer();
    // The quick stake already selected, then 100 → 50 → 100.
    await userEvent.click(screen.getByRole("button", { name: "100" }));
    act(() => slip().setStake("50"));
    act(() => slip().setStake("100"));

    expect(
      screen.getByText("We couldn’t confirm your bet"),
    ).toBeInTheDocument();
    await userEvent.click(mainTryAgain());
    await screen.findByTestId("ticket-code");
    expect(sent[1].key).toBe(sent[0].key);
    expect(sent[1].body).toEqual(sent[0].body);
  });

  it("sends the bet as it was sent, not the slip as edited while it was on its way", async () => {
    let drop!: () => void;
    bets(
      new Promise((_, reject) => {
        drop = () => reject(new TypeError("Failed to fetch"));
      }),
      [201, TICKET()],
    );
    render(<BetSlip />);

    await placeBet();
    act(() => slip().setStake("50"));
    act(() => drop());
    await screen.findByText("We couldn’t confirm your bet");

    await userEvent.click(mainTryAgain());
    await screen.findByTestId("ticket-code");
    expect(sent[1].key).toBe(sent[0].key);
    expect(sent[1].body.stake).toBe("100.00");
  });

  it("doesn't let a price that moves meanwhile change what Try again sends", async () => {
    bets("drop", [201, TICKET()]);
    render(<BetSlip />);

    await placeAndLoseTheAnswer();
    // A rise the tenant's `higher` takes without asking (realtime, R2).
    act(() =>
      slip().applyOddsUpdate(
        { eventId: "m4", marketType: "1x2", line: null, outcomeCode: "X" },
        "3.40",
      ),
    );
    await userEvent.click(mainTryAgain());
    await screen.findByTestId("ticket-code");

    expect(sent[1].key).toBe(sent[0].key);
    expect(sent[1].body.legs[1]).toEqual({
      outcomeId: "oc_m4_X",
      odds: "3.05",
    });
  });

  it("asks before placing a changed slip, and places it as a new bet only when the player chooses", async () => {
    bets("drop", [201, TICKET()]);
    render(<BetSlip />);

    await placeAndLoseTheAnswer();
    act(() => slip().setStake("50"));

    const alert = screen
      .getByText("We couldn’t confirm your bet")
      .closest("[role=alert]") as HTMLElement;
    expect(alert).toHaveTextContent(
      "Your slip has changed since. If that bet went through, placing this slip as well makes two bets.",
    );
    await userEvent.click(
      within(alert).getByRole("button", { name: "Place as a new bet" }),
    );
    await screen.findByTestId("ticket-code");

    expect(sent[1].key).not.toBe(sent[0].key);
    expect(sent[1].body.stake).toBe("50.00");
    expect(slip().placement.unconfirmed).toBeNull();
  });

  it("stays unconfirmed when a retry is refused: that says nothing about the first try", async () => {
    bets("drop", [
      409,
      responseExample("/v1/bets", "post", 409, "odds_changed"),
    ]);
    render(<BetSlip />);

    await placeAndLoseTheAnswer();
    await userEvent.click(mainTryAgain());

    // The new price is shown to accept, but nothing claims the bet wasn't
    // placed, and the main button still sends the first bet.
    expect(await screen.findByText(/▼ 1\.55/)).toBeInTheDocument();
    expect(
      screen.getByText("We couldn’t confirm your bet"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/wasn’t placed/)).not.toBeInTheDocument();
    expect(mainTryAgain()).toBeInTheDocument();
    expect(slip().placement.unconfirmed?.key).toBe(sent[0].key);
  });

  it("stays unconfirmed when the session ends on a retry, for the same player after", async () => {
    bets("drop", problem(401, "AUTH_TOKEN_EXPIRED"), [201, TICKET()]);
    render(<BetSlip />);

    await placeAndLoseTheAnswer();
    await userEvent.click(mainTryAgain());
    await waitFor(() => expect(sent).toHaveLength(2));

    await userEvent.click(mainTryAgain());
    await screen.findByTestId("ticket-code");
    expect(sent.map((s) => s.key)).toEqual([
      sent[0].key,
      sent[0].key,
      sent[0].key,
    ]);
  });
});

describe("whose placement it is (SEC2, Q1)", () => {
  const signIn = (
    queryClient: ReturnType<typeof render>["queryClient"],
    player: Player | null,
  ) =>
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), { player });
    });

  it("shows a ticket only to the player who placed it, and drops it when someone else signs in", async () => {
    bets([201, TICKET()]);
    const { queryClient } = render(<BetSlip />);
    await placeBet();
    await screen.findByTestId("ticket-code");

    // Logged out: whoever picks the phone up sees the slip, not the ticket.
    signIn(queryClient, null);
    expect(
      await screen.findByRole("button", { name: "Log in to bet" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("ticket-code")).not.toBeInTheDocument();

    // The same player back: their own ticket.
    signIn(queryClient, CONTRACT_PLAYER);
    expect(await screen.findByTestId("ticket-code")).toBeInTheDocument();

    // Someone else: nothing of the last player's placing stays.
    signIn(queryClient, OTHER_PLAYER);
    await waitFor(() => expect(slip().placement.receipt).toBeNull());
    expect(screen.queryByTestId("ticket-code")).not.toBeInTheDocument();
  });

  it("never offers another player Try again on a bet they didn't make", async () => {
    bets("drop");
    const { queryClient } = render(<BetSlip />);
    await placeAndLoseTheAnswer();

    signIn(queryClient, OTHER_PLAYER);

    await waitFor(() => expect(slip().placement.unconfirmed).toBeNull());
    expect(
      screen.queryByText("We couldn’t confirm your bet"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Place bet/ }),
    ).toBeInTheDocument();
  });

  it("ignores an answer that lands after another player signed in", async () => {
    let answer!: (value: [number, unknown]) => void;
    bets(new Promise((resolve) => (answer = resolve)));
    const { queryClient } = render(<BetSlip />);
    await placeBet();

    signIn(queryClient, OTHER_PLAYER);
    await waitFor(() => expect(slip().placement.sending).toBeNull());
    answer([201, TICKET()]);

    await waitFor(() => expect(sent).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(slip().placement.receipt).toBeNull();
    expect(screen.queryByTestId("ticket-code")).not.toBeInTheDocument();
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

    // legs[1] is the second pick sent: Draw, 3.05 → 1.55. A refusal is
    // announced at once.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Odds changed");
    expect(alert).toHaveTextContent(
      "Your bet wasn’t placed: the odds changed. Accept the new odds to place it.",
    );
    expect(screen.getByText("3.05")).toHaveClass("line-through");
    expect(screen.getByText(/▼ 1\.55/)).toBeInTheDocument();
    // slipcalc at the new price (D1): 8500 × 1.62 × 1.55 × 1.38 = 29454.03 →
    // 29454; 3% of (29454 − 8500) = 628; 29454 + 628 = 30082 santim.
    expect(screen.getByTestId("net-payout")).toHaveTextContent("ETB 300.82");

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
    expect(slip().selections.map((s) => s.outcomeId)).toEqual([
      "oc_m4_X",
      "oc_m6_1",
    ]);
    expect(screen.queryByText("Match started")).not.toBeInTheDocument();

    await placeBet();
    await screen.findByTestId("ticket-code");
    expect(sent[1].key).not.toBe(sent[0].key);
  });

  it("marks a pick whose market was suspended and offers to remove it (AC-7)", async () => {
    bets(
      problem(409, "BET_MARKET_SUSPENDED", {
        errors: [{ field: "legs[1].outcome_id", code: "MARKET_SUSPENDED" }],
      }),
    );
    render(<BetSlip />);

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Selection suspended");
    expect(alert).toHaveTextContent(
      "Your bet wasn’t placed: betting on a selection is paused. Remove it to place the rest.",
    );
    expect(
      slip().selections.find((s) => s.outcomeId === "oc_m4_X")?.suspended,
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Remove suspended pick" }),
    ).toBeInTheDocument();
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
    expect(slip().stake).toBe("50.00");
    expect(screen.queryByText("Stake too high")).not.toBeInTheDocument();
  });

  it("offers the API's minimum split across the lines: 10.02 on three singles", async () => {
    bets(
      problem(422, "BET_STAKE_TOO_LOW", {
        errors: [{ field: "stake", code: "MIN", limit: "10.00" }],
      }),
    );
    useBetSlipStore.setState({ mode: "single", stake: "6" });
    render(<BetSlip />);

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The smallest stake this slip accepts is ETB 10.02.",
    );
    await userEvent.click(
      within(alert).getByRole("button", { name: "Set 10.02" }),
    );
    expect(screen.getByRole("button", { name: /Place bet/ })).toHaveTextContent(
      "ETB 10.02",
    );
  });

  it("offers a limit for BET_LIMIT_EXCEEDED only when it is on the stake", async () => {
    bets(
      problem(422, "BET_LIMIT_EXCEEDED", {
        errors: [{ field: "stake", code: "LIMIT", limit: "2000.00" }],
      }),
      problem(422, "BET_LIMIT_EXCEEDED", {
        errors: [
          {
            field: "legs[0].outcome_id",
            code: "MAX_LIABILITY",
            limit: "20000.00",
          },
        ],
      }),
    );
    render(<BetSlip />);

    await placeBet();
    let alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The most this bet can take is ETB 2,000.00.",
    );
    expect(
      within(alert).getByRole("button", { name: "Set 2,000.00" }),
    ).toBeInTheDocument();

    await placeBet();
    alert = await screen.findByRole("alert");
    await waitFor(() =>
      expect(alert).toHaveTextContent(
        "This stake is over the limit for this bet. Try a smaller stake.",
      ),
    );
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
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
    signedIn = {
      ...CONTRACT_PLAYER,
      flags: {
        ...CONTRACT_PLAYER.flags,
        excludedUntil: "2026-10-09T09:00:00Z",
      },
    };
    bets(problem(403, "RG_COOLING_OFF"));
    render(<BetSlip />, { session: signedIn });

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You’re taking a break");
    // 09:00 UTC is 12:00 in East Africa Time.
    expect(alert).toHaveTextContent("Betting is paused until 09/10 · 12:00.");
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
  });

  it("says betting is paused for a self-exclusion, with nothing to offer (AC-7)", async () => {
    bets(problem(403, "RG_SELF_EXCLUDED"));
    render(<BetSlip />);

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You’re taking a break");
    expect(alert).toHaveTextContent("Betting is paused during your break.");
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

  it("says how long to wait when rate-limited", async () => {
    bets([...problem(429, "RATE_LIMITED"), { "Retry-After": "30" }] as [
      number,
      unknown,
      Record<string, string>,
    ]);
    render(<BetSlip />);

    await placeBet();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many bets in a short time. Try again in 30 seconds.",
    );
  });

  it("says real-money betting isn't available, with nothing to retry", async () => {
    bets(problem(503, "REAL_MONEY_DISABLED"));
    render(<BetSlip />);

    await placeBet();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Real-money betting isn’t available yet.");
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
    expect(slip().placement.sending).toBeNull();
    expect(slip().placement.unconfirmed).toBeNull();
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

    expect(await screen.findByRole("alert")).toHaveTextContent("ውርርዱ አልተያዘም");
  });
});
