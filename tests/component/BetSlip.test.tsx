import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BetSlip } from "@/features/bet-slip/components/BetSlip";
import {
  selectionFrom,
  useBetSlipStore,
} from "@/features/bet-slip/stores/bet-slip.store";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import type { OutcomeRef } from "@/features/markets/types";
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

const pick = (eventId: string, code: string, odds: number, team: string) =>
  selectionFrom({
    ref: ref(eventId, code),
    marketId: `${eventId}:1x2:`,
    eventName: { en: `${team} match`, am: `${team} match` },
    marketName: { en: "Match result", am: "የጨዋታ ውጤት" },
    outcomeName: { en: team, am: team },
    odds,
  });

/** The design's reference slip: 1.62 × 3.05 × 1.38 → ETB 507.64. */
function seedReferenceSlip() {
  const store = useBetSlipStore.getState();
  store.toggleSelection(pick("m3", "1", 1.62, "Man City"));
  store.toggleSelection(pick("m4", "X", 3.05, "Draw"));
  store.toggleSelection(pick("m6", "1", 1.38, "Barcelona"));
}

describe("BetSlip", () => {
  beforeEach(() => {
    useBetSlipStore.getState().clear();
    useBetSlipStore.setState({ mode: "multiple", stake: 100, systemK: 2 });
    useUiStore.setState({ lang: "en" });
    useSessionStore.setState({ isGuest: false });
  });

  it("invites a first selection when empty", () => {
    render(<BetSlip />);
    expect(screen.getByText("Your bet slip is empty")).toBeInTheDocument();
  });

  it("shows the design's reference payout", async () => {
    seedReferenceSlip();
    render(<BetSlip />);

    expect(await screen.findByText("ETB 507.64")).toBeInTheDocument();
    expect(screen.getByText("6.82")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Place bet/ })).toBeEnabled();
  });

  it("explains the full calculation on request", async () => {
    seedReferenceSlip();
    render(<BetSlip />);

    await userEvent.click(
      screen.getByRole("button", { name: "How is this calculated?" }),
    );

    expect(screen.getByText("Net stake")).toBeInTheDocument();
    expect(screen.getByText("Gross return")).toBeInTheDocument();
    expect(screen.getByText("ETB 579.58")).toBeInTheDocument(); // gross
    expect(screen.getByText("ETB 85.00")).toBeInTheDocument(); // net stake
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

      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), 3.4);

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

    it("shows the old price struck through beside the new one", async () => {
      render(<BetSlip />);
      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), 3.4);

      expect(await screen.findByText("3.05")).toBeInTheDocument();
      expect(screen.getByText(/3\.40/)).toBeInTheDocument();
    });

    it("prices at the new odds, not the old", async () => {
      render(<BetSlip />);
      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), 3.4);

      // 1.62 × 3.40 × 1.38 = 7.6010
      expect(await screen.findByText("7.60")).toBeInTheDocument();
    });

    it("re-enables placing once accepted", async () => {
      render(<BetSlip />);
      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), 3.4);

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
      useBetSlipStore.getState().applyOddsUpdate(ref("m4", "X"), 3.4);

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
    store.toggleSelection(pick("m3", "1", 1.62, "Man City"));
    store.toggleSelection(pick("m3", "X", 4.1, "Draw"));
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
    expect(screen.getByText("ETB 507.64")).toBeInTheDocument();
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
    expect(screen.getByText("507.64 ብር")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ውርርድ አስይዝ/ }),
    ).toBeInTheDocument();
  });
});
