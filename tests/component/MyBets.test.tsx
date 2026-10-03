import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AsidePanel } from "@/components/layout/AsidePanel";
import { SessionWatcher } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { BetTicket } from "@/features/bets/components/BetTicket";
import { MyBetsView } from "@/features/bets/components/MyBetsView";
import { toBet, toBetPage } from "@/lib/api/mappers/bets";
import type { components } from "@/lib/api/schema";
import { sessionKeys } from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import { example } from "../contract";
import { CONTRACT_PLAYER, render } from "./render";

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

type Answer = [number, unknown] | "drop" | Promise<[number, unknown]>;

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

  it("moves focus to the first new ticket once Show more has brought it (Q4)", async () => {
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
    // The button is gone with the last page; focus isn't left on <body>.
    await waitFor(() =>
      expect(within(cards()[1]).getByRole("link")).toHaveFocus(),
    );
  });

  it("asks for the next page once, however often Show more is tapped while it loads (Q12)", async () => {
    let deliver: (answer: [number, unknown]) => void = () => {};
    answers({
      [OPEN_LIST]: [[200, page([OPEN()], "c2")]],
      [`${OPEN_LIST}&cursor=c2`]: [
        new Promise((resolve) => {
          deliver = resolve;
        }),
      ],
    });
    render(<MyBetsView />);
    const more = await screen.findByRole("button", { name: "Show more" });

    await userEvent.click(more);
    await userEvent.click(more);
    await userEvent.click(more);
    deliver([
      200,
      page([
        OPEN({ id: "01J9A7V0000000000000000003", ticket_id: "R7K2-M9XP-K" }),
      ]),
    ]);

    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(
      requests.filter((url) => url.searchParams.has("cursor")),
    ).toHaveLength(1);
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
    // Show more is gone: focus goes to the way on, not to <body> (Q4).
    await waitFor(() =>
      expect(
        within(alert).getByRole("button", { name: "Try again" }),
      ).toHaveFocus(),
    );
    // The page already shown stays.
    expect(cards()).toHaveLength(1);
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );
    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("takes no focus when a list mounts after an earlier Show more failed (R1)", async () => {
    answers({
      [OPEN_LIST]: [[200, page([OPEN()], "c2")]],
      [`${OPEN_LIST}&cursor=c2`]: [problem(503, "SERVICE_UNAVAILABLE")],
    });
    const { queryClient, rerender } = render(<MyBetsView />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Show more" }),
    );
    await screen.findByRole("alert");

    // Later, elsewhere: the player is in another control when a list mounts
    // again (the aside on the next page) over the same failed state.
    const elsewhere = (
      <QueryClientProvider client={queryClient}>
        <button type="button">Elsewhere</button>
      </QueryClientProvider>
    );
    rerender(elsewhere);
    screen.getByRole("button", { name: "Elsewhere" }).focus();
    rerender(
      <QueryClientProvider client={queryClient}>
        <button type="button">Elsewhere</button>
        <MyBetsView />
      </QueryClientProvider>,
    );

    await screen.findAllByRole("listitem");
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
  });

  it("shows nothing on a card for a settled bet the API sent without a payout, never a 0.00 (M2)", async () => {
    answers({
      [OPEN_LIST]: [[200, page([])]],
      [SETTLED_LIST]: [[200, page([WON({ status: "lost", payout: null })])]],
    });
    render(<MyBetsView />);

    await userEvent.click(screen.getByRole("button", { name: "Settled" }));

    const [card] = await screen.findAllByRole("listitem");
    // The payout's own cell: the stake beside it holds "100.00" too.
    const cell = within(card).getByText("Payout").parentElement!;
    expect(cell).toHaveTextContent("—");
    expect(cell).not.toHaveTextContent("ETB");
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

  it("drops one player's bets when another signs in elsewhere, with no guest between (SEC1)", async () => {
    answers({
      [OPEN_LIST]: [
        [200, page([OPEN()])],
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
    const { queryClient } = render(
      <>
        <SessionWatcher />
        <MyBetsView />
      </>,
    );
    expect(await screen.findByText("M3HX-7PQA-V")).toBeInTheDocument();

    // Another tab logged out and someone else logged in: /api/me says so.
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), {
        player: { ...CONTRACT_PLAYER, id: "01J9A7R0000000000000000099" },
      });
    });

    expect(await screen.findByText("R7K2-M9XP-K")).toBeInTheDocument();
    expect(screen.queryByText("M3HX-7PQA-V")).not.toBeInTheDocument();
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

  it.each([
    // All legs void: the API pays back the net stake (D1.9) — its figure.
    ["void", "85.00", "Payout", "ETB 85.00"],
    ["cashed_out", "120.00", "Cashed out", "ETB 120.00"],
    // The API's own zero for a lost bet, shown as it comes.
    ["lost", "0.00", "Payout", "ETB 0.00"],
  ] as const)(
    "shows a %s ticket's payout as the API sends it (M2)",
    async (status, payout, label, amount) => {
      answers({ [WON_DETAIL]: [[200, bet(WON({ status, payout }))]] });
      render(<BetTicket id="01J9A7V0000000000000000001" />);

      const figures = await screen.findByTestId("ticket-figures");
      const line = within(figures).getByText(label).closest("div")!;
      expect(line).toHaveTextContent(amount);
      // Never the slip's view of the same legs.
      expect(figures).not.toHaveTextContent("289.17");
    },
  );

  it("shows nothing for a settled ticket the API sent without a payout, never a 0.00 (M2)", async () => {
    answers({
      [WON_DETAIL]: [[200, bet(WON({ status: "lost", payout: null }))]],
    });
    render(<BetTicket id="01J9A7V0000000000000000001" />);

    const figures = await screen.findByTestId("ticket-figures");
    const line = within(figures).getByText("Payout").closest("div")!;
    expect(line).toHaveTextContent("—");
    expect(line).not.toHaveTextContent("0.00");
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

  it("doesn't call a 404 without the API's NOT_FOUND a ticket that isn't yours (Q7)", async () => {
    // A 404 from something in the way (an edge, a mock route) says nothing
    // about whose ticket this is.
    answers({
      [WON_DETAIL]: [
        [404, { type: "about:blank", title: "Not Found", status: 404 }],
      ],
    });
    render(<BetTicket id="01J9A7V0000000000000000001" />);

    expect(
      await screen.findByRole("heading", { name: "Couldn’t load this ticket" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("This ticket isn’t on your account.")).toBeNull();
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

  /** The aside shows from 1280 px; below it, it is in the page but hidden. */
  const viewport = (wide: boolean) =>
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: wide && query === "(min-width: 1280px)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

  beforeEach(() => viewport(true));
  afterEach(() => vi.unstubAllGlobals());

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

  it("reads only the first page for its count, however far My bets has paged (Q3)", async () => {
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
    const { queryClient, rerender } = render(<MyBetsView />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Show more" }),
    );
    await waitFor(() => expect(cards()).toHaveLength(2));
    // Later, on another page: the pages My bets loaded have gone stale.
    await queryClient.invalidateQueries({
      queryKey: ["bets"],
      refetchType: "none",
    });
    requests = [];

    rerender(
      <QueryClientProvider client={queryClient}>
        <AsidePanel />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(myBetsTab()).toHaveTextContent("My bets1+"));
    // One small read, not every page My bets once loaded.
    expect(requests.map((url) => url.search)).toEqual(["?status=open"]);
  });

  it("asks nothing on a screen too narrow to show the aside (Q2)", () => {
    viewport(false);
    answers({});
    render(<AsidePanel />);

    expect(requests).toHaveLength(0);
  });

  it("shows no count until the first page is in, and none after it failed — never a 0 (Q8)", async () => {
    answers({ [OPEN_LIST]: ["drop"] });
    const { queryClient } = render(<AsidePanel />);

    expect(myBetsTab()).toHaveTextContent(/^My bets$/);
    await waitFor(() =>
      expect(queryClient.getQueryState(["bets", "open-count"])?.status).toBe(
        "error",
      ),
    );
    expect(myBetsTab()).toHaveTextContent(/^My bets$/);
  });

  it("asks nothing for a guest", () => {
    answers({});
    render(<AsidePanel />, { session: "guest" });

    expect(myBetsTab()).toHaveTextContent("My bets0");
    expect(requests).toHaveLength(0);
  });
});
