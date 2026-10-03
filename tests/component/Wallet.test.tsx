import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BetSlip } from "@/features/bet-slip/components/BetSlip";
import {
  selectionFrom,
  useBetSlipStore,
} from "@/features/bet-slip/stores/bet-slip.store";
import { AmountStep } from "@/features/wallet/components/AmountStep";
import { WalletView } from "@/features/wallet/components/WalletView";
import type { WalletBalances } from "@/features/wallet/types";
import { toPaymentMethods } from "@/lib/api/mappers/payments";
import { toWalletBalances, toWalletTxnPage } from "@/lib/api/mappers/wallet";
import { useUiStore } from "@/stores/ui.store";
import { example } from "../contract";
import { render } from "./render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/wallet",
}));

/** What `/api/wallet` answers for Prism's player: the contract's example, mapped. */
const CONTRACT_WALLET = toWalletBalances(example("/v1/wallet"));

/** Every `/api/…` path and query asked for, in order. */
let asked: string[] = [];

const json = ([status, body]: [number, unknown]) =>
  Response.json(body, {
    status,
    headers: {
      "Content-Type":
        status >= 400 ? "application/problem+json" : "application/json",
    },
  });

/** The contract's history page, as `/api/wallet/transactions` answers it. */
const CONTRACT_HISTORY = (): [number, unknown] => [
  200,
  toWalletTxnPage(example("/v1/wallet/transactions")),
];

function api(
  wallet: () => [number, unknown],
  history: () => [number, unknown] = CONTRACT_HISTORY,
) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    asked.push(`${url.pathname}${url.search}`);
    if (url.pathname === "/api/wallet") return json(wallet());
    if (url.pathname === "/api/wallet/transactions") return json(history());
    throw new Error(`unexpected ${url}`);
  });
}

const answering = (balances: WalletBalances) => () =>
  [200, balances] as [number, unknown];

const UNAVAILABLE = {
  type: "about:blank",
  title: "The sportsbook API could not be reached",
  status: 503,
  code: "SERVICE_UNAVAILABLE",
};

/**
 * The breakdown under the balance: each line's amount, by its label (a `<dt>`;
 * the `term` role takes no name from its text, so it is found by that text).
 */
function line(label: string): string | null {
  const term = screen.queryByText(label, { selector: "dt" });
  const amount = term?.parentElement?.querySelector("dd")?.textContent;
  // Money keeps its currency on one line with a no-break space.
  return amount?.replace(/\s+/g, " ") ?? null;
}

beforeEach(() => {
  asked = [];
  useUiStore.setState({ lang: "en" });
});

afterEach(() => vi.restoreAllMocks());

