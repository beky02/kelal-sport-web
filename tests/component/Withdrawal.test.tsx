import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { PaymentNotice } from "@/features/wallet/components/PaymentNotice";
import { SessionWatcher } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import type { Player } from "@/features/auth/types";
import { WalletView } from "@/features/wallet/components/WalletView";
import { useWallet } from "@/features/wallet/hooks/use-wallet";
import { resetWithdrawalStore } from "@/features/wallet/stores/withdrawal.store";
import type { Withdrawal } from "@/features/wallet/types";
import { useTranslation } from "@/lib/i18n/use-translation";
import { toPaymentMethods } from "@/lib/api/mappers/payments";
import {
  toPayoutAccount,
  toPayoutAccounts,
  toWithdrawal,
} from "@/lib/api/mappers/withdrawals";
import { toWalletBalances } from "@/lib/api/mappers/wallet";
import type { components } from "@/lib/api/schema";
import { paymentKeys, sessionKeys } from "@/lib/query/keys";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { useUiStore } from "@/stores/ui.store";
import { example, responseExample } from "../contract";
import { CONTRACT_PLAYER, render } from "./render";

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();
/** The wallet's address: `?action=withdraw` unless a test opens a withdrawal's own. */
let search = new URLSearchParams("action=withdraw");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back, refresh: vi.fn() }),
  useSearchParams: () => search,
  usePathname: () => "/wallet",
}));

type ApiWithdrawal = components["schemas"]["Withdrawal"];
type ApiAccount = components["schemas"]["PayoutAccount"];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** What `/api/payment-methods` answers: telebirr and CBE Birr pay out, Chapa doesn't. */
const METHODS = toPaymentMethods(example("/v1/payment-methods").items);
/** The player's saved telebirr account: `+2519••••567`, Abebe Kebede, verified. */
const ACCOUNTS = toPayoutAccounts(example("/v1/me/payout-accounts").items);
const SAVED = ACCOUNTS[0];
/** The account the API adds for a new number (its masked form). */
const ADDED = {
  ...toPayoutAccount(
    responseExample("/v1/me/payout-accounts", "post", 201) as ApiAccount,
  ),
  accountMasked: "+2519••••890",
};

/** The contract's processing withdrawal, for the 500.00 the flow asks by default. */
const PROCESSING: Withdrawal = {
  ...toWithdrawal(
    responseExample(
      "/v1/withdrawals",
      "post",
      201,
      "processing",
    ) as ApiWithdrawal,
  ),
  amount: "500.00",
};
const REVIEW = toWithdrawal(
  responseExample("/v1/withdrawals", "post", 201, "review") as ApiWithdrawal,
);
const PAID = toWithdrawal(example("/v1/withdrawals/{id}"));
const as = (status: Withdrawal["status"], changes: Partial<Withdrawal> = {}) =>
  ({
    ...PROCESSING,
    amount: "2000.00",
    status,
    ...changes,
  }) satisfies Withdrawal;
const REQUESTED = as("requested");
const CANCELLED = as("cancelled");

const CONTRACT_WALLET = toWalletBalances(example("/v1/wallet"));

/** Someone else, signing in on the same phone. */
const OTHER_PLAYER: Player = {
  ...CONTRACT_PLAYER,
  id: "01J9A7R0000000000000000099",
};

const problem = (
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
) => ({
  type: "about:blank",
  title: `The API's title for ${code}`,
  status,
  code,
  ...extra,
});

/** One answer to a request: now, never (dropped or timed out), or later (a promise). */
type Answer =
  [number, unknown] | "drop" | "timeout" | Promise<[number, unknown]>;

interface Posted {
  key: string | null;
  body: unknown;
  signal: AbortSignal | null;
}

/** Every `METHOD /api/…` asked for, in order. */
let asked: string[] = [];
/** Every POST to `/api/withdrawals` — the request log. */
let posted: Posted[] = [];
/** The answers to `POST /api/withdrawals`, one per attempt, in order. */
let requests: Answer[] = [];
/** Every DELETE to `/api/withdrawals/{id}`: the id and its headers. */
let cancelled: { id: string; headers: Headers }[] = [];
let cancels: Answer[] = [];
/** Every account added, and removed. */
let added: unknown[] = [];
let removed: string[] = [];
let addAnswer: () => Answer = () => [201, ADDED];
/** Whether each save of an account gave up after a while, as the others do. */
let addSignals: (AbortSignal | null)[] = [];
let removeAnswer: () => [number, unknown] = () => [204, null];
let accounts: () => Answer = () => [200, ACCOUNTS];
let reads: (id: string) => Answer = () => [200, PROCESSING];
let methods: () => [number, unknown] = () => [200, METHODS];
let wallet: () => [number, unknown] = () => [200, CONTRACT_WALLET];
/** Who `/api/me` says is signed in when it is read again. */
let signedIn: Player | null = CONTRACT_PLAYER;

const answered = async (answer: Answer) => {
  if (answer === "drop") throw new TypeError("Failed to fetch");
  // What fetch throws when AbortSignal.timeout gives up.
  if (answer === "timeout") {
    throw new DOMException("signal timed out", "TimeoutError");
  }
  return answer;
};

function api() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    asked.push(`${method} ${url.pathname}${url.search}`);
    const reply = ([status, body]: [number, unknown]) =>
      status === 204
        ? new Response(null, { status })
        : Response.json(body, {
            status,
            headers: {
              "Content-Type":
                status >= 400 ? "application/problem+json" : "application/json",
            },
          });
    switch (url.pathname) {
      case "/api/me":
        return reply([200, { player: signedIn }]);
      case "/api/wallet":
        return reply(wallet());
      case "/api/wallet/transactions":
        return reply([200, { items: [], nextCursor: null }]);
      // The wallet's deposit-limit card (F7a): none set.
      case "/api/me/limits":
        return reply([200, []]);
      case "/api/payment-methods":
        return reply(methods());
      case "/api/payout-accounts":
        if (method === "POST") {
          added.push(JSON.parse(String(init?.body)));
          addSignals.push(init?.signal ?? null);
          return reply(await answered(addAnswer()));
        }
        return reply(await answered(accounts()));
      case "/api/withdrawals": {
        const headers = new Headers(init?.headers);
        posted.push({
          key: headers.get("Idempotency-Key"),
          body: JSON.parse(String(init?.body)),
          signal: init?.signal ?? null,
        });
        return reply(await answered(requests.shift() ?? [500, {}]));
      }
    }
    const account = /^\/api\/payout-accounts\/(.+)$/.exec(url.pathname)?.[1];
    if (account) {
      removed.push(decodeURIComponent(account));
      return reply(removeAnswer());
    }
    const id = /^\/api\/withdrawals\/(.+)$/.exec(url.pathname)?.[1];
    if (id && method === "DELETE") {
      cancelled.push({
        id: decodeURIComponent(id),
        headers: new Headers(init?.headers),
      });
      return reply(await answered(cancels.shift() ?? [500, {}]));
    }
    if (id) return reply(await answered(reads(decodeURIComponent(id))));
    throw new Error(`unexpected ${method} ${url}`);
  });
}

