import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BetSlip } from "@/features/bet-slip/components/BetSlip";
import {
  selectionFrom,
  useBetSlipStore,
} from "@/features/bet-slip/stores/bet-slip.store";
import type { BettingRules } from "@/features/config/types";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import type { OutcomeRef } from "@/features/markets/types";
import { GOLDEN_RULES } from "../golden";
import { render } from "./render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const ref = (eventId: string, code: string): OutcomeRef => ({
  eventId,
  marketType: "1x2",
  line: null,
  outcomeCode: code,
});

const pick = (eventId: string, code: string, odds: string, team: string) =>
  selectionFrom({
    outcomeId: `oc_${eventId}_${code}`,
    ref: ref(eventId, code),
    marketId: `${eventId}:1x2:`,
    eventName: { en: `${team} match`, am: `${team} match` },
    marketName: { en: "Match result", am: "የጨዋታ ውጤት" },
    outcomeName: { en: team, am: team },
    odds,
  });

/**
 * The design's reference slip: 1.62 × 3.05 × 1.38 at 100. Under D1 with the
 * contract's rules it pays 594.40 (worked through in `calculate.test.ts`).
 */
function seedReferenceSlip() {
  const store = useBetSlipStore.getState();
  store.toggleSelection(pick("m3", "1", "1.62", "Man City"));
  store.toggleSelection(pick("m4", "X", "3.05", "Draw"));
  store.toggleSelection(pick("m6", "1", "1.38", "Barcelona"));
}

const netPayout = () => screen.getByTestId("net-payout");

