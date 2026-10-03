import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BetSlip } from "@/features/bet-slip/components/BetSlip";
import {
  selectionFrom,
  useBetSlipStore,
} from "@/features/bet-slip/stores/bet-slip.store";
import { WalletView } from "@/features/wallet/components/WalletView";
import type { WalletBalances } from "@/features/wallet/types";
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

function api(wallet: () => [number, unknown]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    asked.push(`${url.pathname}${url.search}`);
    if (url.pathname === "/api/wallet") {
      const [status, body] = wallet();
      return Response.json(body, {
        status,
        headers: {
          "Content-Type":
            status >= 400 ? "application/problem+json" : "application/json",
        },
      });
    }
    if (url.pathname === "/api/wallet/transactions") {
      return Response.json(toWalletTxnPage(example("/v1/wallet/transactions")));
    }
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

    const deposit = await screen.findAllByRole("button", {
      name: /^Deposit to continue/,
    });
    expect(deposit.length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /Place bet/ }),
    ).not.toBeInTheDocument();
    unmount();

    // At exactly the stake, the cash balance covers it.
    api(answering({ ...CONTRACT_WALLET, cash: "50.00", bonus: "0.00" }));
    render(<BetSlip />);
    const place = await screen.findByRole("button", { name: /Place bet/ });
    expect(within(place).getByText("ETB 50.00")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Deposit to continue/ }),
    ).not.toBeInTheDocument();
  });
});
