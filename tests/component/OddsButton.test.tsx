import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OddsButtonView } from "@/features/odds/components/OddsButtonView";
import { OddsButton } from "@/features/odds/components/OddsButton";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useUiStore } from "@/stores/ui.store";
import type { Market } from "@/features/markets/types";
// The connected button reads the responsible-gaming lock from the server, so it
// needs the query provider.
import { render } from "./render";

const market: Market = {
  id: "m3:1x2:",
  eventId: "m3",
  templateId: "m_1x2",
  type: "1x2",
  category: "main",
  name: { en: "Match result", am: "የጨዋታ ውጤት" },
  line: null,
  status: "open",
  outcomes: [
    {
      id: "oc_m3_1",
      code: "1",
      label: { en: "Man City", am: "Man City" },
      odds: 1.62,
      previousOdds: null,
      movement: null,
    },
    {
      id: "oc_m3_x",
      code: "X",
      label: { en: "Draw", am: "አቻ" },
      odds: null,
      previousOdds: null,
      movement: null,
    },
  ],
};

const eventName = { en: "Man City – Newcastle", am: "Man City – Newcastle" };

describe("OddsButtonView", () => {
  it("shows the price", () => {
    render(
      <OddsButtonView
        odds="1.62"
        selected={false}
        movement={null}
        ariaLabel="Man City 1.62"
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("1.62");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("marks a selected price as pressed", () => {
    render(
      <OddsButtonView
        odds="1.62"
        selected
        movement={null}
        ariaLabel="Man City 1.62, in bet slip"
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a rise and a fall differently", () => {
    const { unmount } = render(
      <OddsButtonView
        odds="2.05"
        selected={false}
        movement="up"
        ariaLabel="up"
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("▲");
    unmount();

    render(
      <OddsButtonView
        odds="2.90"
        selected={false}
        movement="down"
        ariaLabel="down"
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("▼");
  });

  it("disables a suspended price and shows no number", () => {
    render(
      <OddsButtonView
        odds={null}
        selected={false}
        movement={null}
        ariaLabel="Draw, suspended"
      />,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-pressed");
    expect(button.textContent).toBe("");
  });

  it("labels the outcome in a lined market", () => {
    render(
      <OddsButtonView
        odds="1.72"
        label="Over 2.5"
        selected={false}
        movement={null}
        ariaLabel="Over 2.5 1.72"
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Over 2.5");
  });
});

describe("OddsButton → bet slip", () => {
  beforeEach(() => {
    useBetSlipStore.getState().clear();
    useUiStore.setState({ lang: "en" });
  });

  const renderPrice = (index: number) =>
    render(
      <OddsButton
        market={market}
        outcome={market.outcomes[index]}
        eventName={eventName}
      />,
    );

  it("announces the pick, the price and the context", () => {
    renderPrice(0);
    expect(
      screen.getByRole("button", {
        name: "Man City – Newcastle: Man City 1.62",
      }),
    ).toBeInTheDocument();
  });

  it("adds the selection when tapped", async () => {
    renderPrice(0);
    await userEvent.click(screen.getByRole("button"));

    const { selections } = useBetSlipStore.getState();
    expect(selections).toHaveLength(1);
    expect(selections[0]).toMatchObject({
      uid: "m3#1x2||1",
      eventId: "m3",
      marketType: "1x2",
      outcomeCode: "1",
      initialOdds: 1.62,
      currentOdds: 1.62,
      suspended: false,
    });
  });

  it("removes it when tapped again", async () => {
    renderPrice(0);
    await userEvent.click(screen.getByRole("button"));
    await userEvent.click(screen.getByRole("button"));
    expect(useBetSlipStore.getState().selections).toHaveLength(0);
  });

  it("reflects that it is already in the slip", async () => {
    renderPrice(0);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAccessibleName(/in bet slip/);
  });

  it("cannot add a suspended price", async () => {
    renderPrice(1);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await userEvent.click(button, { pointerEventsCheck: 0 });
    expect(useBetSlipStore.getState().selections).toHaveLength(0);
  });

  it("announces in Amharic when the language changes", () => {
    useUiStore.setState({ lang: "am" });
    renderPrice(1);
    expect(screen.getByRole("button")).toHaveAccessibleName(/ታግዷል/);
  });
});

/**
 * A responsible-gaming break has to lock every price, and it has to do so from
 * account state rather than anything the browser owns — a break a user could end
 * by reloading would not be a break at all.
 */
describe("OddsButton → responsible-gaming break", () => {
  beforeEach(() => {
    useBetSlipStore.getState().clear();
    useUiStore.setState({ lang: "en" });
  });

  it("locks an otherwise open price while a break is running", async () => {
    const { queryClient } = render(
      <OddsButton
        market={market}
        outcome={market.outcomes[0]}
        eventName={eventName}
      />,
    );

    expect(screen.getByRole("button")).toBeEnabled();

    queryClient.setQueryData(["responsible-gaming"], {
      coolOffUntil: "Wed 30 Sep, 14:00",
      selfExcludedUntil: null,
    });

    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());
    expect(screen.getByRole("button")).toHaveAccessibleName(/suspended/);
  });

  it("refuses the selection even if the click gets through", async () => {
    const { queryClient } = render(
      <OddsButton
        market={market}
        outcome={market.outcomes[0]}
        eventName={eventName}
      />,
    );

    queryClient.setQueryData(["responsible-gaming"], {
      coolOffUntil: null,
      selfExcludedUntil: "Permanent",
    });
    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());

    await userEvent.click(screen.getByRole("button"), {
      pointerEventsCheck: 0,
    });
    expect(useBetSlipStore.getState().selections).toHaveLength(0);
  });
});