describe("the wallet's balances (AC-5)", () => {
  it("shows the cash balance exactly as the API sends it, and the bonus apart (AC-5)", async () => {
    api(answering(CONTRACT_WALLET));
    render(<WalletView />);

    const cash = await screen.findByTestId("wallet-cash");
    expect(cash).toHaveTextContent("ETB 1,208.95");
    expect(line("Bonus")).toBe("ETB 50.00");
    expect(
      screen.getByText("For bets only — can’t be withdrawn"),
    ).toBeInTheDocument();
    // 0.00 locked and 0.00 owed: nothing to say.
    expect(line("Pending withdrawals")).toBeNull();
    expect(line("Owed")).toBeNull();
    expect(asked).toContain("/api/wallet");
  });

  it("shows pending withdrawals and the amount owed only when above zero (AC-5)", async () => {
    api(
      answering({
        cash: "0.00",
        bonus: "0.00",
        locked: "300.00",
        debt: "120.00",
        currency: "ETB",
      }),
    );
    render(<WalletView />);

    expect(await screen.findByTestId("wallet-cash")).toHaveTextContent(
      "ETB 0.00",
    );
    expect(line("Pending withdrawals")).toBe("ETB 300.00");
    expect(line("Owed")).toBe("ETB 120.00");
    expect(
      screen.getByText("Repaid first from your next deposits and wins"),
    ).toBeInTheDocument();
    expect(line("Bonus")).toBeNull();
  });

  it("shows no owed line when the API doesn't say, rather than zero", async () => {
    api(answering({ ...CONTRACT_WALLET, debt: null }));
    render(<WalletView />);

    await screen.findByTestId("wallet-cash");
    expect(line("Owed")).toBeNull();
  });

  it("asks a guest to log in, and reads nothing", () => {
    api(answering(CONTRACT_WALLET));
    render(<WalletView />, { session: "guest" });

    expect(
      screen.getByRole("heading", { name: "Log in to see your wallet" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(asked).not.toContain("/api/wallet");
  });

  it("says when the wallet couldn't load, and Try again reads it again", async () => {
    let fails = true;
    api(() => (fails ? [503, UNAVAILABLE] : [200, CONTRACT_WALLET]));
    render(<WalletView />);

    expect(
      await screen.findByRole("heading", { name: "Couldn’t load your wallet" }),
    ).toBeInTheDocument();
    fails = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByTestId("wallet-cash")).toHaveTextContent(
      "ETB 1,208.95",
    );
    expect(asked.filter((path) => path === "/api/wallet")).toHaveLength(2);
  });
});

describe("the wallet's recent activity (AC-6)", () => {
  it("lists the latest movements under Recent activity, with date and time", async () => {
    api(answering(CONTRACT_WALLET));
    render(<WalletView />);

    const recent = await screen.findByRole("region", {
      name: "Recent activity",
    });
    const rows = await within(recent).findAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Winnings · K7Q2-M9XP-M");
    // No day headings here, so each row says its date as well (EAT).
    expect(rows[0]).toHaveTextContent("05/10 · 00:02");
    expect(rows[2]).toHaveTextContent("Deposit · telebirr");
    expect(rows[2]).toHaveTextContent("03/10 · 16:58");
    // Its own small read, never the history's pages.
    expect(asked).toContain("/api/wallet/transactions?limit=5");
    expect(
      within(recent).getByRole("link", { name: "See all" }),
    ).toHaveAttribute("href", "/transactions");
  });

  it("says when there is no activity yet, and when it couldn't load", async () => {
    let answer: [number, unknown] = [200, { items: [], nextCursor: null }];
    api(answering(CONTRACT_WALLET), () => answer);
    const { unmount } = render(<WalletView />);

    expect(
      await screen.findByText("Nothing yet. Deposits and bets show up here."),
    ).toBeInTheDocument();
    unmount();

    answer = [503, UNAVAILABLE];
    render(<WalletView />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn’t load your recent activity.");
    answer = CONTRACT_HISTORY();
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );
    expect(
      await screen.findByText("Winnings · K7Q2-M9XP-M"),
    ).toBeInTheDocument();
  });
});

describe("the withdraw amount step's ceiling (AC-5)", () => {
  /** The contract's telebirr: withdrawals of 50.00 to 50,000.00. */
  const TELEBIRR = toPaymentMethods(example("/v1/payment-methods").items)[0];
  const step = (amount: string) =>
    render(
      <AmountStep
        mode="withdraw"
        method={TELEBIRR}
        available="1208.95"
        amount={amount}
        onAmountChange={() => undefined}
        onContinue={() => undefined}
      />,
    );

  it("compares the typed amount with the cash balance as strings", () => {
    const { unmount } = step("1208.95");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.getByText("ETB 1,208.95")).toBeInTheDocument();
    // The method's withdrawal limits, not its deposit ones.
    expect(screen.getByText("ETB 50.00 – ETB 50,000.00")).toBeInTheDocument();
    unmount();

    step("1208.96");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This is more than your withdrawable balance.",
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("says a number too long to be an amount is over the balance, rather than failing", () => {
    // 22 digits: as a float it would be "1e+22"; as a string it is an amount.
    step("9".repeat(22));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This is more than your withdrawable balance.",
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

describe("the slip's balance check (AC-5)", () => {
  beforeEach(() => {
    useBetSlipStore.getState().clear();
    useBetSlipStore.getState().toggleSelection(
      selectionFrom({
        outcomeId: "oc_m3_1",
        ref: { eventId: "m3", marketType: "1x2", line: null, outcomeCode: "1" },
        marketId: "m3:1x2:",
        eventName: { en: "Man City match", am: "Man City match" },
        marketName: { en: "Match result", am: "የጨዋታ ውጤት" },
        outcomeName: { en: "Man City", am: "Man City" },
        odds: "1.62",
      }),
    );
    useBetSlipStore.setState({ mode: "single", stake: "50" });
  });

  it("asks for a deposit when the stake is above the cash balance, bonus aside (AC-5)", async () => {
    api(answering({ ...CONTRACT_WALLET, cash: "40.00", bonus: "500.00" }));
    const { unmount } = render(<BetSlip />);

    // Nothing is decided until /api/wallet has answered: the slip shows the
    // cash balance as sent, and only then compares the stake with it.
    expect(await screen.findByText("Balance ETB 40.00")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Deposit to continue/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Place bet/ }),
    ).not.toBeInTheDocument();
    // The alert names the player's balance — the API's cash — not the stake.
    expect(screen.getByText("Insufficient balance")).toBeInTheDocument();
    expect(screen.getByText("Your balance is ETB 40.00.")).toBeInTheDocument();
    unmount();

    // At exactly the stake, the cash balance covers it.
    api(answering({ ...CONTRACT_WALLET, cash: "50.00", bonus: "0.00" }));
    render(<BetSlip />);
    expect(await screen.findByText("Balance ETB 50.00")).toBeInTheDocument();
    const place = screen.getByRole("button", { name: /Place bet/ });
    expect(within(place).getByText("ETB 50.00")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Deposit to continue/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Insufficient balance")).not.toBeInTheDocument();
  });
});
