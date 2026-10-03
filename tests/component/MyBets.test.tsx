import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AsidePanel } from "@/components/layout/AsidePanel";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { BetTicket } from "@/features/bets/components/BetTicket";
import { MyBetsView } from "@/features/bets/components/MyBetsView";
import { toBet, toBetPage } from "@/lib/api/mappers/bets";
import type { components } from "@/lib/api/schema";
import { useUiStore } from "@/stores/ui.store";
import { example } from "../contract";
import { render } from "./render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: vi.fn(() => "/my-bets"),
}));

type ApiBet = components["schemas"]["Bet"];

/** The contract's open single (`M3HX-7PQA-V`), with the test's own figures. */
const OPEN = (changes: Partial<ApiBet> = {}): ApiBet => ({
  ...example("/v1/bets").items[0],
  ...changes,
});
/** The contract's won multiple (`K7Q2-M9XP-M`), with the test's own figures. */
const WON = (changes: Partial<ApiBet> = {}): ApiBet => ({
  ...example("/v1/bets/{id}"),
  ...changes,
});

/** What `/api/bets` answers for a page of the API's bets: mapped, as the route does. */
const page = (items: ApiBet[], nextCursor: string | null = null) => {
  const raw = { items, next_cursor: nextCursor };
  return toBetPage({ en: raw, am: raw });
};
const bet = (raw: ApiBet) => toBet({ en: raw, am: raw });

type Answer = [number, unknown] | "drop";

/** Every request to this app's `/api/bets…`, in order — the request log. */
let requests: URL[] = [];

/**
 * Stubs `/api/bets` by path and query (`/api/bets?status=open`,
 * `/api/bets?status=open&cursor=c2`, `/api/bets/{id}`): each key answers in
 * turn, its last answer standing.
 */
function answers(routes: Record<string, Answer[]>) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (!url.pathname.startsWith("/api/bets")) {
      throw new Error(`unexpected ${url}`);
    }
    requests.push(url);
    const queue = routes[`${url.pathname}${url.search}`];
    if (!queue) throw new Error(`no answer for ${url.pathname}${url.search}`);
    const answer = queue.length > 1 ? queue.shift()! : queue[0];
    if (answer === "drop") throw new TypeError("Failed to fetch");
    const [status, body] = answer;
    return Response.json(body, {
      status,
      headers: {
        "Content-Type":
          status >= 400 ? "application/problem+json" : "application/json",
      },
    });
  });
}

const problem = (status: number, code: string): [number, unknown] => [
  status,
  { type: "about:blank", title: code, status, code },
];

const OPEN_LIST = "/api/bets?status=open";
const SETTLED_LIST = "/api/bets?status=settled";
const WON_DETAIL = "/api/bets/01J9A7V0000000000000000001";

const cards = () => screen.getAllByRole("listitem");

beforeEach(() => {
  requests = [];
  useUiStore.setState({ lang: "en", clock: "eat", calendar: "gregorian" });
  useAuthStore.getState().close();
});

afterEach(() => vi.restoreAllMocks());

