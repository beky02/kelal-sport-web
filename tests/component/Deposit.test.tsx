import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SessionWatcher } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import type { Player } from "@/features/auth/types";
import { DepositFollower } from "@/features/wallet/components/DepositFollower";
import { WalletView } from "@/features/wallet/components/WalletView";
import { useDepositAttempt } from "@/features/wallet/hooks/use-payments";
import { useWallet } from "@/features/wallet/hooks/use-wallet";
import { goToProvider } from "@/features/wallet/lib/provider-redirect";
import { resetDepositStore } from "@/features/wallet/stores/deposit.store";
import type { Deposit } from "@/features/wallet/types";
import { useTranslation } from "@/lib/i18n/use-translation";
import { toDeposit, toPaymentMethods } from "@/lib/api/mappers/payments";
import { toWalletBalances } from "@/lib/api/mappers/wallet";
import type { components } from "@/lib/api/schema";
import { paymentKeys, rgKeys, sessionKeys } from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import { example, responseExample } from "../contract";
import { CONTRACT_PLAYER, render } from "./render";

const push = vi.fn();
const replace = vi.fn();
/** The wallet's address: `?action=deposit` unless a test comes back from a provider. */
let search = new URLSearchParams("action=deposit");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => search,
  usePathname: () => "/wallet",
}));

// Leaving for the provider's page is the browser's; here it is recorded.
vi.mock("@/features/wallet/lib/provider-redirect", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/wallet/lib/provider-redirect")
  >()),
  goToProvider: vi.fn(() => true),
}));

// A deposit is read every 3 s (DepositPolling.test.tsx holds it to that);
// here every 25 ms, so a test that waits for a deposit to change doesn't
// wait seconds.
vi.mock("@/features/wallet/lib/deposit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/wallet/lib/deposit")>()),
  DEPOSIT_POLL_MS: 25,
}));

type ApiDeposit = components["schemas"]["Deposit"];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** What `/api/payment-methods` answers for Prism's player: telebirr, CBE Birr, Chapa (down). */
const METHODS = toPaymentMethods(example("/v1/payment-methods").items);
const CBE = METHODS[1];

const created = (name: "redirect" | "ussd_push") =>
  toDeposit(
    responseExample("/v1/deposits", "post", 201, name) as ApiDeposit,
    (url) => url,
  );
/** The contract's push to the phone: CBE Birr, 500.00, pending. */
const PHONE = created("ussd_push");
/** The contract's provider page, for a telebirr deposit. */
const WEB: Deposit = { ...created("redirect"), method: "telebirr" };
const ended = (status: Deposit["status"], id: string): Deposit => ({
  ...PHONE,
  id,
  status,
  nextAction: null,
  ...(status === "completed" ? { completedAt: "2026-10-03T13:58:41Z" } : {}),
});
const COMPLETED = ended("completed", PHONE.id);

const CONTRACT_WALLET = toWalletBalances(example("/v1/wallet"));

/** Someone else, signing in on the same phone. */
const OTHER_PLAYER: Player = {
  ...CONTRACT_PLAYER,
  id: "01J9A7R0000000000000000099",
};

/** The contract's player on a break until 10 Oct, 18:00 EAT, as `/v1/me` reports it. */
const ON_BREAK: Player = {
  ...CONTRACT_PLAYER,
  flags: { ...CONTRACT_PLAYER.flags, excludedUntil: "2026-10-10T15:00:00Z" },
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

/** One answer to a POST: now, never (dropped or timed out), or later (a promise). */
type Answer =
  [number, unknown] | "drop" | "timeout" | Promise<[number, unknown]>;

interface Posted {
  key: string | null;
  body: unknown;
  /** Starting a deposit gives up waiting after a while (and offers Try again). */
  signal: AbortSignal | null;
}

/** Every POST to `/api/deposits` — the request log. */
let posted: Posted[] = [];
/** Every `/api/…` path and query asked for, in order. */
let asked: string[] = [];
/** The answers to `POST /api/deposits`, one per attempt, in order. */
let starts: Answer[] = [];
/** What `GET /api/deposits/{id}` answers. */
let reads: (id: string) => [number, unknown] = () => [200, PHONE];
let methods: () => [number, unknown] = () => [200, METHODS];
let wallet: () => [number, unknown] = () => [200, CONTRACT_WALLET];
/** Who `/api/me` says is signed in when it is read again. */
let signedIn: Player | null = CONTRACT_PLAYER;
/** The language each read of a deposit asked for. */
let readLanguages: (string | null)[] = [];

function api() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    asked.push(`${url.pathname}${url.search}`);
    const reply = ([status, body]: [number, unknown]) =>
      Response.json(body, {
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
      case "/api/deposits": {
        const headers = new Headers(init?.headers);
        posted.push({
          key: headers.get("Idempotency-Key"),
          body: JSON.parse(String(init?.body)),
          signal: init?.signal ?? null,
        });
        const answer = starts.shift() ?? [500, {}];
        if (answer === "drop") throw new TypeError("Failed to fetch");
        // What fetch throws when AbortSignal.timeout gives up.
        if (answer === "timeout") {
          throw new DOMException("signal timed out", "TimeoutError");
        }
        return reply(await answer);
      }
    }
    const id = /^\/api\/deposits\/(.+)$/.exec(url.pathname)?.[1];
    if (id) {
      readLanguages.push(new Headers(init?.headers).get("Accept-Language"));
      return reply(reads(decodeURIComponent(id)));
    }
    throw new Error(`unexpected ${url}`);
  });
}

