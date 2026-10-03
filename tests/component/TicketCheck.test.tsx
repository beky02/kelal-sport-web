import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { TicketStatus } from "@/features/bets/types";
import { TicketCheckView } from "@/features/tickets/components/TicketCheckView";
import { toTicketCheck } from "@/lib/api/mappers/tickets";
import type { components } from "@/lib/api/schema";
import { useUiStore } from "@/stores/ui.store";
import { example } from "../contract";
import { render } from "./render";

type ApiTicketCheck = components["schemas"]["TicketCheck"];

/** The contract's ticket check, as the page passes it to the view. */
const TICKET = (changes: Partial<ApiTicketCheck> = {}) => {
  const raw = { ...example("/v1/tickets/{ticket_id}"), ...changes };
  return toTicketCheck({ en: raw, am: raw });
};

beforeEach(() => {
  useUiStore.setState({ lang: "en", clock: "eat", calendar: "gregorian" });
});

describe("the public ticket check", () => {
  it("shows the ticket's status, legs, stake and the API's payout — no owner", () => {
    render(<TicketCheckView ticket={TICKET()} />, { session: "guest" });

    expect(
      screen.getByRole("heading", { level: 1, name: "Ticket K7Q2-M9XP-M" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("Won");
    expect(screen.getByText("Multiple · 2 picks")).toBeInTheDocument();
    expect(screen.getByText("Placed 03/10 · 17:05")).toBeInTheDocument();
    expect(screen.getByText("Settled 05/10 · 00:02")).toBeInTheDocument();
    const legs = screen.getAllByRole("listitem");
    expect(legs).toHaveLength(2);
    expect(legs[0]).toHaveTextContent("Arsenal v Chelsea · Won");
    expect(legs[0]).toHaveTextContent("2.10");
    const figures = screen.getByTestId("ticket-figures");
    expect(within(figures).getByText("Stake").closest("div")).toHaveTextContent(
      "ETB 100.00",
    );
    expect(
      within(figures).getByText("Payout").closest("div"),
    ).toHaveTextContent("ETB 289.17");
  });

  it.each([
    ["open", "Open"],
    ["won", "Won"],
    ["lost", "Lost"],
    ["void", "Void"],
    ["cashed_out", "Cashed out"],
    ["cancelled", "Cancelled"],
    ["paid", "Paid"],
    ["expired", "Expired"],
  ] as const)("says %s in words: %s", (status: TicketStatus, word) => {
    render(<TicketCheckView ticket={TICKET({ status })} />, {
      session: "guest",
    });
    expect(screen.getByTestId("ticket-status")).toHaveTextContent(word);
  });

  it("calls a cashed-out ticket's payout what it is (M2)", () => {
    render(
      <TicketCheckView
        ticket={TICKET({ status: "cashed_out", payout: "120.00" })}
      />,
      { session: "guest" },
    );
    const figures = screen.getByTestId("ticket-figures");
    expect(
      within(figures).getByText("Cashed out").closest("div"),
    ).toHaveTextContent("ETB 120.00");
  });

  it("draws no payout line when the API sends none — an open ticket, say (M2)", () => {
    render(
      <TicketCheckView
        ticket={TICKET({ status: "open", payout: null, settled_at: null })}
      />,
      { session: "guest" },
    );
    const figures = screen.getByTestId("ticket-figures");
    // The stake's row alone: no payout line, so no made-up zero either.
    expect(figures.children).toHaveLength(1);
    expect(figures).toHaveTextContent("ETB 100.00");
    expect(figures).not.toHaveTextContent("Payout");
    expect(screen.queryByText(/^Settled/)).not.toBeInTheDocument();
  });

  it("reads in Amharic", () => {
    useUiStore.setState({ lang: "am" });
    render(<TicketCheckView ticket={TICKET()} />, { session: "guest" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "ትኬት K7Q2-M9XP-M",
    );
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("አሸንፏል");
    expect(screen.getByTestId("ticket-figures")).toHaveTextContent("289.17 ብር");
  });
});
