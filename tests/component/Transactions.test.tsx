import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionWatcher } from "@/features/auth/hooks/use-session";
import { TransactionsList } from "@/features/wallet/components/TransactionsList";
import type { WalletTxn, WalletTxnPage } from "@/features/wallet/types";
import { toWalletTxnPage } from "@/lib/api/mappers/wallet";
import { sessionKeys, transactionKeys } from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import { example } from "../contract";
import { CONTRACT_PLAYER, render } from "./render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: vi.fn(() => "/transactions"),
}));

/** What `/api/wallet/transactions` answers for Prism's player. */
const CONTRACT_HISTORY = toWalletTxnPage(example("/v1/wallet/transactions"));

/** Noon in Addis Ababa on Sunday 4 October 2026. */
const NOW = Date.parse("2026-10-04T09:00:00Z");

const txn = (over: Partial<WalletTxn> & Pick<WalletTxn, "id">): WalletTxn => ({
  type: "deposit",
  amount: "100.00",
  balanceAfter: "1000.00",
  label: "telebirr",
  reference: { type: "payment", id: `pay_${over.id}` },
  createdAt: "2026-10-04T08:00:00Z",
  ...over,
});

const UNAVAILABLE = {
  type: "about:blank",
  title: "The sportsbook API could not be reached",
  status: 503,
  code: "SERVICE_UNAVAILABLE",
};

/** Every `/api/…` path and query asked for, in order. */
let asked: string[] = [];

/** Answers `/api/wallet/transactions` by its query; nothing else is there. */
function history(answer: (query: URLSearchParams) => [number, unknown]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    asked.push(`${url.pathname}${url.search}`);
    if (url.pathname !== "/api/wallet/transactions") {
      throw new Error(`unexpected ${url}`);
    }
    const [status, body] = answer(url.searchParams);
    return Response.json(body, {
      status,
      headers: {
        "Content-Type":
          status >= 400 ? "application/problem+json" : "application/json",
      },
    });
  });
}

const page = (items: WalletTxn[], nextCursor: string | null = null) =>
  [200, { items, nextCursor } satisfies WalletTxnPage] as [number, unknown];