describe("BetSlip", () => {
  beforeEach(() => {
    useBetSlipStore.getState().clear();
    useBetSlipStore.setState({ mode: "multiple", stake: "100", systemK: 2 });
    useUiStore.setState({ lang: "en" });
    useSessionStore.setState({ isGuest: false });
  });

  afterEach(() => vi.restoreAllMocks());

  it("invites a first selection when empty", () => {
    render(<BetSlip />);
    expect(screen.getByText("Your bet slip is empty")).toBeInTheDocument();
  });

  it("shows D1's payout for the design's reference slip", async () => {
    seedReferenceSlip();
    render(<BetSlip />);

    expect(netPayout()).toHaveTextContent("ETB 594.40");
    // Total odds are floored to two decimals (D1.11): 6.81858 → 6.81.
    expect(screen.getByText("6.81")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Place bet/ }),
    ).toBeEnabled();
  });

  it("shows the C07 worked example's net payout of 690.29", () => {
    const store = useBetSlipStore.getState();
    for (const id of ["a", "b", "c", "d", "e"]) {
      store.toggleSelection(pick(id, "1", "1.50", `Team ${id}`));
    }
    render(<BetSlip />);

    expect(netPayout()).toHaveTextContent("ETB 690.29");
    expect(screen.getByText("Accumulator bonus")).toBeInTheDocument();
    expect(screen.getByText("+ ETB 44.83")).toBeInTheDocument();
  });

  it("explains the full calculation on request, in D1's order", async () => {
    seedReferenceSlip();
    render(<BetSlip />);

    await userEvent.click(
      screen.getByRole("button", { name: "How is this calculated?" }),
    );

    expect(screen.getByText("Net stake")).toBeInTheDocument();
    expect(screen.getByText("ETB 85.00")).toBeInTheDocument(); // 100 − 15% stake tax
    expect(screen.getByText("Gross return")).toBeInTheDocument();
    expect(screen.getByText("ETB 579.57")).toBeInTheDocument(); // floor(85 × 6.81858)
    // floor((579.57 − 85.00) × 3%) = 14.83, as its own row in the working.
    const working = screen.getByTestId("calculation-steps");
    const bonusRow = within(working)
      .getByText("Accumulator bonus")
      .closest("div")!;
    expect(bonusRow).toHaveTextContent(/^\+\s*Accumulator bonus\s*ETB 14\.83$/);
  });

  it("states the tenant's tax rates and the win-tax threshold", () => {
    seedReferenceSlip();
    render(<BetSlip />);

    expect(screen.getByText(/Stake tax/)).toHaveTextContent("Stake tax · 15%");
    expect(screen.getByText(/Winnings tax/)).toHaveTextContent(
      "Winnings tax · 15% of the whole win once it’s over ETB 1,000.00",
    );
  });

  it("follows the tenant's rule set: no_tax shows no tax lines and pays 681.85", () => {
    const noTax: BettingRules = {
      version: GOLDEN_RULES.no_tax.rules_version,
      quickStakes: [],
      calc: GOLDEN_RULES.no_tax,
    };
    seedReferenceSlip();
    render(<BetSlip />, { rules: noTax });

    // floor(100 × 6.81858) with no stake tax, no bonus table, no win tax.
    expect(netPayout()).toHaveTextContent("ETB 681.85");
    expect(screen.queryByText(/Stake tax/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Winnings tax/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Taxes are withheld/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Max win per ticket ETB 5,000,000.00.", {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  describe("quick stakes", () => {
    it("come from the tenant's rule set", () => {
      seedReferenceSlip();
      render(<BetSlip />);

      for (const amount of ["20", "50", "100", "500"]) {
        expect(
          screen.getByRole("button", { name: amount }),
        ).toBeInTheDocument();
      }
    });

    it("quick stake 100 on a 2/3 system charges 99.99 and warns about the remainder", async () => {
      seedReferenceSlip();
      useBetSlipStore.setState({ mode: "system", systemK: 2, stake: "" });
      render(<BetSlip />);

      await userEvent.click(screen.getByRole("button", { name: "100" }));

      expect(useBetSlipStore.getState().stake).toBe("100");
      expect(
        screen.getByText("3 bets × ETB 33.33", { selector: "div" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "ETB 100.00 can’t be split evenly across 3 bets, so you’ll be charged ETB 99.99.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Place bet/ }),
      ).toHaveTextContent("ETB 99.99");
    });

    it("sets the total rather than adding to it", async () => {
      seedReferenceSlip();
      render(<BetSlip />);

      await userEvent.click(screen.getByRole("button", { name: "50" }));
      await userEvent.click(screen.getByRole("button", { name: "20" }));

      expect(useBetSlipStore.getState().stake).toBe("20");
    });
  });

  it("offers the minimum when the stake is too low", async () => {
    seedReferenceSlip();
    useBetSlipStore.setState({ stake: "2" });
    render(<BetSlip />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Stake too low");
    expect(alert).toHaveTextContent("The minimum total stake is ETB 5.00.");
    expect(screen.getByRole("button", { name: /Place bet/ })).toBeDisabled();

    await userEvent.click(
      within(alert).getByRole("button", { name: "Set 5.00" }),
    );
    expect(useBetSlipStore.getState().stake).toBe("5.00");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers a minimum on singles that clears the alert when tapped", async () => {
    seedReferenceSlip();
    useBetSlipStore.setState({ mode: "single", stake: "2" });
    render(<BetSlip />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The minimum total stake is ETB 5.01.");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Set 5.01" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Place bet/ })).toHaveTextContent(
      "ETB 5.01",
    );
  });

  it("offers the maximum when the stake is too high", async () => {
    seedReferenceSlip();
    useBetSlipStore.setState({ stake: "60000" });
    render(<BetSlip />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "The maximum total stake is ETB 50,000.00.",
    );
    await userEvent.click(
      within(alert).getByRole("button", { name: "Set 50,000.00" }),
    );
    expect(useBetSlipStore.getState().stake).toBe("50000.00");
  });

  it("says when the payout cap is reached", () => {
    const store = useBetSlipStore.getState();
    for (const id of ["a", "b", "c", "d"]) {
      store.toggleSelection(pick(id, "1", "50.00", `Team ${id}`));
    }
    useBetSlipStore.setState({ stake: "1000" });
    render(<BetSlip />);

    expect(screen.getByText("Capped at max win")).toBeInTheDocument();
    expect(
      screen.getByText("Max payout of ETB 1,000,000.00 reached."),
    ).toBeInTheDocument();
  });

  it("shows no figures and cannot be placed until the rules load, then offers a retry", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    seedReferenceSlip();
    render(<BetSlip />, { rules: null });

    expect(screen.getByRole("button", { name: /Place bet/ })).toBeDisabled();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn’t load the betting rules");
    expect(
      within(alert).getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("net-payout")).not.toBeInTheDocument();
  });

  /**
   * The journey the architecture calls out as the most important to guard: a
   * price moves while the pick is already in the slip, and the bet must not go
   * through at a price the user never agreed to.
   */
  describe("odds change while a selection is in the slip", () => {
    beforeEach(seedReferenceSlip);

    it("blocks placing until the move is acknowledged", async () => {
      render(<BetSlip />);
      expect(screen.getByRole("button", { name: /Place bet/ })).toBeVisible();

      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), "3.40");

      // An odds move is a status update, not an error — errors are the ones that
      // stop the bet (conflict, suspension, insufficient balance).
      expect(await screen.findByRole("status")).toHaveTextContent(
        "Odds changed",
      );
      expect(
        screen.getByRole("button", { name: "Accept changes" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Place bet/ }),
      ).not.toBeInTheDocument();
    });

    it("does not treat a respelled price as a move", async () => {
      render(<BetSlip />);
      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), "3.050");

      expect(
        await screen.findByRole("button", { name: /Place bet/ }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows the old price struck through beside the new one", async () => {
      render(<BetSlip />);
      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), "3.40");

      expect(await screen.findByText("3.05")).toBeInTheDocument();
      expect(screen.getByText(/3\.40/)).toBeInTheDocument();
    });

    it("prices at the new odds, not the old", async () => {
      render(<BetSlip />);
      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), "3.40");

      // 1.62 × 3.40 × 1.38 = 7.60104 → 7.60
      expect(await screen.findByText("7.60")).toBeInTheDocument();
    });

    it("re-enables placing once accepted", async () => {
      render(<BetSlip />);
      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), "3.40");

      await userEvent.click(
        await screen.findByRole("button", { name: "Accept changes" }),
      );

      expect(
        await screen.findByRole("button", { name: /Place bet/ }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("accepts one selection at a time from its own row", async () => {
      render(<BetSlip />);
      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), "3.40");

      await userEvent.click(
        await screen.findByRole("button", { name: "Accept" }),
      );

      expect(
        await screen.findByRole("button", { name: /Place bet/ }),
      ).toBeInTheDocument();
    });

    it("suspends the leg when the price closes entirely", async () => {
      render(<BetSlip />);
      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), null);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Selection suspended",
      );
      expect(
        screen.getByRole("button", { name: "Remove suspended pick" }),
      ).toBeInTheDocument();
    });
  });

  it("refuses to combine two picks from one match", async () => {
    const store = useBetSlipStore.getState();
    store.toggleSelection(pick("m3", "1", "1.62", "Man City"));
    store.toggleSelection(pick("m3", "X", "4.10", "Draw"));
    render(<BetSlip />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Can’t combine these picks",
    );
    expect(
      screen.getByRole("button", { name: "Remove same-match pick" }),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Use Single" }));
    expect(
      await screen.findByRole("button", { name: /Place bet/ }),
    ).toBeEnabled();
  });

  it("places the bet and shows the engine's ticket", async () => {
    seedReferenceSlip();
    render(<BetSlip />);

    await userEvent.click(
      await screen.findByRole("button", { name: /Place bet/ }),
    );

    expect(await screen.findByText("Bet placed")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/^KS-\d{6}-\d{4}$/)).toBeInTheDocument(),
    );
    expect(screen.getByText("Multiple · 3 picks")).toBeInTheDocument();
    expect(screen.getByText("ETB 594.40")).toBeInTheDocument();
  });

  it("asks a guest to log in instead of betting", async () => {
    useSessionStore.setState({ isGuest: true });
    seedReferenceSlip();
    render(<BetSlip />);

    expect(
      await screen.findByRole("button", { name: "Log in to bet" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Balance/)).not.toBeInTheDocument();
  });

  it("switches the whole slip to Amharic", async () => {
    useUiStore.setState({ lang: "am" });
    seedReferenceSlip();
    render(<BetSlip />);

    expect(await screen.findByText("የውርርድ ትኬት")).toBeInTheDocument();
    expect(netPayout()).toHaveTextContent("594.40 ብር");
    expect(
      screen.getByRole("button", { name: /ውርርድ አስይዝ/ }),
    ).toBeInTheDocument();
  });
});