const user = userEvent.setup();

/** Picks a method and goes on to the confirm step, typing an amount on the way if given. */
async function toConfirm(method: RegExp, amount?: string) {
  await user.click(await screen.findByRole("button", { name: method }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  if (amount !== undefined) {
    const input = screen.getByLabelText("Amount");
    await user.clear(input);
    await user.type(input, amount);
  }
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

const confirmAndPay = () =>
  user.click(screen.getByRole("button", { name: "Confirm and pay" }));

/** The balance as the header chip shows it: the wallet query, nothing else. */
function BalanceChip() {
  const t = useTranslation();
  const balance = useWallet(true).data;
  return (
    <span data-testid="chip">{balance ? t.money(balance.cash) : "…"}</span>
  );
}

/** The deposit's rows under its status: each value by its label. */
function row(label: string): string | null {
  const term = screen.queryByText(label, { selector: "dt" });
  return (
    term?.parentElement
      ?.querySelector("dd")
      ?.textContent?.replace(/\s+/g, " ") ?? null
  );
}

beforeEach(() => {
  posted = [];
  asked = [];
  readLanguages = [];
  starts = [];
  reads = () => [200, PHONE];
  methods = () => [200, METHODS];
  wallet = () => [200, CONTRACT_WALLET];
  signedIn = CONTRACT_PLAYER;
  search = new URLSearchParams("action=deposit");
  push.mockReset();
  replace.mockReset();
  vi.mocked(goToProvider).mockClear();
  sessionStorage.clear();
  // A fresh page: no deposit on its way, unanswered or followed.
  resetDepositStore();
  useUiStore.setState({ lang: "en" });
  useAuthStore.setState({ entry: null });
});

afterEach(() => vi.restoreAllMocks());

describe("choosing a method and an amount (AC-7)", () => {
  it("lists the API's methods with their deposit limits; an unavailable one can't be chosen (AC-7)", async () => {
    api();
    render(<WalletView />);

    const cbe = await screen.findByRole("button", { name: /CBE Birr/ });
    expect(cbe).toHaveTextContent("Approve on your phone");
    expect(cbe).toHaveTextContent("ETB 20.00 – ETB 100,000.00");
    const telebirr = screen.getByRole("button", { name: /telebirr/ });
    expect(telebirr).toHaveTextContent("Pay on their website");
    // Chapa's provider is down: it says so and can't be chosen.
    const chapa = screen.getByRole("button", { name: /Chapa/ });
    expect(chapa).toHaveTextContent("ETB 50.00 – ETB 100,000.00");
    expect(chapa).toHaveTextContent("Unavailable right now");
    // Still reachable by keyboard, so the reason is too (Q8).
    expect(chapa).toHaveAttribute("aria-disabled", "true");
    await user.click(chapa);
    expect(chapa).toHaveAttribute("aria-pressed", "false");

    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeDisabled();
    await user.click(cbe);
    expect(cbe).toHaveAttribute("aria-pressed", "true");
    expect(next).toBeEnabled();
    expect(asked).toContain("/api/payment-methods");
  });

  it("won't continue with an amount outside the method's min–max (AC-7)", async () => {
    api();
    render(<WalletView />);
    await user.click(await screen.findByRole("button", { name: /CBE Birr/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const input = screen.getByLabelText("Amount");
    const next = () => screen.getByRole("button", { name: "Continue" });
    expect(input).toHaveValue("500");

    await user.clear(input);
    await user.type(input, "19.99");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The minimum for CBE Birr is ETB 20.00.",
    );
    expect(next()).toBeDisabled();

    await user.clear(input);
    await user.type(input, "100000.01");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The maximum for CBE Birr is ETB 100,000.00.",
    );
    expect(next()).toBeDisabled();

    await user.clear(input);
    await user.type(input, "20");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(next());

    // The confirm step: what the API will charge, and nothing it won't send.
    expect(
      screen.getByRole("heading", { name: "Check and confirm" }),
    ).toBeInTheDocument();
    expect(row("Amount")).toBeNull(); // rows here are spans, not the status's
    expect(screen.getAllByText("ETB 20.00")).toHaveLength(2);
    expect(screen.queryByText("Fee")).not.toBeInTheDocument();
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "You’ll get a CBE Birr prompt on your phone. Enter your PIN there to approve.",
      ),
    ).toBeInTheDocument();
    expect(posted).toEqual([]);
  });
});

describe("one Idempotency-Key per deposit (AC-8)", () => {
  it("sends the same Idempotency-Key on Try again after no answer, and a new one after an answer (AC-8)", async () => {
    starts = ["drop", "timeout", [201, PHONE], [201, PHONE]];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);

    await confirmAndPay();
    expect(
      await screen.findByText("We couldn’t confirm your deposit"),
    ).toBeInTheDocument();
    // The only way on is that very deposit again: Try again, with its amount.
    expect(
      screen.queryByRole("button", { name: "Confirm and pay" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /^Try again · ETB\s500\.00$/ }),
    );
    // The attempt's 30 s ran out: still unanswered, still the same intent.
    await waitFor(() => expect(posted).toHaveLength(2));
    await user.click(
      await screen.findByRole("button", { name: /^Try again · ETB\s500\.00$/ }),
    );

    expect(
      await screen.findByRole("heading", { name: "Check your phone" }),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(3);
    expect(posted[0].key).toMatch(UUID);
    expect(posted.map((p) => p.key)).toEqual(Array(3).fill(posted[0].key));
    expect(posted.map((p) => p.body)).toEqual(
      Array(3).fill({ method: "cbebirr", amount: "500.00" }),
    );
    expect(posted.every((p) => p.signal instanceof AbortSignal)).toBe(true);
    // Each Try again asked who is signed in first.
    expect(asked.filter((path) => path === "/api/me")).toHaveLength(2);

    // A new deposit is a new intent: a new key.
    await user.click(screen.getByRole("button", { name: "Back to wallet" }));
    await user.click(await screen.findByRole("button", { name: "Deposit" }));
    await toConfirm(/CBE Birr/);
    await confirmAndPay();
    await screen.findByRole("heading", { name: "Check your phone" });
    expect(posted).toHaveLength(4);
    expect(posted[3].key).toMatch(UUID);
    expect(posted[3].key).not.toBe(posted[0].key);
  });

  it("makes a new key when the amount changes after no answer, and after a refusal (AC-8)", async () => {
    starts = ["drop", [422, problem(422, "VALIDATION_FAILED")], [201, PHONE]];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();
    await screen.findByText("We couldn’t confirm your deposit");

    // Another amount is another deposit: no Try again for it.
    await user.click(screen.getByRole("button", { name: "Back" }));
    const input = screen.getByLabelText("Amount");
    await user.clear(input);
    await user.type(input, "600");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.queryByText("We couldn’t confirm your deposit"),
    ).not.toBeInTheDocument();
    await confirmAndPay();

    // The API refused it: that intent is over, and its Try again is new.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your deposit didn’t start");
    expect(
      screen.getByRole("button", { name: "Confirm and pay" }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Check your phone" });

    expect(posted.map((p) => p.body)).toEqual([
      { method: "cbebirr", amount: "500.00" },
      { method: "cbebirr", amount: "600.00" },
      { method: "cbebirr", amount: "600.00" },
    ]);
    expect(new Set(posted.map((p) => p.key)).size).toBe(3);
  });

  it("starts one deposit however quickly Confirm is pressed twice (AC-8)", async () => {
    starts = [
      [201, PHONE],
      [201, PHONE],
    ];
    api();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDepositAttempt(CONTRACT_PLAYER.id), {
      wrapper,
    });
    const started = vi.fn();
    const request = { method: "cbebirr" as const, amount: "500.00" };

    // Two presses in the same moment: the second sees what the first saw.
    act(() => {
      result.current.confirm(request, started);
      result.current.confirm(request, started);
    });

    await waitFor(() => expect(started).toHaveBeenCalledTimes(1));
    expect(posted).toHaveLength(1);
    // Done with that one, the next press is a deposit of its own.
    act(() => result.current.confirm(request, started));
    await waitFor(() => expect(started).toHaveBeenCalledTimes(2));
    expect(posted).toHaveLength(2);
    expect(posted[1].key).not.toBe(posted[0].key);
  });

  it("asks who is signed in before Try again, and sends nothing for someone else (AC-8)", async () => {
    starts = ["drop", [201, PHONE]];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();
    await screen.findByText("We couldn’t confirm your deposit");

    // Another tab signed someone else in since this one last looked.
    signedIn = OTHER_PLAYER;
    await user.click(
      screen.getByRole("button", { name: /^Try again · ETB\s500\.00$/ }),
    );

    // Nothing went for them; the wallet starts afresh for whoever it is now.
    expect(
      await screen.findByRole("heading", {
        name: "How do you want to deposit?",
      }),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(1);
    // Once before Try again, once as the wallet follows who it is now.
    expect(asked.filter((path) => path === "/api/me")).toHaveLength(2);
  });
});

describe("leaving for the provider (AC-3)", () => {
  it("leaves for the provider's page only when the server allowed it (AC-3)", async () => {
    const REFUSED: Deposit = {
      ...WEB,
      id: "01J9A7W0000000000000000009",
      nextAction: { type: "unsupported", reason: "redirect_refused" },
    };
    starts = [
      [201, WEB],
      [201, REFUSED],
    ];
    reads = (id) => [200, id === REFUSED.id ? REFUSED : WEB];
    api();
    render(<WalletView />);
    await toConfirm(/telebirr/);
    expect(
      screen.getByText("You’ll continue to telebirr’s page to pay."),
    ).toBeInTheDocument();
    await confirmAndPay();

    await waitFor(() =>
      expect(goToProvider).toHaveBeenCalledWith(
        "https://checkout.chapa.co/checkout/payment/abc123",
      ),
    );
    // Remembered for the way back, by this tab, for this player.
    expect(JSON.parse(sessionStorage.getItem("kelal.deposit")!)).toEqual({
      id: WEB.id,
      player: CONTRACT_PLAYER.id,
    });
    // Behind it, the screen says where the player went, and leads back there.
    expect(
      await screen.findByRole("heading", { name: "Finish paying on telebirr" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue to telebirr" }),
    ).toBeInTheDocument();

    // The server refused the next page: nothing is followed.
    vi.mocked(goToProvider).mockClear();
    await user.click(screen.getByRole("button", { name: "Back to wallet" }));
    await user.click(await screen.findByRole("button", { name: "Deposit" }));
    await toConfirm(/telebirr/);
    await confirmAndPay();
    expect(
      await screen.findByRole("heading", {
        name: "This payment can’t continue here",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "telebirr needs its app or a page this site can’t open. Choose another method.",
      ),
    ).toBeInTheDocument();
    expect(goToProvider).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Choose another method" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "How do you want to deposit?",
      }),
    ).toBeInTheDocument();
  });
});

describe("where a deposit stands (AC-1)", () => {
  const FAILED: Deposit = {
    ...ended("failed", "01J9A7W0000000000000000011"),
    failureReason: "Declined by the wallet",
  };
  const STATES: [string, Deposit, string, string, string[], string[]][] = [
    [
      "initiated",
      { ...PHONE, status: "initiated", nextAction: null },
      "Starting",
      "Starting your payment",
      ["This screen updates by itself."],
      ["Back to wallet"],
    ],
    [
      "pending, approved on the phone",
      PHONE,
      "Pending",
      "Check your phone",
      ["Approve the payment on your phone", "This screen updates by itself."],
      ["Back to wallet"],
    ],
    [
      "pending, paid on the provider's page",
      {
        ...PHONE,
        nextAction: {
          type: "redirect",
          url: "https://app.ethiotelecom.et/pay/abc",
        },
      },
      "Pending",
      "Finish paying on CBE Birr",
      [
        "Complete the payment on CBE Birr’s page.",
        "This screen updates by itself.",
      ],
      ["Continue to CBE Birr", "Back to wallet"],
    ],
    [
      "pending, only payable in the provider's app",
      { ...PHONE, nextAction: { type: "unsupported", reason: "app_sdk" } },
      "Pending",
      "This payment can’t continue here",
      [
        "CBE Birr needs its app or a page this site can’t open. Choose another method.",
      ],
      ["Choose another method", "Back to wallet"],
    ],
    [
      "completed",
      COMPLETED,
      "Success",
      "Money added",
      ["Your deposit of ETB 500.00 from CBE Birr has arrived."],
      ["Done", "Back to sports"],
    ],
    [
      "failed",
      FAILED,
      "Failed",
      "Payment didn’t go through",
      ["Nothing was added to your balance.", "Declined by the wallet"],
      ["Try again", "Choose another method", "Back to wallet"],
    ],
    [
      "expired",
      ended("expired", "01J9A7W0000000000000000012"),
      "Expired",
      "Payment timed out",
      [
        "It wasn’t approved in time, so nothing was added to your balance. If you approved it just now, it will still arrive once CBE Birr confirms it.",
      ],
      ["Back to wallet", "Try again", "Choose another method"],
    ],
  ];

  it.each(STATES)(
    "shows each deposit status in words, with what to do next (AC-1): %s",
    async (_, deposit, badge, title, lines, actions) => {
      starts = [[201, deposit]];
      reads = () => [200, deposit];
      api();
      render(<WalletView />);
      await toConfirm(/CBE Birr/);
      await confirmAndPay();

      const heading = await screen.findByRole("heading", { name: title });
      // Focus lands on the outcome, so it is what a screen reader says.
      await waitFor(() => expect(heading).toHaveFocus());
      const status = screen.getByRole("status");
      expect(within(status).getByText(badge)).toBeInTheDocument();
      for (const line of lines) {
        expect(within(status).getByText(line)).toBeInTheDocument();
      }
      expect(row("Method")).toBe("CBE Birr");
      expect(row("Amount")).toBe("ETB 500.00");
      expect(row("Reference")).toBe(deposit.id);
      for (const name of actions) {
        expect(screen.getByRole("button", { name })).toBeInTheDocument();
      }
      expect(
        screen.queryByRole("button", { name: /Cancel/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("starts a new deposit with the same method and amount, and a new key, from Try again after a failure (AC-1, AC-8)", async () => {
    // The API's deposit says what it was: 750.00 with CBE Birr.
    const failed: Deposit = { ...FAILED, amount: "750.00" };
    starts = [
      [201, failed],
      [201, PHONE],
    ];
    reads = (id) => [200, id === failed.id ? failed : PHONE];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/, "750");
    await confirmAndPay();
    await screen.findByRole("heading", { name: "Payment didn’t go through" });

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      screen.getByRole("heading", { name: "Check and confirm" }),
    ).toBeInTheDocument();
    await confirmAndPay();
    await screen.findByRole("heading", { name: "Check your phone" });

    expect(posted.map((p) => p.body)).toEqual([
      { method: "cbebirr", amount: "750.00" },
      { method: "cbebirr", amount: "750.00" },
    ]);
    expect(posted[1].key).not.toBe(posted[0].key);
  });
});

describe("the balance (AC-4)", () => {
  it("changes no balance until the server says the deposit is complete (AC-4)", async () => {
    let arrived = false;
    // The API's balance once the 500.00 is in — 120.00 owed was repaid from
    // it first, so it is not 1,708.95: the screen shows the API's figure.
    wallet = () => [
      200,
      arrived ? { ...CONTRACT_WALLET, cash: "1588.95" } : CONTRACT_WALLET,
    ];
    starts = [[201, PHONE]];
    reads = () => [200, arrived ? COMPLETED : PHONE];
    api();
    render(
      <>
        <BalanceChip />
        <WalletView />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("chip")).toHaveTextContent("ETB 1,208.95"),
    );
    await toConfirm(/CBE Birr/);
    await confirmAndPay();
    await screen.findByRole("heading", { name: "Check your phone" });

    // Read again and again while pending: the balance is untouched, unread.
    await waitFor(() =>
      expect(
        asked.filter((path) => path.startsWith("/api/deposits/")).length,
      ).toBeGreaterThanOrEqual(3),
    );
    expect(screen.getByTestId("chip")).toHaveTextContent("ETB 1,208.95");
    expect(asked.filter((path) => path === "/api/wallet")).toHaveLength(1);

    arrived = true;
    expect(
      await screen.findByRole("heading", { name: "Money added" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("chip")).toHaveTextContent("ETB 1,588.95"),
    );
    expect(asked.filter((path) => path === "/api/wallet")).toHaveLength(2);
    expect(screen.queryByText(/1,708\.95/)).not.toBeInTheDocument();
  });

  it("reads the limits again when a deposit completes: the deposit limit's used has moved (F7a)", async () => {
    starts = [[201, PHONE]];
    reads = () => [200, COMPLETED];
    api();
    const { queryClient } = render(<WalletView />);
    queryClient.setQueryData(rgKeys.limits(), []);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();

    await screen.findByRole("heading", { name: "Money added" });
    await waitFor(() =>
      expect(
        queryClient
          .getQueryCache()
          .find({ queryKey: rgKeys.limits(), exact: true })?.state
          .isInvalidated,
      ).toBe(true),
    );
  });
});

describe("refusals and their fixes (AC-9)", () => {
  it("offers the nearest allowed amount when the amount is out of range, and sends it as a new deposit (AC-9)", async () => {
    starts = [
      [
        422,
        problem(422, "PAY_AMOUNT_OUT_OF_RANGE", {
          detail: "Your daily deposits can't go over 300.00 ETB.",
          errors: [{ field: "amount", code: "MAX", limit: "300.00" }],
        }),
      ],
      [201, PHONE],
    ];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Amount not allowed");
    // 500.00 is inside CBE Birr's range: the API's own words say why (U6).
    expect(alert).toHaveTextContent(
      "The API's title for PAY_AMOUNT_OUT_OF_RANGE",
    );
    expect(alert).not.toHaveTextContent("per deposit");
    expect(alert).toHaveTextContent(
      "Your daily deposits can't go over 300.00 ETB.",
    );
    // Its fix is the way on; Confirm can't send the refused amount again.
    expect(
      screen.getByRole("button", { name: "Confirm and pay" }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.click(
      within(alert).getByRole("button", { name: /^Deposit ETB\s300\.00$/ }),
    );

    await screen.findByRole("heading", { name: "Check your phone" });
    expect(posted.map((p) => p.body)).toEqual([
      { method: "cbebirr", amount: "500.00" },
      { method: "cbebirr", amount: "300.00" },
    ]);
    expect(posted[1].key).not.toBe(posted[0].key);
  });

  it("marks a method the API says is unavailable and asks for another (AC-9)", async () => {
    let down = false;
    methods = () => [
      200,
      METHODS.map((m) =>
        m.code === "cbebirr" ? { ...m, available: !down } : m,
      ),
    ];
    starts = [[422, problem(422, "PAY_METHOD_UNAVAILABLE")]];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    down = true;
    await confirmAndPay();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Method unavailable");
    expect(alert).toHaveTextContent(
      "CBE Birr isn’t available right now. Choose another method.",
    );
    // The methods are read again; nothing more can be sent with this one.
    await waitFor(() =>
      expect(
        asked.filter((path) => path === "/api/payment-methods"),
      ).toHaveLength(2),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirm and pay" }),
      ).toHaveAttribute("aria-disabled", "true"),
    );
    await user.click(
      within(alert).getByRole("button", { name: "Choose another method" }),
    );
    const cbe = await screen.findByRole("button", { name: /CBE Birr/ });
    expect(cbe).toHaveAttribute("aria-disabled", "true");
    expect(cbe).toHaveTextContent("Unavailable right now");
  });

  it("says the provider didn't answer, and Try again starts a new deposit with a new key (AC-9)", async () => {
    starts = [
      [502, problem(502, "PAY_PROVIDER_ERROR")],
      [201, PHONE],
    ];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Payment provider didn’t respond");
    // What the API's 502 says, and no more: it never says nothing started (M3).
    expect(alert).toHaveTextContent(
      "CBE Birr didn’t answer. Try again, or choose another method.",
    );
    expect(alert).not.toHaveTextContent("didn’t start");
    expect(
      within(alert).getByRole("button", { name: "Choose another method" }),
    ).toBeInTheDocument();
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    await screen.findByRole("heading", { name: "Check your phone" });
    expect(posted).toHaveLength(2);
    expect(posted[1].key).not.toBe(posted[0].key);
    expect(posted[1].body).toEqual(posted[0].body);
  });

  it("shows a limit with the API's own detail and offers the limits (AC-9)", async () => {
    starts = [
      [
        403,
        problem(403, "RG_LIMIT_REACHED", {
          detail:
            "Your daily deposit limit of 1,000.00 ETB resets at midnight.",
        }),
      ],
    ];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Limit reached");
    // Who set the limit is not the API's to say here (M7).
    expect(alert).toHaveTextContent(
      "You’ve reached a deposit limit, so this deposit can’t go through.",
    );
    expect(alert).toHaveTextContent(
      "Your daily deposit limit of 1,000.00 ETB resets at midnight.",
    );
    await user.click(
      within(alert).getByRole("button", { name: "View limits" }),
    );
    expect(push).toHaveBeenCalledWith("/responsible-gaming");
  });

  it("says deposits are paused during a break, until when, once /api/me reports it (AC-9)", async () => {
    // The break began elsewhere: the refusal says so, and /api/me — read
    // again — gives the end, after which no deposit can be started here.
    signedIn = ON_BREAK;
    starts = [[403, problem(403, "RG_COOLING_OFF")]];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();

    // A break is server state: who is signed in is read again, and the end
    // it gives is said — 15:00 UTC is 18:00 in East Africa Time, with its year.
    const status = await screen.findByRole("status");
    await waitFor(() =>
      expect(status).toHaveTextContent(
        "Deposits are paused until 10 Oct 2026, 18:00.",
      ),
    );
    expect(status).toHaveTextContent("You’re taking a break");
    expect(asked).toContain("/api/me");
    // Nothing more can be sent: Confirm is gone with the step.
    expect(
      screen.queryByRole("button", { name: "Confirm and pay" }),
    ).not.toBeInTheDocument();
    expect(posted).toHaveLength(1);
  });

  it("pauses deposits during a break /api/me reports: the flow starts nothing, and the wallet's Deposit is off (F7a)", async () => {
    signedIn = ON_BREAK;
    api();
    render(<WalletView />, { session: ON_BREAK });

    // The header's Deposit or the slip's Deposit to continue land here.
    expect(
      await screen.findByRole("heading", { name: "You’re taking a break" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Deposits are paused until 10 Oct 2026, 18:00."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /CBE Birr/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to wallet" }));
    const deposit = await screen.findByRole("button", { name: "Deposit" });
    expect(deposit).toBeDisabled();
    expect(deposit).toHaveAccessibleDescription(
      "Deposits are paused until 10 Oct 2026, 18:00.",
    );
    // Funds stay withdrawable during a break (RG-02).
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeEnabled();
    expect(posted).toHaveLength(0);
  });

  it("pauses deposits for a permanent self-exclusion, with no end date (F7a)", async () => {
    const excluded: Player = { ...CONTRACT_PLAYER, status: "self_excluded" };
    signedIn = excluded;
    api();
    render(<WalletView />, { session: excluded });

    expect(
      await screen.findByText("Deposits are paused during your break."),
    ).toBeInTheDocument();
  });

  it("offers Verify when the API wants the ID checked (AC-9)", async () => {
    starts = [[403, problem(403, "KYC_REQUIRED")]];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Verify your ID");
    expect(alert).toHaveTextContent("Verify your ID with Fayda to deposit.");
    await user.click(within(alert).getByRole("button", { name: "Verify" }));
    expect(useAuthStore.getState().entry).toBe("verify");
  });

  it("says real-money play isn't available yet, with nothing to fix", async () => {
    starts = [[503, problem(503, "REAL_MONEY_DISABLED")]];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Not available yet");
    expect(alert).toHaveTextContent("Deposits aren’t available yet.");
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
    // An answer, not a silence: no Try again with the same key.
    expect(
      screen.getByRole("button", { name: "Confirm and pay" }),
    ).toBeInTheDocument();
  });
});

describe("coming back from the provider", () => {
  it("resumes the pending deposit when the player comes back from the provider", async () => {
    search = new URLSearchParams("deposit=return");
    sessionStorage.setItem(
      "kelal.deposit",
      JSON.stringify({ id: WEB.id, player: CONTRACT_PLAYER.id }),
    );
    reads = () => [200, WEB];
    api();
    render(<WalletView />);

    expect(
      await screen.findByRole("heading", { name: "Finish paying on telebirr" }),
    ).toBeInTheDocument();
    expect(asked).toContain(`/api/deposits/${WEB.id}`);
    // The marker leaves the address, so a reload doesn't land here again.
    expect(replace).toHaveBeenCalledWith("/wallet");
    await user.click(
      screen.getByRole("button", { name: "Continue to telebirr" }),
    );
    expect(goToProvider).toHaveBeenCalledWith(
      "https://checkout.chapa.co/checkout/payment/abc123",
    );
    // Nothing new was started.
    expect(posted).toEqual([]);
  });

  it("forgets the deposit it came back for once the API has decided", async () => {
    search = new URLSearchParams("deposit=return");
    sessionStorage.setItem(
      "kelal.deposit",
      JSON.stringify({ id: PHONE.id, player: CONTRACT_PLAYER.id }),
    );
    reads = () => [200, COMPLETED];
    api();
    render(<WalletView />);

    expect(
      await screen.findByRole("heading", { name: "Money added" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(sessionStorage.getItem("kelal.deposit")).toBeNull(),
    );
  });

  it("says when the deposit it came back for isn't this player's, and leads back to the wallet (Q7)", async () => {
    search = new URLSearchParams("deposit=return");
    sessionStorage.setItem(
      "kelal.deposit",
      JSON.stringify({ id: WEB.id, player: CONTRACT_PLAYER.id }),
    );
    reads = () => [404, problem(404, "NOT_FOUND")];
    api();
    render(<WalletView />);

    expect(
      await screen.findByRole("heading", {
        name: "We couldn’t find this deposit",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("It isn’t on your account.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to wallet" }));
    expect(await screen.findByTestId("wallet-cash")).toBeInTheDocument();
  });

  it("says when the deposit couldn't be checked, offers Try again, and shows it once it can be read (Q7)", async () => {
    search = new URLSearchParams("deposit=return");
    sessionStorage.setItem(
      "kelal.deposit",
      JSON.stringify({ id: WEB.id, player: CONTRACT_PLAYER.id }),
    );
    let down = true;
    reads = () =>
      down ? [503, problem(503, "SERVICE_UNAVAILABLE")] : [200, WEB];
    api();
    render(<WalletView />);

    expect(
      await screen.findByRole("heading", {
        name: "Couldn’t check this deposit",
      }),
    ).toBeInTheDocument();
    down = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Finish paying on telebirr" }),
    ).toBeInTheDocument();
  });

  it("ignores a deposit remembered for another player", async () => {
    search = new URLSearchParams("deposit=return");
    sessionStorage.setItem(
      "kelal.deposit",
      JSON.stringify({ id: WEB.id, player: OTHER_PLAYER.id }),
    );
    api();
    render(<WalletView />);

    expect(await screen.findByTestId("wallet-cash")).toBeInTheDocument();
    expect(asked.some((path) => path.startsWith("/api/deposits/"))).toBe(false);
  });
});

describe("a deposit outlives its screen (review round 1)", () => {
  const tryAgain = () =>
    screen.getByRole("button", { name: /^Try again · ETB\s500\.00$/ });

  /** The wallet, or another page: what the player sees after leaving it. */
  function Page({ wallet: showWallet }: { wallet: boolean }) {
    return (
      <>
        <BalanceChip />
        {showWallet ? <WalletView /> : <p>Sports</p>}
      </>
    );
  }

  it("keeps the key when the player leaves after no answer and comes back to the same deposit (S1, SEC2, Q2, M1)", async () => {
    starts = ["drop", [201, PHONE]];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();
    await screen.findByText("We couldn’t confirm your deposit");

    // Leaving cancels nothing, and the button says where it goes (U2).
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to wallet" }));
    await user.click(await screen.findByRole("button", { name: "Deposit" }));

    // The deposit that had no answer is where the flow opens again…
    expect(
      await screen.findByText("We couldn’t confirm your deposit"),
    ).toBeInTheDocument();
    // …and picking the same method and amount again is still that deposit.
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await toConfirm(/CBE Birr/);
    await user.click(tryAgain());

    await screen.findByRole("heading", { name: "Check your phone" });
    expect(posted).toHaveLength(2);
    expect(posted[1].key).toBe(posted[0].key);
    expect(posted[1].body).toEqual(posted[0].body);
  });

  it("shows the deposit that started after the player left, instead of starting another (Q2)", async () => {
    let answer!: (value: [number, unknown]) => void;
    starts = [new Promise((resolve) => (answer = resolve))];
    api();
    const { queryClient, rerender } = render(<Page wallet />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();

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
    await act(async () => answer([201, PHONE]));
    // …and back: the deposit that started is what they see.
    rerender(
      <QueryClientProvider client={queryClient}>
        <Page wallet />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Check your phone" }),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(1);
  });

  it("reads the balance again for a deposit that completed after the player left (Q2)", async () => {
    let answer!: (value: [number, unknown]) => void;
    starts = [new Promise((resolve) => (answer = resolve))];
    let arrived = false;
    wallet = () => [
      200,
      arrived ? { ...CONTRACT_WALLET, cash: "1708.95" } : CONTRACT_WALLET,
    ];
    api();
    const { queryClient, rerender } = render(<Page wallet />);
    await waitFor(() =>
      expect(screen.getByTestId("chip")).toHaveTextContent("ETB 1,208.95"),
    );
    await toConfirm(/CBE Birr/);
    await confirmAndPay();
    rerender(
      <QueryClientProvider client={queryClient}>
        <Page wallet={false} />
      </QueryClientProvider>,
    );

    arrived = true;
    await act(async () => answer([201, COMPLETED]));

    await waitFor(() =>
      expect(screen.getByTestId("chip")).toHaveTextContent("ETB 1,708.95"),
    );
    expect(asked.filter((path) => path === "/api/wallet")).toHaveLength(2);
  });

  it("keeps following a pending deposit after the player leaves its screen, and reads the balance when it completes (Q1)", async () => {
    let arrived = false;
    wallet = () => [
      200,
      arrived ? { ...CONTRACT_WALLET, cash: "1708.95" } : CONTRACT_WALLET,
    ];
    starts = [[201, PHONE]];
    reads = () => [200, arrived ? COMPLETED : PHONE];
    api();
    render(
      <>
        <DepositFollower />
        <BalanceChip />
        <WalletView />
      </>,
    );
    await toConfirm(/CBE Birr/);
    await confirmAndPay();
    await screen.findByRole("heading", { name: "Check your phone" });
    await user.click(screen.getByRole("button", { name: "Back to wallet" }));
    await screen.findByTestId("wallet-cash");

    // Still read while the player is elsewhere…
    const readsNow = () =>
      asked.filter((path) => path.startsWith("/api/deposits/")).length;
    const before = readsNow();
    await waitFor(() => expect(readsNow()).toBeGreaterThan(before + 1));

    // …so the approval on the phone shows up as the API's new balance.
    arrived = true;
    await waitFor(() =>
      expect(screen.getByTestId("chip")).toHaveTextContent("ETB 1,708.95"),
    );
    // Final: no longer read.
    const settled = readsNow();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(readsNow()).toBe(settled);
  });

  it("keeps the deposit unanswered when Try again is rate limited, and sends the same key again (M2)", async () => {
    starts = ["drop", [429, problem(429, "RATE_LIMITED")], [201, PHONE]];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();
    await screen.findByText("We couldn’t confirm your deposit");

    await user.click(tryAgain());
    // "Not now" says nothing about the first try: still unanswered.
    await waitFor(() => expect(posted).toHaveLength(2));
    expect(
      await screen.findByText("We couldn’t confirm your deposit"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Your deposit didn’t start"),
    ).not.toBeInTheDocument();
    await user.click(tryAgain());

    await screen.findByRole("heading", { name: "Check your phone" });
    expect(posted.map((p) => p.key)).toEqual(Array(3).fill(posted[0].key));
  });

  it("says a refused Try again didn't go through, and keeps its key (M2)", async () => {
    starts = [
      "drop",
      [
        403,
        problem(403, "RG_LIMIT_REACHED", {
          detail:
            "Your daily deposit limit of 1,000.00 ETB resets at midnight.",
        }),
      ],
      [201, PHONE],
    ];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();
    await screen.findByText("We couldn’t confirm your deposit");
    await user.click(tryAgain());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Try again didn’t go through");
    expect(alert).toHaveTextContent(
      "You’ve reached a deposit limit, so this deposit can’t go through.",
    );
    // The first try may still have started: Try again keeps its key.
    await user.click(tryAgain());
    await screen.findByRole("heading", { name: "Check your phone" });
    expect(posted.map((p) => p.key)).toEqual(Array(3).fill(posted[0].key));
  });
});

describe("details from review round 1", () => {
  it("reads a finished deposit again in the language the player switches to (Q4)", async () => {
    const failed: Deposit = {
      ...ended("failed", "01J9A7W0000000000000000011"),
      failureReason: "Declined by the wallet",
    };
    starts = [[201, failed]];
    reads = () => [200, failed];
    api();
    render(<WalletView />);
    await toConfirm(/CBE Birr/);
    await confirmAndPay();
    await screen.findByText("Declined by the wallet");

    // Final, so no longer polled — but its reason is the API's text.
    act(() => useUiStore.setState({ lang: "am" }));
    await waitFor(() => expect(readLanguages).toContain("am"));
  });

  it("names the method, never its code, while the methods are read or when they fail (Q5)", async () => {
    search = new URLSearchParams("deposit=return");
    sessionStorage.setItem(
      "kelal.deposit",
      JSON.stringify({
        id: "01J9A7W0000000000000000002",
        player: CONTRACT_PLAYER.id,
      }),
    );
    // A Chapa deposit (its code "chapa"), and the methods can't be read.
    reads = () => [200, { ...WEB, method: "chapa" }];
    methods = () => [503, problem(503, "SERVICE_UNAVAILABLE")];
    api();
    render(<WalletView />);

    expect(
      await screen.findByRole("heading", {
        name: "Finish paying on your payment provider",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\bchapa\b/)).not.toBeInTheDocument();
  });

  it("offers Try again and the way back when there is no method to choose (U4)", async () => {
    methods = () => [200, []];
    api();
    const { unmount } = render(<WalletView />);

    expect(
      await screen.findByText(
        "No payment methods are available right now. Try again later.",
      ),
    ).toBeInTheDocument();
    // No Continue that can never act: the way on is back to the wallet.
    expect(
      screen.queryByRole("button", { name: "Continue" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to wallet" }));
    expect(await screen.findByTestId("wallet-cash")).toBeInTheDocument();
    unmount();

    // Or Try again, which reads the methods again.
    render(<WalletView />);
    await screen.findByText(
      "No payment methods are available right now. Try again later.",
    );
    methods = () => [200, METHODS];
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("button", { name: /CBE Birr/ }),
    ).toBeInTheDocument();
  });
});

describe("whose deposit it is", () => {
  it("drops the payment methods and the deposit when another player signs in", async () => {
    let methodReads = 0;
    methods = () => {
      methodReads += 1;
      const name =
        methodReads === 1
          ? "first player's CBE Birr"
          : "next player's CBE Birr";
      return [200, [{ ...CBE, name }]];
    };
    starts = [[201, PHONE]];
    api();
    const { queryClient } = render(
      <>
        <SessionWatcher />
        <WalletView />
      </>,
    );
    await toConfirm(/first player's CBE Birr/);
    await confirmAndPay();
    await screen.findByRole("heading", { name: "Check your phone" });

    // Someone else signs in (another tab): the first player's deposit and
    // methods go, and the next player's are read afresh.
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), { player: OTHER_PLAYER });
    });
    expect(
      await screen.findByRole("button", { name: /next player's CBE Birr/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Check your phone" }),
    ).not.toBeInTheDocument();
    expect(
      queryClient.getQueryData(paymentKeys.deposit(PHONE.id, "en")),
    ).toBeUndefined();
    expect(methodReads).toBe(2);
  });
});