/** The day headings on screen, in order. */
const headings = () =>
  screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  asked = [];
  useUiStore.setState({ lang: "en", clock: "eat", calendar: "gregorian" });
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the wallet history (AC-6)", () => {
  it("groups movements by day in East Africa Time, newest first (AC-6)", async () => {
    history(() =>
      page([
        // 01:30 on Sunday 4 October in Addis Ababa, still the 3rd in UTC.
        txn({ id: "t3", createdAt: "2026-10-03T22:30:00Z" }),
        txn({ id: "t2", createdAt: "2026-10-03T14:05:22Z" }),
        txn({ id: "t1", createdAt: "2026-10-01T09:00:00Z" }),
      ]),
    );
    render(<TransactionsList />);

    await screen.findByText("Today · 4 Oct");
    expect(headings()).toEqual([
      "Today · 4 Oct",
      "Yesterday · 3 Oct",
      "Thu 1 Oct",
    ]);
    const today = screen.getByRole("group", { name: "Today · 4 Oct" });
    expect(within(today).getByText("01:30")).toBeInTheDocument();
    const yesterday = screen.getByRole("group", { name: "Yesterday · 3 Oct" });
    expect(within(yesterday).getByText("17:05")).toBeInTheDocument();
  });

  it("shows each movement's kind, reference, time, signed amount and balance after (AC-6)", async () => {
    history(() => [200, CONTRACT_HISTORY]);
    render(<TransactionsList />);

    const win = await screen.findByRole("link", {
      name: /Winnings · K7Q2-M9XP-M/,
    });
    expect(win).toHaveTextContent("+ ETB 289.17");
    expect(win).toHaveTextContent("Balance ETB 1,208.95");
    expect(win).toHaveTextContent("00:02");
    expect(win).toHaveAttribute("href", "/my-bets/01J9A7V0000000000000000001");

    const stake = screen.getByRole("link", { name: /Bet · K7Q2-M9XP-M/ });
    expect(stake).toHaveTextContent("− ETB 100.00");
    expect(stake).toHaveTextContent("Balance ETB 919.78");
    expect(stake).toHaveAttribute(
      "href",
      "/my-bets/01J9A7V0000000000000000001",
    );

    // A deposit's payment is not a link (only a withdrawal's is); its label
    // names it.
    const deposit = screen.getByText("Deposit · telebirr").closest("li")!;
    expect(within(deposit).queryByRole("link")).not.toBeInTheDocument();
    expect(deposit).toHaveTextContent("+ ETB 500.00");
    expect(deposit).toHaveTextContent("Balance ETB 1,019.78");
    expect(deposit).toHaveTextContent("16:58");
  });

  it("names every kind the contract has, and a movement with no label by its kind alone", async () => {
    const kinds = [
      ["withdrawal_released", "Withdrawal returned", true],
      ["refund", "Refund", true],
      ["adjustment", "Adjustment", true],
      ["withdrawal", "Withdrawal", true],
      // Which balance `balance_after` follows here the contract doesn't
      // say (a bonus grant posts only to the bonus account): no line.
      ["bonus", "Bonus", false],
      ["bonus_converted", "Bonus converted", false],
      // A kind the contract added after this build.
      ["other", "Other", false],
    ] as const;
    history(() =>
      page(
        kinds.map(([type], i) =>
          txn({
            id: `k${i}`,
            type,
            label: null,
            reference: null,
            balanceAfter: "1000.00",
          }),
        ),
      ),
    );
    render(<TransactionsList />);

    for (const [, name, balance] of kinds) {
      const row = (await screen.findByText(name)).closest("li")!;
      if (balance) {
        expect(row).toHaveTextContent("Balance ETB 1,000.00");
      } else {
        expect(row).not.toHaveTextContent("Balance");
      }
    }
  });

  it("asks for the contract's type when a filter is chosen (AC-6)", async () => {
    history(() => page([txn({ id: "t1" })]));
    render(<TransactionsList />);
    await screen.findByText("Deposit · telebirr");

    await userEvent.click(screen.getByRole("button", { name: "Deposits" }));
    await userEvent.click(screen.getByRole("button", { name: "Winnings" }));
    await userEvent.click(screen.getByRole("button", { name: "Bets" }));
    await userEvent.click(screen.getByRole("button", { name: "Withdrawals" }));

    await waitFor(() =>
      expect(asked).toEqual([
        "/api/wallet/transactions",
        "/api/wallet/transactions?type=deposit",
        "/api/wallet/transactions?type=win",
        "/api/wallet/transactions?type=bet",
        "/api/wallet/transactions?type=withdrawal",
      ]),
    );
    expect(screen.getByRole("button", { name: "Withdrawals" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("pages with next_cursor: Show more adds the next page under the same days, and goes on the last (AC-6)", async () => {
    history((query) =>
      query.get("cursor") === "c2"
        ? page([
            // Still Saturday the 3rd in Addis Ababa: joins that day.
            txn({
              id: "t2",
              createdAt: "2026-10-03T06:00:00Z",
              amount: "40.00",
            }),
          ])
        : page([txn({ id: "t1", createdAt: "2026-10-03T12:00:00Z" })], "c2"),
    );
    render(<TransactionsList />);

    await screen.findByText("Yesterday · 3 Oct");
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));

    const day = await screen.findByRole("group", {
      name: "Yesterday · 3 Oct",
    });
    await within(day).findByText("+ ETB 40.00", { exact: false });
    expect(within(day).getAllByRole("listitem")).toHaveLength(2);
    expect(headings()).toEqual(["Yesterday · 3 Oct"]);
    expect(asked).toEqual([
      "/api/wallet/transactions",
      "/api/wallet/transactions?cursor=c2",
    ]);
    // The last page: nothing more to ask for, and focus on what arrived.
    expect(
      screen.queryByRole("button", { name: "Show more" }),
    ).not.toBeInTheDocument();
    expect(within(day).getAllByRole("listitem")[1]).toHaveFocus();
  });

  it("says when there is nothing yet, and when a filter has nothing", async () => {
    history(() => page([]));
    render(<TransactionsList />);

    expect(
      await screen.findByRole("heading", { name: "No transactions yet" }),
    ).toBeInTheDocument();
    // The next thing to do: a first deposit.
    expect(screen.getByRole("link", { name: "Deposit" })).toHaveAttribute(
      "href",
      "/wallet?action=deposit",
    );
    await userEvent.click(screen.getByRole("button", { name: "Deposits" }));
    expect(
      await screen.findByRole("heading", { name: "Nothing here yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose All to see every movement."),
    ).toBeInTheDocument();
  });

  it("says when the history couldn't load, and Try again reads it again", async () => {
    let fails = true;
    history(() => (fails ? [503, UNAVAILABLE] : page([txn({ id: "t1" })])));
    render(<TransactionsList />);

    expect(
      await screen.findByRole("heading", {
        name: "Couldn’t load your transactions",
      }),
    ).toBeInTheDocument();
    fails = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Deposit · telebirr")).toBeInTheDocument();
  });

  it("says when the next page couldn't load, and offers to try again", async () => {
    history((query) =>
      query.get("cursor")
        ? [503, UNAVAILABLE]
        : page([txn({ id: "t1" })], "c2"),
    );
    render(<TransactionsList />);

    await screen.findByText("Deposit · telebirr");
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn’t load more transactions.");
    expect(
      within(alert).getByRole("button", { name: "Try again" }),
    ).toHaveFocus();
  });

  it("asks a guest to log in, and reads nothing", () => {
    history(() => page([]));
    render(<TransactionsList />, { session: "guest" });

    expect(
      screen.getByRole("heading", { name: "Log in to see your transactions" }),
    ).toBeInTheDocument();
    expect(asked).toEqual([]);
  });

  it("drops the previous player's history when the session changes, so the next player never sees it", async () => {
    let reads = 0;
    history(() => {
      reads += 1;
      // The first player's movement, then the next player's.
      const label =
        reads === 1 ? "first player's telebirr" : "next player's CBE Birr";
      return page([txn({ id: `t${reads}`, label })]);
    });
    const { queryClient } = render(
      <>
        <SessionWatcher />
        <TransactionsList />
      </>,
    );
    await screen.findByText("Deposit · first player's telebirr");

    // Someone else signs in (another tab): the first player's rows go and
    // the next player's history is read afresh.
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), {
        player: { ...CONTRACT_PLAYER, id: "p2", fullName: "Birtukan Tadesse" },
      });
    });
    expect(
      await screen.findByText("Deposit · next player's CBE Birr"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Deposit · first player's telebirr"),
    ).not.toBeInTheDocument();
    expect(reads).toBe(2);

    // A guest: nothing of anyone's history is kept.
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), { player: null });
    });
    await waitFor(() =>
      expect(
        queryClient.getQueryCache().findAll({ queryKey: transactionKeys.all }),
      ).toEqual([]),
    );
    expect(
      screen.getByRole("heading", { name: "Log in to see your transactions" }),
    ).toBeInTheDocument();
  });
});

describe("a withdrawal's row (F6c)", () => {
  it("opens a withdrawal from its row in the history, whether the money went out or came back", async () => {
    const id = "01J9A7Y0000000000000000001";
    history(() =>
      page([
        txn({
          id: "w2",
          type: "withdrawal_released",
          amount: "300.00",
          reference: { type: "payment", id },
        }),
        txn({
          id: "w1",
          type: "withdrawal",
          amount: "-300.00",
          reference: { type: "payment", id },
        }),
        txn({ id: "d1", type: "deposit" }),
      ]),
    );
    render(<TransactionsList />);

    const out = await screen.findByRole("link", {
      name: /Withdrawal · telebirr/,
    });
    expect(out).toHaveAttribute("href", `/wallet?withdrawal=${id}`);
    expect(
      screen.getByRole("link", { name: /Withdrawal returned · telebirr/ }),
    ).toHaveAttribute("href", `/wallet?withdrawal=${id}`);
    // A deposit's payment has no screen to open from here.
    const deposit = screen.getByText("Deposit · telebirr").closest("li")!;
    expect(within(deposit).queryByRole("link")).not.toBeInTheDocument();
  });
});