const user = userEvent.setup();
const count = (call: string) => asked.filter((a) => a === call).length;

/** Picks a method and goes on to its account step. */
async function toAccount(method: RegExp) {
  await user.click(await screen.findByRole("button", { name: method }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

/** On to the confirm step with telebirr's saved account, typing an amount on the way if given. */
async function toConfirm(amount?: string) {
  await toAccount(/telebirr/);
  await user.click(await screen.findByRole("radio", { name: /\+2519••••567/ }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  if (amount !== undefined) {
    const input = screen.getByLabelText("Amount");
    await user.clear(input);
    await user.type(input, amount);
  }
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

const confirmWithdrawal = () =>
  user.click(screen.getByRole("button", { name: "Confirm withdrawal" }));

const tryAgain = (amount = "500\\.00") =>
  screen.getByRole("button", {
    name: new RegExp(`^Try again · ETB\\s${amount}$`),
  });

/** The withdrawal's rows under its status: each value by its label. */
function row(label: string): string | null {
  const term = screen.queryByText(label, { selector: "dt" });
  return (
    term?.parentElement
      ?.querySelector("dd")
      ?.textContent?.replace(/\s+/g, " ") ?? null
  );
}

/** The balance as the header chip shows it: the wallet query, nothing else. */
function BalanceChip() {
  const t = useTranslation();
  const balance = useWallet(true).data;
  return (
    <span data-testid="chip">{balance ? t.money(balance.cash) : "…"}</span>
  );
}

/** The wallet, or another page: what the player sees after leaving it. */
function Page({ wallet: showWallet }: { wallet: boolean }) {
  return (
    <>
      <BalanceChip />
      {showWallet ? <WalletView /> : <p>Sports</p>}
    </>
  );
}

beforeEach(() => {
  asked = [];
  posted = [];
  requests = [];
  cancelled = [];
  cancels = [];
  added = [];
  removed = [];
  addAnswer = () => [201, ADDED];
  addSignals = [];
  removeAnswer = () => [204, null];
  accounts = () => [200, ACCOUNTS];
  reads = () => [200, PROCESSING];
  methods = () => [200, METHODS];
  wallet = () => [200, CONTRACT_WALLET];
  signedIn = CONTRACT_PLAYER;
  search = new URLSearchParams("action=withdraw");
  push.mockReset();
  replace.mockReset();
  back.mockReset();
  // A fresh page: no withdrawal on its way or unanswered.
  resetWithdrawalStore();
  useUiStore.setState({ lang: "en" });
  useAuthStore.setState({ entry: null });
});

afterEach(() => vi.restoreAllMocks());

describe("payout accounts (AC-10)", () => {
  it("lists the player's saved accounts for the chosen method (AC-10)", async () => {
    api();
    render(<WalletView />);
    // Only methods that pay out: Chapa has no withdrawal range.
    expect(
      await screen.findByRole("button", { name: /telebirr/ }),
    ).toHaveTextContent("ETB 50.00 – ETB 50,000.00");
    expect(
      screen.queryByRole("button", { name: /Chapa/ }),
    ).not.toBeInTheDocument();
    await toAccount(/telebirr/);

    expect(
      await screen.findByRole("heading", {
        name: "Send to which telebirr account?",
      }),
    ).toBeInTheDocument();
    const saved = await screen.findByRole("radio", { name: /\+2519••••567/ });
    expect(saved.closest("label")).toHaveTextContent("Abebe Kebede");
    expect(saved.closest("label")).toHaveTextContent("Verified");
    expect(
      screen.getByRole("radio", { name: "Another number" }),
    ).toBeInTheDocument();
    // A group named by the question: its Remove buttons are no radios (Q5).
    expect(
      screen.getByRole("group", { name: "Send to which telebirr account?" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    // Continue waits for a choice.
    const next = () => screen.getByRole("button", { name: "Continue" });
    expect(next()).toBeDisabled();
    await user.click(saved);
    expect(next()).toBeEnabled();

    // Nothing saved for CBE Birr: the number is the way on.
    await user.click(screen.getByRole("button", { name: "Back" }));
    await toAccount(/CBE Birr/);
    expect(
      await screen.findByRole("heading", {
        name: "Send to which CBE Birr account?",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByLabelText("CBE Birr number")).toBeInTheDocument();
    expect(count("GET /api/payout-accounts")).toBe(1);
  });

  it("adds a number through /api/payout-accounts and chooses it (AC-10)", async () => {
    let saved = false;
    accounts = () => [200, saved ? [...ACCOUNTS, ADDED] : ACCOUNTS];
    addAnswer = () => {
      saved = true;
      return [201, ADDED];
    };
    api();
    render(<WalletView />);
    await toAccount(/telebirr/);
    await user.click(
      await screen.findByRole("radio", { name: "Another number" }),
    );
    const number = screen.getByLabelText("telebirr number");
    await user.type(number, "922334890");
    // The only place the player learns the number is kept: read with the field (Q5).
    expect(number).toHaveAccessibleDescription(
      "We’ll keep it for your next withdrawals.",
    );
    await user.click(screen.getByRole("button", { name: "Save number" }));

    // Saved, listed and chosen: the API's own answer — and the keyboard is
    // on it, not lost with the field that went away (Q2).
    const fresh = await screen.findByRole("radio", { name: /\+2519••••890/ });
    await waitFor(() => expect(fresh).toBeChecked());
    await waitFor(() => expect(fresh).toHaveFocus());
    expect(added).toEqual([{ provider: "telebirr", account: "+251922334890" }]);
    // It gives up after a while, as every payment call does.
    expect(addSignals[0]).toBeInstanceOf(AbortSignal);
    // The list is read again for everything else.
    await waitFor(() => expect(count("GET /api/payout-accounts")).toBe(2));

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("To +2519••••890")).toBeInTheDocument();
  });

  it("says why a number couldn't be saved, in the API's words, and lets the player fix it", async () => {
    addAnswer = () => [
      409,
      problem(409, "VALIDATION_FAILED", {
        title: "This account is already saved",
      }),
    ];
    api();
    render(<WalletView />);
    await toAccount(/telebirr/);
    await user.click(
      await screen.findByRole("radio", { name: "Another number" }),
    );
    const number = screen.getByLabelText("telebirr number");
    // Not a mobile number: said once the player leaves the field, never sent.
    await user.type(number, "12345");
    await user.tab();
    expect(
      screen.getByText("Enter a 9-digit Ethiopian mobile number."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save number" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await user.clear(number);
    await user.type(number, "911234567");
    await user.click(screen.getByRole("button", { name: "Save number" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn’t save this number.");
    expect(alert).toHaveTextContent("This account is already saved");
    // The list is read again: it may be there already.
    await waitFor(() => expect(count("GET /api/payout-accounts")).toBe(2));
    // A number the API didn't save can still be withdrawn to: it is sent as one.
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("removes a saved account through /api/payout-accounts/{id} once the player confirms (AC-10)", async () => {
    let gone = false;
    accounts = () => [200, gone ? [] : ACCOUNTS];
    removeAnswer = () => {
      gone = true;
      return [204, null];
    };
    api();
    render(<WalletView />);
    await toAccount(/telebirr/);
    await user.click(
      await screen.findByRole("radio", { name: /\+2519••••567/ }),
    );

    const remove = () =>
      screen.getByRole("button", { name: "Remove +2519••••567" });
    await user.click(remove());
    const question = screen.getByRole("group", {
      name: "Remove +2519••••567?",
    });
    // Keeping it is the safe answer: focus is there, and it sends nothing.
    const keep = within(question).getByRole("button", { name: "Keep" });
    expect(keep).toHaveFocus();
    await user.click(keep);
    expect(removed).toEqual([]);
    expect(remove()).toHaveFocus();

    await user.click(remove());
    await user.click(
      within(
        screen.getByRole("group", { name: "Remove +2519••••567?" }),
      ).getByRole("button", { name: "Remove" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("radio", { name: /\+2519••••567/ }),
      ).not.toBeInTheDocument(),
    );
    expect(removed).toEqual([SAVED.id]);
    await waitFor(() => expect(count("GET /api/payout-accounts")).toBe(2));
    // Nothing saved now, and nothing chosen: the number is the way on.
    expect(screen.getByLabelText("telebirr number")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("says when the saved accounts couldn't load, and still takes a new number", async () => {
    let failing = true;
    accounts = () =>
      failing ? [503, problem(503, "SERVICE_UNAVAILABLE")] : [200, ACCOUNTS];
    api();
    render(<WalletView />);
    await toAccount(/telebirr/);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn’t load your saved accounts.");
    await user.type(screen.getByLabelText("telebirr number"), "911234567");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();

    failing = false;
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("radio", { name: /\+2519••••567/ }),
    ).toBeInTheDocument();
  });
});

describe("withdrawing (AC-10)", () => {
  it("withdraws to a saved account by its id (AC-10)", async () => {
    requests = [[201, { ...PROCESSING, amount: "1000.00" }]];
    api();
    render(<WalletView />);
    await toConfirm("1000");

    // The confirm step: the account, the amount, nothing the API doesn't send.
    expect(
      screen.getByRole("heading", { name: "Check and confirm" }),
    ).toBeInTheDocument();
    expect(screen.getByText("+2519••••567")).toBeInTheDocument();
    expect(screen.getAllByText("ETB 1,000.00")).toHaveLength(2);
    expect(screen.getByText("You withdraw")).toBeInTheDocument();
    expect(screen.queryByText("Fee")).not.toBeInTheDocument();
    expect(screen.queryByText("You receive")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "We’ll check your request, then send it to +2519••••567. You can cancel while it’s being checked.",
      ),
    ).toBeInTheDocument();
    await confirmWithdrawal();

    expect(
      await screen.findByRole("heading", { name: "Sending your money" }),
    ).toBeInTheDocument();
    // The status screen is the withdrawal's, as from the history (U2).
    expect(
      screen.getByText("Withdrawal", { selector: "div" }),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(1);
    expect(posted[0].key).toMatch(UUID);
    expect(posted[0].body).toEqual({
      method: "telebirr",
      amount: "1000.00",
      to: { kind: "saved", payoutAccountId: SAVED.id },
    });
  });

  it("withdraws to a new number, sent as account, and reads the accounts again (AC-10)", async () => {
    requests = [[201, { ...PROCESSING, method: "cbebirr" }]];
    api();
    render(<WalletView />);
    await toAccount(/CBE Birr/);
    await user.type(
      await screen.findByLabelText("CBE Birr number"),
      "0911234567",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("To +251 911 234 567")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // The new number in full, so a typo is caught before money goes to it.
    expect(screen.getByText("+251 911 234 567")).toBeInTheDocument();
    await confirmWithdrawal();

    await screen.findByRole("heading", { name: "Sending your money" });
    expect(posted[0].body).toEqual({
      method: "cbebirr",
      amount: "500.00",
      to: { kind: "new", account: "+251911234567" },
    });
    // Not saved apart: the API saves it, so the list is out of date — read
    // again the next time it is shown, however fresh it was.
    expect(added).toEqual([]);
    expect(count("GET /api/payout-accounts")).toBe(1);
    await user.click(screen.getByRole("button", { name: "Back to wallet" }));
    await user.click(await screen.findByRole("button", { name: "Withdraw" }));
    await toAccount(/CBE Birr/);
    await waitFor(() => expect(count("GET /api/payout-accounts")).toBe(2));
  });
});

describe("where a withdrawal stands (AC-1)", () => {
  const STATES: [
    Withdrawal["status"],
    Withdrawal,
    string,
    string,
    string[],
    string[],
  ][] = [
    [
      "requested",
      REQUESTED,
      "Requested",
      "Withdrawal requested",
      [
        "We’re checking your request before sending your withdrawal to +2519••••567. You can cancel it while it’s being checked.",
      ],
      ["Back to wallet", "Cancel withdrawal"],
    ],
    [
      "review",
      REVIEW,
      "In review",
      "Being reviewed",
      [
        "We’re reviewing this withdrawal before paying it.",
        "We review every player’s first withdrawal.",
        "You can cancel it while it’s being reviewed.",
      ],
      ["Back to wallet", "Cancel withdrawal"],
    ],
    [
      "approved",
      as("approved"),
      "Approved",
      "Withdrawal approved",
      ["It’s approved and will be sent to +2519••••567."],
      ["Back to wallet"],
    ],
    [
      "processing",
      as("processing"),
      "Processing",
      "Sending your money",
      // Never how much arrives: withholding tax may apply (M1).
      ["Your withdrawal is being sent to +2519••••567."],
      ["Back to wallet"],
    ],
    [
      "paid",
      PAID,
      "Paid",
      "Withdrawal paid",
      ["Your withdrawal was paid to +2519••••567."],
      ["Done", "Back to sports"],
    ],
    [
      "failed",
      as("failed"),
      "Failed",
      "Withdrawal didn’t go through",
      [
        "It couldn’t be paid to +2519••••567, so ETB 2,000.00 is back in your balance.",
      ],
      ["Try again", "Choose another method", "Back to wallet"],
    ],
    [
      "rejected",
      as("rejected", {
        rejectionReason: "The account name does not match yours.",
      }),
      "Rejected",
      "Withdrawal rejected",
      [
        "ETB 2,000.00 is back in your balance.",
        "The account name does not match yours.",
      ],
      ["Back to wallet"],
    ],
    [
      "cancelled",
      CANCELLED,
      "Cancelled",
      "Withdrawal cancelled",
      ["ETB 2,000.00 is back in your balance."],
      ["Back to wallet"],
    ],
  ];

  it.each(STATES)(
    "shows each withdrawal status in words, with what to do next (AC-1): %s",
    async (_, withdrawal, badge, title, lines, actions) => {
      search = new URLSearchParams(`withdrawal=${withdrawal.id}`);
      reads = () => [200, withdrawal];
      api();
      render(<WalletView />);

      const heading = await screen.findByRole("heading", { name: title });
      // Focus lands on the outcome, so it is what a screen reader says.
      await waitFor(() => expect(heading).toHaveFocus());
      const status = screen.getByRole("status");
      expect(within(status).getByText(badge)).toBeInTheDocument();
      for (const line of lines) {
        expect(within(status).getByText(line)).toBeInTheDocument();
      }
      expect(row("Method")).toBe("telebirr");
      expect(row("Account")).toBe("+2519••••567");
      expect(row("Amount")).toBe(
        withdrawal.amount === "2000.00" ? "ETB 2,000.00" : "ETB 20,000.00",
      );
      expect(row("Reference")).toBe(withdrawal.id);
      for (const name of actions) {
        expect(screen.getByRole("button", { name })).toBeInTheDocument();
      }
      // Cancel only while the contract allows it (AC-10).
      expect(
        screen.queryByRole("button", { name: "Cancel withdrawal" }) !== null,
      ).toBe(actions.includes("Cancel withdrawal"));
    },
  );

  it("never shows a review reason it has no words for", async () => {
    const held = { ...REVIEW, reviewReason: "LOW_PLAY_CASHOUT" };
    search = new URLSearchParams(`withdrawal=${held.id}`);
    reads = () => [200, held];
    api();
    render(<WalletView />);

    await screen.findByRole("heading", { name: "Being reviewed" });
    expect(screen.queryByText(/LOW_PLAY_CASHOUT/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("We review every player’s first withdrawal."),
    ).not.toBeInTheDocument();
  });

  it("opens the withdrawal the address names, and leaving it takes it out of the address", async () => {
    reads = () => [200, PAID];
    search = new URLSearchParams(`withdrawal=${PAID.id}`);
    api();
    const { queryClient, rerender } = render(<WalletView />);

    expect(
      await screen.findByRole("heading", { name: "Withdrawal paid" }),
    ).toBeInTheDocument();
    // The status screen's own title, wherever it was reached from (U2).
    expect(
      screen.getByText("Withdrawal", { selector: "div" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));
    // Opened on this address (a link, a reload): replaced in place (Q1).
    expect(replace).toHaveBeenCalledWith("/wallet");
    expect(back).not.toHaveBeenCalled();

    search = new URLSearchParams("");
    rerender(
      <QueryClientProvider client={queryClient}>
        <WalletView />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("button", { name: "Withdraw" }),
    ).toBeInTheDocument();
  });

  it("follows the address both ways: a withdrawal the wallet opened closes on Back (Q1)", async () => {
    reads = () => [200, PAID];
    search = new URLSearchParams("");
    api();
    const { queryClient, rerender } = render(<WalletView />);
    const navigated = (to: string) => {
      search = new URLSearchParams(to);
      rerender(
        <QueryClientProvider client={queryClient}>
          <WalletView />
        </QueryClientProvider>,
      );
    };
    await screen.findByRole("button", { name: "Withdraw" });

    // A row in the wallet's recent activity puts it in the address…
    navigated(`withdrawal=${PAID.id}`);
    expect(
      await screen.findByRole("heading", { name: "Withdrawal paid" }),
    ).toBeInTheDocument();
    // …and the browser's Back takes it out: the wallet follows the address.
    navigated("");
    expect(
      await screen.findByRole("button", { name: "Withdraw" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Withdrawal paid" }),
    ).not.toBeInTheDocument();

    // Opened from the wallet again, its own Done is that Back: history
    // never holds the wallet twice.
    navigated(`withdrawal=${PAID.id}`);
    await user.click(await screen.findByRole("button", { name: "Done" }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends nothing for an address that can't name a withdrawal, and says it isn't there (SEC1)", async () => {
    for (const id of ["..", ".", "a b"]) {
      vi.restoreAllMocks();
      asked = [];
      search = new URLSearchParams();
      search.set("withdrawal", id);
      api();
      const { unmount } = render(<WalletView />);

      expect(
        await screen.findByRole("heading", {
          name: "We couldn’t find this withdrawal",
        }),
      ).toBeInTheDocument();
      expect(
        asked.filter(
          (call) =>
            call === "GET /api/" || call.startsWith("GET /api/withdrawals"),
        ),
        id,
      ).toEqual([]);
      unmount();
    }
  });

  it("says when the withdrawal the address names isn't the player's", async () => {
    reads = () => [404, problem(404, "NOT_FOUND", { title: "Not found" })];
    search = new URLSearchParams("withdrawal=01J9A7Y0000000000000000009");
    api();
    render(<WalletView />);

    expect(
      await screen.findByRole("heading", {
        name: "We couldn’t find this withdrawal",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("It isn’t on your account.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to wallet" }),
    ).toBeInTheDocument();
  });

  it("says when a withdrawal couldn't be checked, and Try again reads it", async () => {
    let failing = true;
    reads = () =>
      failing ? [503, problem(503, "SERVICE_UNAVAILABLE")] : [200, REQUESTED];
    search = new URLSearchParams(`withdrawal=${REQUESTED.id}`);
    api();
    render(<WalletView />);

    expect(
      await screen.findByRole("heading", {
        name: "Couldn’t check this withdrawal",
      }),
    ).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Withdrawal requested" }),
    ).toBeInTheDocument();
  });
});

describe("cancelling (AC-10)", () => {
  it("offers Cancel only while requested or in review, and cancels through DELETE /api/withdrawals/{id} (AC-10)", async () => {
    search = new URLSearchParams(`withdrawal=${REQUESTED.id}`);
    reads = () => [200, REQUESTED];
    cancels = [[200, CANCELLED]];
    api();
    render(<WalletView />);

    await user.click(
      await screen.findByRole("button", { name: "Cancel withdrawal" }),
    );

    const heading = await screen.findByRole("heading", {
      name: "Withdrawal cancelled",
    });
    // The button went with the answer: the keyboard is on what it says now (Q2).
    await waitFor(() => expect(heading).toHaveFocus());
    expect(cancelled.map((c) => c.id)).toEqual([REQUESTED.id]);
    // This site's own page asked, and a cancel is no new intent: no key.
    expect(cancelled[0].headers.get(CSRF_HEADER)).toBe(CSRF_VALUE);
    expect(cancelled[0].headers.get("Idempotency-Key")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Cancel withdrawal" }),
    ).not.toBeInTheDocument();
  });

  it("reads the status again when the API says it can no longer be cancelled (AC-10)", async () => {
    let paidOut = false;
    reads = () => [200, paidOut ? as("processing") : REQUESTED];
    cancels = [[409, problem(409, "PAY_WITHDRAWAL_NOT_CANCELLABLE")]];
    search = new URLSearchParams(`withdrawal=${REQUESTED.id}`);
    api();
    render(<WalletView />);
    await screen.findByRole("heading", { name: "Withdrawal requested" });
    // It moved on before the player pressed Cancel.
    paidOut = true;

    await user.click(screen.getByRole("button", { name: "Cancel withdrawal" }));

    const heading = await screen.findByRole("heading", {
      name: "Sending your money",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Too late to cancel");
    // Over the status it points to: "here's where it stands" (U3).
    expect(
      alert.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(alert).toHaveTextContent(
      "This withdrawal can no longer be cancelled. Here’s where it stands.",
    );
    expect(count(`GET /api/withdrawals/${REQUESTED.id}`)).toBe(2);
    expect(
      screen.queryByRole("button", { name: "Cancel withdrawal" }),
    ).not.toBeInTheDocument();
  });

  it("says it couldn't confirm a cancel that had no answer, and Try again cancels", async () => {
    reads = () => [200, REQUESTED];
    cancels = ["drop", [200, CANCELLED]];
    search = new URLSearchParams(`withdrawal=${REQUESTED.id}`);
    api();
    render(<WalletView />);

    await user.click(
      await screen.findByRole("button", { name: "Cancel withdrawal" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn’t confirm the cancel");
    // Where it stands is read again; the way on is Try again.
    await waitFor(() =>
      expect(count(`GET /api/withdrawals/${REQUESTED.id}`)).toBe(2),
    );
    expect(
      screen.queryByRole("button", { name: "Cancel withdrawal" }),
    ).not.toBeInTheDocument();
    // The keyboard is on the way on, not lost with the Cancel button (Q2).
    const retry = within(alert).getByRole("button", { name: "Try again" });
    await waitFor(() => expect(retry).toHaveFocus());
    await user.click(retry);

    const heading = await screen.findByRole("heading", {
      name: "Withdrawal cancelled",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(cancelled).toHaveLength(2);
  });
});

describe("the balance (AC-4)", () => {
  it("changes no balance until the server answers the withdrawal (AC-4)", async () => {
    let accepted = false;
    // The API's balance after the request — a bet settled meanwhile, so it
    // is not 708.95: the screen shows the API's figure.
    wallet = () => [
      200,
      accepted
        ? { ...CONTRACT_WALLET, cash: "650.00", locked: "500.00" }
        : CONTRACT_WALLET,
    ];
    let answer!: (value: [number, unknown]) => void;
    requests = [new Promise((resolve) => (answer = resolve))];
    api();
    render(<Page wallet />);
    await waitFor(() =>
      expect(screen.getByTestId("chip")).toHaveTextContent("ETB 1,208.95"),
    );
    await toConfirm();
    await confirmWithdrawal();

    // On its way: it says so, the balance stays, nothing is read again.
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(
      screen.getByRole("button", { name: "Confirm withdrawal" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("chip")).toHaveTextContent("ETB 1,208.95");
    expect(count("GET /api/wallet")).toBe(1);

    accepted = true;
    await act(async () => answer([201, PROCESSING]));
    await screen.findByRole("heading", { name: "Sending your money" });
    await waitFor(() =>
      expect(screen.getByTestId("chip")).toHaveTextContent("ETB 650.00"),
    );
    expect(count("GET /api/wallet")).toBe(2);
    expect(count("GET /api/wallet/transactions?limit=5")).toBe(2);
    expect(screen.queryByText(/708\.95/)).not.toBeInTheDocument();
  });

  it("changes no balance until the server answers the cancel (AC-4)", async () => {
    let back = false;
    wallet = () => [
      200,
      // The API's balance once the 2,000.00 is back — a bet was placed
      // meanwhile, so it is not 3,208.95: the screen shows the API's figure.
      back ? { ...CONTRACT_WALLET, cash: "3100.00" } : CONTRACT_WALLET,
    ];
    let answer!: (value: [number, unknown]) => void;
    cancels = [new Promise((resolve) => (answer = resolve))];
    reads = () => [200, REQUESTED];
    search = new URLSearchParams(`withdrawal=${REQUESTED.id}`);
    api();
    render(<Page wallet />);
    await screen.findByRole("heading", { name: "Withdrawal requested" });
    await waitFor(() =>
      expect(screen.getByTestId("chip")).toHaveTextContent("ETB 1,208.95"),
    );

    await user.click(screen.getByRole("button", { name: "Cancel withdrawal" }));
    await waitFor(() => expect(cancelled).toHaveLength(1));
    expect(
      screen.getByRole("button", { name: "Cancel withdrawal" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("chip")).toHaveTextContent("ETB 1,208.95");
    expect(count("GET /api/wallet")).toBe(1);

    back = true;
    await act(async () => answer([200, CANCELLED]));
    await screen.findByRole("heading", { name: "Withdrawal cancelled" });
    await waitFor(() =>
      expect(screen.getByTestId("chip")).toHaveTextContent("ETB 3,100.00"),
    );
    expect(count("GET /api/wallet")).toBe(2);
    expect(count("GET /api/wallet/transactions?limit=5")).toBe(2);
    expect(screen.queryByText(/3,208\.95/)).not.toBeInTheDocument();
  });
});

describe("one Idempotency-Key per withdrawal (AC-8)", () => {
  it("sends the same Idempotency-Key on Try again after no answer, and a new one after an answer (AC-8)", async () => {
    requests = [
      "drop",
      "timeout",
      [502, problem(502, "PAY_PROVIDER_ERROR")],
      [201, PROCESSING],
      [201, PROCESSING],
    ];
    api();
    render(<WalletView />);
    await toConfirm();

    await confirmWithdrawal();
    expect(
      await screen.findByText("We couldn’t confirm your withdrawal"),
    ).toBeInTheDocument();
    // The only way on is that very withdrawal again: Try again, with its amount.
    expect(
      screen.queryByRole("button", { name: "Confirm withdrawal" }),
    ).not.toBeInTheDocument();
    await user.click(tryAgain());
    // The 30 s ran out, then a 502: still unanswered, still the same intent.
    await waitFor(() => expect(posted).toHaveLength(2));
    await user.click(await screen.findByRole("button", { name: /^Try again/ }));
    await waitFor(() => expect(posted).toHaveLength(3));
    await user.click(await screen.findByRole("button", { name: /^Try again/ }));

    expect(
      await screen.findByRole("heading", { name: "Sending your money" }),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(4);
    expect(posted[0].key).toMatch(UUID);
    expect(posted.map((p) => p.key)).toEqual(Array(4).fill(posted[0].key));
    expect(posted.map((p) => p.body)).toEqual(
      Array(4).fill({
        method: "telebirr",
        amount: "500.00",
        to: { kind: "saved", payoutAccountId: SAVED.id },
      }),
    );
    expect(posted.every((p) => p.signal instanceof AbortSignal)).toBe(true);
    // Each Try again asked who is signed in first.
    expect(count("GET /api/me")).toBe(3);

    // A new withdrawal is a new intent: a new key.
    await user.click(screen.getByRole("button", { name: "Back to wallet" }));
    await user.click(await screen.findByRole("button", { name: "Withdraw" }));
    await toConfirm();
    await confirmWithdrawal();
    await screen.findByRole("heading", { name: "Sending your money" });
    expect(posted).toHaveLength(5);
    expect(posted[4].key).toMatch(UUID);
    expect(posted[4].key).not.toBe(posted[0].key);
  });

  it("makes a new key when the account or the amount changes after no answer (AC-8)", async () => {
    requests = ["drop", "drop", [201, PROCESSING]];
    api();
    render(<WalletView />);
    await toConfirm();
    await confirmWithdrawal();
    await screen.findByText("We couldn’t confirm your withdrawal");

    // Another account is another withdrawal: no Try again for it.
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("radio", { name: "Another number" }));
    await user.type(screen.getByLabelText("telebirr number"), "911234567");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.queryByText("We couldn’t confirm your withdrawal"),
    ).not.toBeInTheDocument();
    await confirmWithdrawal();
    await screen.findByText("We couldn’t confirm your withdrawal");

    // …and so is another amount.
    await user.click(screen.getByRole("button", { name: "Back" }));
    const input = screen.getByLabelText("Amount");
    await user.clear(input);
    await user.type(input, "600");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await confirmWithdrawal();
    await screen.findByRole("heading", { name: "Sending your money" });

    expect(posted.map((p) => p.body)).toEqual([
      {
        method: "telebirr",
        amount: "500.00",
        to: { kind: "saved", payoutAccountId: SAVED.id },
      },
      {
        method: "telebirr",
        amount: "500.00",
        to: { kind: "new", account: "+251911234567" },
      },
      {
        method: "telebirr",
        amount: "600.00",
        to: { kind: "new", account: "+251911234567" },
      },
    ]);
    expect(new Set(posted.map((p) => p.key)).size).toBe(3);
  });

  it("asks who is signed in before Try again, and sends nothing for someone else (AC-8)", async () => {
    requests = ["drop", [201, PROCESSING]];
    api();
    render(<WalletView />);
    await toConfirm();
    await confirmWithdrawal();
    await screen.findByText("We couldn’t confirm your withdrawal");

    // Another tab signed someone else in since this one last looked.
    signedIn = OTHER_PLAYER;
    await user.click(tryAgain());

    // Nothing went for them; the wallet starts afresh for whoever it is now.
    expect(
      await screen.findByRole("heading", {
        name: "Where should we send your money?",
      }),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(1);
  });

  it("keeps the key when the player leaves after no answer and comes back (AC-8)", async () => {
    requests = ["drop", [201, PROCESSING]];
    api();
    render(<WalletView />);
    await toConfirm();
    await confirmWithdrawal();
    await screen.findByText("We couldn’t confirm your withdrawal");

    // Leaving cancels nothing, and the button says where it goes.
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to wallet" }));
    await user.click(await screen.findByRole("button", { name: "Withdraw" }));

    // The withdrawal that had no answer is where the flow opens again.
    expect(
      await screen.findByText("We couldn’t confirm your withdrawal"),
    ).toBeInTheDocument();
    expect(screen.getByText("+2519••••567")).toBeInTheDocument();
    await user.click(tryAgain());

    await screen.findByRole("heading", { name: "Sending your money" });
    expect(posted).toHaveLength(2);
    expect(posted[1].key).toBe(posted[0].key);
    expect(posted[1].body).toEqual(posted[0].body);
  });

  it("shows the withdrawal that started after the player left, instead of sending another (AC-8)", async () => {
    let answer!: (value: [number, unknown]) => void;
    requests = [new Promise((resolve) => (answer = resolve))];
    api();
    const { queryClient, rerender } = render(<Page wallet />);
    await toConfirm();
    await confirmWithdrawal();

    // On its way: nothing on this screen can leave it half-sent.
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // The player goes to another page before the answer comes back…
    rerender(
      <QueryClientProvider client={queryClient}>
        <Page wallet={false} />
      </QueryClientProvider>,
    );
    await act(async () => answer([201, PROCESSING]));
    // …the balance is read again anyway: the API moved the money…
    await waitFor(() => expect(count("GET /api/wallet")).toBe(2));
    // …and back: the withdrawal that was accepted is what they see.
    rerender(
      <QueryClientProvider client={queryClient}>
        <Page wallet />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Sending your money" }),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(1);
  });
});

describe("refusals and their fixes (AC-9)", () => {
  it("offers Verify when the API wants the ID checked (AC-9)", async () => {
    requests = [[403, problem(403, "KYC_REQUIRED")]];
    api();
    render(<WalletView />);
    await toConfirm();
    await confirmWithdrawal();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Verify your ID");
    expect(alert).toHaveTextContent("Verify your ID with Fayda to withdraw.");
    // Whether the player may withdraw at all is read again.
    await waitFor(() => expect(count("GET /api/me")).toBe(1));
    await user.click(within(alert).getByRole("button", { name: "Verify" }));
    expect(useAuthStore.getState().entry).toBe("verify");
  });

  it("explains a bonus still being wagered and offers to keep wagering (AC-9)", async () => {
    requests = [
      [
        422,
        problem(422, "PAY_ACTIVE_BONUS_WAGERING", {
          detail: "Withdrawing now forfeits your bonus of 50.00 ETB.",
        }),
      ],
    ];
    api();
    render(<WalletView />);
    await toConfirm();
    await confirmWithdrawal();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bonus still being wagered");
    expect(alert).toHaveTextContent(
      "You have a bonus that isn’t fully wagered yet, so this withdrawal can’t go through.",
    );
    // The API's own figure, as its own line.
    expect(alert).toHaveTextContent(
      "Withdrawing now forfeits your bonus of 50.00 ETB.",
    );
    // No forfeit until the contract can say it (request 008).
    expect(
      within(alert).queryByRole("button", { name: /forfeit/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm withdrawal" }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.click(
      within(alert).getByRole("button", { name: "Keep wagering" }),
    );
    expect(push).toHaveBeenCalledWith("/");
  });

  it("offers the nearest allowed amount when the amount is out of range, and sends it as a new withdrawal (AC-9)", async () => {
    requests = [
      [
        422,
        problem(422, "PAY_AMOUNT_OUT_OF_RANGE", {
          detail: "Your withdrawals today can't go over 300.00 ETB.",
          errors: [{ field: "amount", code: "DAILY_MAX", limit: "300.00" }],
        }),
      ],
      [201, { ...PROCESSING, amount: "300.00" }],
    ];
    api();
    render(<WalletView />);
    await toConfirm();
    await confirmWithdrawal();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Amount not allowed");
    // 500.00 is inside telebirr's range: the API's own words say why.
    expect(alert).toHaveTextContent(
      "The API's title for PAY_AMOUNT_OUT_OF_RANGE",
    );
    expect(alert).not.toHaveTextContent("per withdrawal");
    // The methods are read again: the limits may have moved.
    await waitFor(() => expect(count("GET /api/payment-methods")).toBe(2));
    await user.click(
      within(alert).getByRole("button", { name: /^Withdraw ETB\s300\.00$/ }),
    );

    await screen.findByRole("heading", { name: "Sending your money" });
    expect(posted.map((p) => (p.body as { amount: string }).amount)).toEqual([
      "500.00",
      "300.00",
    ]);
    expect(posted[1].key).not.toBe(posted[0].key);
  });

  it("reads the balance again when it is too low, and offers to change the amount (AC-9)", async () => {
    let spent = false;
    // A bet in another tab took most of it.
    wallet = () => [
      200,
      spent ? { ...CONTRACT_WALLET, cash: "300.00" } : CONTRACT_WALLET,
    ];
    requests = [
      [
        422,
        responseExample("/v1/withdrawals", "post", 422, "insufficient_funds"),
      ],
    ];
    api();
    render(<WalletView />);
    await toConfirm();
    spent = true;
    await confirmWithdrawal();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Balance too low");
    expect(alert).toHaveTextContent("Your balance is lower than this amount.");
    await waitFor(() => expect(count("GET /api/wallet")).toBe(2));
    await user.click(
      within(alert).getByRole("button", { name: "Change amount" }),
    );
    // The amount step's ceiling is the API's new balance, once it has landed.
    await waitFor(() =>
      expect(
        screen.getByText("Available to withdraw").nextSibling,
      ).toHaveTextContent("ETB 300.00"),
    );
    expect(
      screen.getByText("This is more than your withdrawable balance."),
    ).toBeInTheDocument();
  });

  it("says this withdrawal can't go through during a break, and offers help (AC-9)", async () => {
    requests = [[403, problem(403, "RG_SELF_EXCLUDED")]];
    api();
    render(<WalletView />);
    await toConfirm();
    await confirmWithdrawal();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You’re taking a break");
    expect(alert).toHaveTextContent(
      "This withdrawal can’t go through during your break. Contact support and we’ll help you get your money.",
    );
    // Never "paused" as a rule: RG-02 keeps a player's funds withdrawable.
    expect(alert).not.toHaveTextContent("paused");
    // A break is server state: who is signed in is read again.
    await waitFor(() => expect(count("GET /api/me")).toBe(1));
    await user.click(within(alert).getByRole("button", { name: "Help" }));
    expect(push).toHaveBeenCalledWith("/help");
  });

  it("says withdrawals aren't available yet, with nothing to fix (AC-9)", async () => {
    requests = [[503, problem(503, "REAL_MONEY_DISABLED")]];
    api();
    render(<WalletView />);
    await toConfirm();
    await confirmWithdrawal();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Not available yet");
    expect(alert).toHaveTextContent("Withdrawals aren’t available yet.");
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
    // An answer, not a silence: no Try again with the same key.
    expect(
      screen.getByRole("button", { name: "Confirm withdrawal" }),
    ).toBeInTheDocument();
  });
});

describe("whose withdrawal it is", () => {
  it("drops the payout accounts and the withdrawal when another player signs in", async () => {
    let accountReads = 0;
    accounts = () => {
      accountReads += 1;
      return [200, accountReads === 1 ? ACCOUNTS : []];
    };
    requests = [[201, PROCESSING]];
    api();
    const { queryClient } = render(
      <>
        <SessionWatcher />
        <WalletView />
      </>,
    );
    await toConfirm();
    await confirmWithdrawal();
    await screen.findByRole("heading", { name: "Sending your money" });

    // Someone else signs in (another tab): the first player's withdrawal and
    // accounts go, and the next player starts afresh.
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), { player: OTHER_PLAYER });
    });
    expect(
      await screen.findByRole("heading", {
        name: "Where should we send your money?",
      }),
    ).toBeInTheDocument();
    expect(
      queryClient.getQueryData(paymentKeys.withdrawal(PROCESSING.id, "en")),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(paymentKeys.payoutAccounts()),
    ).toBeUndefined();

    await toAccount(/telebirr/);
    expect(await screen.findByLabelText("telebirr number")).toBeInTheDocument();
    expect(screen.queryByText("+2519••••567")).not.toBeInTheDocument();
    expect(accountReads).toBe(2);
  });
});

describe("review round 1", () => {
  it("says a refused Try again didn't go through, and keeps its key (S2)", async () => {
    requests = [
      "drop",
      [422, problem(422, "VALIDATION_FAILED")],
      [201, PROCESSING],
    ];
    api();
    render(<WalletView />);
    await toConfirm();
    await confirmWithdrawal();
    await screen.findByText("We couldn’t confirm your withdrawal");

    await user.click(tryAgain());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Try again didn’t go through");
    // The first try may still have gone through: Try again, with its key,
    // stays the way on.
    await user.click(tryAgain());

    await screen.findByRole("heading", { name: "Sending your money" });
    expect(posted).toHaveLength(3);
    expect(new Set(posted.map((p) => p.key)).size).toBe(1);
  });

  it("reads the balance again when a withdrawal had no answer: it may have taken the money (M2)", async () => {
    requests = ["drop"];
    api();
    render(<WalletView />);
    await toConfirm();
    expect(count("GET /api/wallet")).toBe(1);

    await confirmWithdrawal();
    await screen.findByText("We couldn’t confirm your withdrawal");

    await waitFor(() => expect(count("GET /api/wallet")).toBe(2));
    expect(count("GET /api/wallet/transactions?limit=5")).toBe(2);
  });

  it("never puts an account saved for one player into the next player's list (SEC2)", async () => {
    let answer!: (value: [number, unknown]) => void;
    addAnswer = () => new Promise((resolve) => (answer = resolve));
    let accountReads = 0;
    // The first player's list, then the next player's (nothing saved), then
    // reads that never come back: whatever is listed is what was written.
    accounts = () => {
      accountReads += 1;
      if (accountReads === 1) return [200, ACCOUNTS];
      if (accountReads === 2) return [200, []];
      return new Promise<[number, unknown]>(() => {});
    };
    api();
    const { queryClient } = render(
      <>
        <SessionWatcher />
        <WalletView />
      </>,
    );
    await toAccount(/telebirr/);
    await user.click(
      await screen.findByRole("radio", { name: "Another number" }),
    );
    await user.type(screen.getByLabelText("telebirr number"), "922334890");
    await user.click(screen.getByRole("button", { name: "Save number" }));
    await waitFor(() => expect(added).toHaveLength(1));

    // Someone else signs in before the answer lands…
    signedIn = OTHER_PLAYER;
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), { player: OTHER_PLAYER });
    });
    await toAccount(/telebirr/);
    await screen.findByLabelText("telebirr number");

    // …and the first player's account comes back: it stays theirs.
    await act(async () => answer([201, ADDED]));
    expect(queryClient.getQueryData(paymentKeys.payoutAccounts())).toEqual([]);
    expect(screen.queryByText("+2519••••890")).not.toBeInTheDocument();
  });

  it("keeps the cancel's answer when a read was already on its way (Q3)", async () => {
    let late!: (value: [number, unknown]) => void;
    let readCount = 0;
    reads = () => {
      readCount += 1;
      return readCount === 1
        ? [200, REQUESTED]
        : new Promise((resolve) => (late = resolve));
    };
    cancels = [[200, CANCELLED]];
    search = new URLSearchParams(`withdrawal=${REQUESTED.id}`);
    api();
    const { queryClient } = render(<WalletView />);
    await screen.findByRole("heading", { name: "Withdrawal requested" });

    // A read is on its way — the 10 s beat, or the tab coming back…
    act(() => {
      void queryClient.invalidateQueries({
        queryKey: paymentKeys.withdrawals(REQUESTED.id),
      });
    });
    await waitFor(() => expect(readCount).toBe(2));
    // …when the player cancels, and the API answers first.
    await user.click(screen.getByRole("button", { name: "Cancel withdrawal" }));
    await screen.findByRole("heading", { name: "Withdrawal cancelled" });

    // The read from before the cancel lands late: it changes nothing.
    await act(async () => late([200, REQUESTED]));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(
      queryClient.getQueryData(paymentKeys.withdrawal(REQUESTED.id, "en")),
    ).toMatchObject({ status: "cancelled" });
    expect(
      screen.getByRole("heading", { name: "Withdrawal cancelled" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel withdrawal" }),
    ).not.toBeInTheDocument();
  });

  it("reads the balance again when a change is first seen in another language (M3)", async () => {
    let decided = false;
    reads = () => [200, decided ? as("rejected") : as("review")];
    search = new URLSearchParams(`withdrawal=${PROCESSING.id}`);
    api();
    render(<WalletView />);
    await screen.findByRole("heading", { name: "Being reviewed" });
    expect(count("GET /api/wallet")).toBe(1);

    // Finance rejects it while the player switches to Amharic.
    decided = true;
    act(() => useUiStore.setState({ lang: "am" }));

    expect(
      await screen.findByRole("heading", { name: "ወጪው ውድቅ ሆኗል" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(count("GET /api/wallet")).toBe(2));
  });

  it("says nothing is too late when the read says it is already cancelled (M4)", async () => {
    let tried = false;
    reads = () => [200, tried ? CANCELLED : REQUESTED];
    cancels = [[409, problem(409, "PAY_WITHDRAWAL_NOT_CANCELLABLE")]];
    search = new URLSearchParams(`withdrawal=${REQUESTED.id}`);
    api();
    render(<WalletView />);
    await screen.findByRole("heading", { name: "Withdrawal requested" });

    // Another tab cancelled it first.
    tried = true;
    await user.click(screen.getByRole("button", { name: "Cancel withdrawal" }));

    expect(
      await screen.findByRole("heading", { name: "Withdrawal cancelled" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Too late to cancel")).not.toBeInTheDocument();
  });

  it("leaves the account out when the API didn't name it, and says where in words", async () => {
    const unnamed = as("processing", { accountMasked: null });
    search = new URLSearchParams(`withdrawal=${unnamed.id}`);
    reads = () => [200, unnamed];
    api();
    render(<WalletView />);

    await screen.findByRole("heading", { name: "Sending your money" });
    expect(row("Account")).toBeNull();
    expect(
      screen.getByText("Your withdrawal is being sent to your account."),
    ).toBeInTheDocument();
  });

  it("shows each line of a notice once, an empty one never, and keys them by place (Q4)", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <PaymentNotice
        tone="refused"
        title="Your withdrawal didn’t go through"
        lines={["Same words", "Same words", ""]}
      />,
    );

    expect(screen.getAllByText("Same words")).toHaveLength(2);
    expect(screen.getByRole("alert").querySelectorAll("p")).toHaveLength(2);
    // No duplicate-key warning from React.
    expect(
      errors.mock.calls.filter((call) => String(call[0]).includes("key")),
    ).toEqual([]);
  });
});