describe("My bets", () => {
  it("shows each ticket's potential payout, payout and taxes from the API, not a recomputation (AC-3)", async () => {
    // Figures slipcalc would never produce from these legs and stakes: under
    // the contract's rules it prices the open single at 82.87 and the won
    // multiple at 289.17 with 15.00 stake tax.
    answers({
      [OPEN_LIST]: [[200, page([OPEN({ potential_payout: "84.00" })])]],
      [SETTLED_LIST]: [
        [
          200,
          page([
            WON({ stake_tax: "14.00", payout: "250.00", win_tax: "12.34" }),
          ]),
        ],
      ],
    });
    render(<MyBetsView />);

    const [open] = await screen.findAllByRole("listitem");
    expect(open).toHaveTextContent("Open");
    expect(open).toHaveTextContent("Single");
    expect(open).toHaveTextContent("Saint George v Fasil Kenema");
    expect(open).toHaveTextContent("ETB 50.00");
    expect(open).toHaveTextContent("1.95");
    expect(open).toHaveTextContent("Potential payout");
    expect(open).toHaveTextContent("ETB 84.00");
    expect(open).not.toHaveTextContent("82.87");
    // Its leg hasn't started: the kick-off, in East Africa Time.
    expect(open).toHaveTextContent("04/10 · 16:00");

    await userEvent.click(screen.getByRole("button", { name: "Settled" }));

    await waitFor(() => expect(cards()[0]).toHaveTextContent("K7Q2"));
    const [won] = cards();
    expect(won).toHaveTextContent("Won");
    expect(won).toHaveTextContent("Multiple · 2 picks");
    expect(won).toHaveTextContent("Payout");
    expect(won).toHaveTextContent("ETB 250.00");
    expect(won).toHaveTextContent(
      "Tax withheld: ETB 12.34 winnings · ETB 14.00 stake",
    );
    expect(won).not.toHaveTextContent("289.17");
    expect(won).not.toHaveTextContent("15.00");
    expect(
      screen.getByRole("button", { name: "Settled", pressed: true }),
    ).toBeInTheDocument();
    expect(requests.map((url) => url.search)).toEqual([
      "?status=open",
      "?status=settled",
    ]);
  });

  it("pages with next_cursor: Show more asks for the next page and adds it, and goes on the last page (AC-5)", async () => {
    answers({
      [OPEN_LIST]: [[200, page([OPEN()], "c2")]],
      [`${OPEN_LIST}&cursor=c2`]: [
        [
          200,
          page([
            OPEN({
              id: "01J9A7V0000000000000000003",
              ticket_id: "R7K2-M9XP-K",
            }),
          ]),
        ],
      ],
    });
    render(<MyBetsView />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Show more" }),
    );

    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(cards()[0]).toHaveTextContent("M3HX-7PQA-V");
    expect(cards()[1]).toHaveTextContent("R7K2-M9XP-K");
    expect(
      screen.queryByRole("button", { name: "Show more" }),
    ).not.toBeInTheDocument();
    expect(requests.map((url) => url.search)).toEqual([
      "?status=open",
      "?status=open&cursor=c2",
    ]);
  });

  it("says when the next page didn't load, and tries it again", async () => {
    answers({
      [OPEN_LIST]: [[200, page([OPEN()], "c2")]],
      [`${OPEN_LIST}&cursor=c2`]: [
        problem(503, "SERVICE_UNAVAILABLE"),
        [
          200,
          page([
            OPEN({
              id: "01J9A7V0000000000000000003",
              ticket_id: "R7K2-M9XP-K",
            }),
          ]),
        ],
      ],
    });
    render(<MyBetsView />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Show more" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn’t load more bets.");
    // The page already shown stays.
    expect(cards()).toHaveLength(1);
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );
    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says when there are no bets under a tab, in that tab's words", async () => {
    answers({
      [OPEN_LIST]: [[200, page([])]],
      [SETTLED_LIST]: [[200, page([])]],
    });
    render(<MyBetsView />);

    expect(await screen.findByText("No open bets")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse matches" }),
    ).toHaveAttribute("href", "/");

    await userEvent.click(screen.getByRole("button", { name: "Settled" }));
    expect(await screen.findByText("No settled bets yet")).toBeInTheDocument();
  });

  it("says when the bets couldn't be loaded, and tries again", async () => {
    answers({ [OPEN_LIST]: ["drop", [200, page([OPEN()])]] });
    render(<MyBetsView />);

    expect(
      await screen.findByRole("heading", { name: "Couldn’t load your bets" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(cards()).toHaveLength(1));
  });

  it("asks a guest to log in, and asks the API nothing", async () => {
    answers({});
    render(<MyBetsView />, { session: "guest" });

    expect(
      screen.getByRole("heading", { name: "Log in to see your bets" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(useAuthStore.getState().entry).toBe("login");
    expect(requests).toHaveLength(0);
  });

  it("waits for /api/me before asking for anything", () => {
    answers({});
    render(<MyBetsView />, { session: null });

    expect(
      screen.queryByRole("heading", { name: "Log in to see your bets" }),
    ).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });
});

describe("a ticket", () => {
  it("opens with every leg's result and the API's stake, stake tax, bonus, winnings tax and payout (AC-3)", async () => {
    answers({
      [WON_DETAIL]: [
        [
          200,
          bet(
            WON({
              stake_bonus: "20.00",
              stake_tax: "14.00",
              acca_bonus: "5.55",
              win_tax: "12.34",
              payout: "250.00",
            }),
          ),
        ],
      ],
    });
    render(<BetTicket id="01J9A7V0000000000000000001" />);

    expect(await screen.findByText("K7Q2-M9XP-M")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Ticket: K7Q2-M9XP-M" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Won", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Placed 03/10 · 17:05")).toBeInTheDocument();
    expect(screen.getByText("Settled 05/10 · 00:02")).toBeInTheDocument();

    const legs = screen.getAllByRole("listitem");
    expect(legs).toHaveLength(2);
    expect(legs[0]).toHaveTextContent("1X2");
    expect(legs[0]).toHaveTextContent("Arsenal v Chelsea");
    expect(legs[0]).toHaveTextContent("Won");
    expect(legs[0]).toHaveTextContent("2.10");
    expect(legs[1]).toHaveTextContent("Over 2.5");
    expect(legs[1]).toHaveTextContent("1.62");

    const figures = screen.getByTestId("ticket-figures");
    const row = (label: string) =>
      within(figures).getByText(label).closest("div")!;
    expect(row("Total odds")).toHaveTextContent("3.40");
    expect(row("Stake")).toHaveTextContent("ETB 100.00");
    expect(row("From bonus balance")).toHaveTextContent("ETB 20.00");
    expect(row("Stake tax")).toHaveTextContent("− ETB 14.00");
    expect(row("Accumulator bonus")).toHaveTextContent("+ ETB 5.55");
    expect(row("Winnings tax")).toHaveTextContent("− ETB 12.34");
    expect(row("Payout")).toHaveTextContent("ETB 250.00");
    // None of slipcalc's: 15.00 stake tax, 85.00 net stake, 289.17.
    expect(figures).not.toHaveTextContent("15.00");
    expect(figures).not.toHaveTextContent("85.00");
    expect(figures).not.toHaveTextContent("289.17");
  });

  it("shows an open ticket's potential payout, and no winnings tax before settlement", async () => {
    const open = OPEN();
    answers({ [`/api/bets/${open.id}`]: [[200, bet(open)]] });
    render(<BetTicket id={open.id} />);

    const figures = await screen.findByTestId("ticket-figures");
    expect(figures).toHaveTextContent("Potential payout");
    expect(figures).toHaveTextContent("ETB 82.87");
    expect(figures).not.toHaveTextContent("Winnings tax");
    expect(figures).not.toHaveTextContent("Accumulator bonus");
    expect(figures).not.toHaveTextContent("From bonus balance");
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(
      "04/10 · 16:00",
    );
  });

  it("shares the ticket's /t address on Telegram", async () => {
    answers({ [WON_DETAIL]: [[200, bet(WON())]] });
    render(<BetTicket id="01J9A7V0000000000000000001" />);

    const share = await screen.findByRole("link", {
      name: /Share on Telegram/,
    });
    const url = `${window.location.origin}/t/K7Q2-M9XP-M`;
    expect(share).toHaveAttribute(
      "href",
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Ticket K7Q2-M9XP-M")}`,
    );
  });

  it("says a ticket isn't on this account when the API answers 404", async () => {
    answers({
      "/api/bets/01J9A7V0000000000000000009": [problem(404, "NOT_FOUND")],
    });
    render(<BetTicket id="01J9A7V0000000000000000009" />);

    expect(
      await screen.findByRole("heading", { name: "Ticket not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This ticket isn’t on your account."),
    ).toBeInTheDocument();
  });

  it("says when a ticket couldn't be loaded, and tries again", async () => {
    answers({ [WON_DETAIL]: ["drop", [200, bet(WON())]] });
    render(<BetTicket id="01J9A7V0000000000000000001" />);

    expect(
      await screen.findByRole("heading", { name: "Couldn’t load this ticket" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("K7Q2-M9XP-M")).toBeInTheDocument();
  });
});

describe("the aside's My bets count", () => {
  const myBetsTab = () => screen.getByRole("button", { name: /My bets/ });

  it("counts open bets from the first page", async () => {
    answers({ [OPEN_LIST]: [[200, page([OPEN(), WON()])]] });
    render(<AsidePanel />);

    await waitFor(() => expect(myBetsTab()).toHaveTextContent("My bets2"));
  });

  it("says there are more when the first page has a next_cursor", async () => {
    answers({ [OPEN_LIST]: [[200, page([OPEN(), WON()], "c2")]] });
    render(<AsidePanel />);

    await waitFor(() => expect(myBetsTab()).toHaveTextContent("My bets2+"));
    // Only the first page is read for the count.
    expect(requests.map((url) => url.search)).toEqual(["?status=open"]);
  });

  it("asks nothing for a guest", () => {
    answers({});
    render(<AsidePanel />, { session: "guest" });

    expect(myBetsTab()).toHaveTextContent("My bets0");
    expect(requests).toHaveLength(0);
  });
});
