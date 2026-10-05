import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useWithdrawal } from "@/features/wallet/hooks/use-withdrawals";
import {
  useRecentTransactions,
  useWallet,
} from "@/features/wallet/hooks/use-wallet";
import type { Withdrawal } from "@/features/wallet/types";
import { toWithdrawal } from "@/lib/api/mappers/withdrawals";
import { toWalletBalances, toWalletTxnPage } from "@/lib/api/mappers/wallet";
import type { components } from "@/lib/api/schema";
import { useUiStore } from "@/stores/ui.store";
import { example, responseExample } from "../contract";

type ApiWithdrawal = components["schemas"]["Withdrawal"];

/** What `/api/withdrawals/{id}` answers: the contract's examples, mapped. */
const PROCESSING = toWithdrawal(
  responseExample(
    "/v1/withdrawals",
    "post",
    201,
    "processing",
  ) as ApiWithdrawal,
);
const PAID = toWithdrawal(example("/v1/withdrawals/{id}"));
const REVIEW: Withdrawal = {
  ...PROCESSING,
  status: "review",
  reviewReason: "FIRST_WITHDRAWAL",
};
const CONTRACT_WALLET = toWalletBalances(example("/v1/wallet"));
const CONTRACT_HISTORY = toWalletTxnPage(example("/v1/wallet/transactions"));

/** Every `/api/…` path and query asked for, in order, with when. */
let asked: { path: string; at: number }[] = [];

const json = (status: number, body: unknown) =>
  Response.json(body, {
    status,
    headers: {
      "Content-Type":
        status >= 400 ? "application/problem+json" : "application/json",
    },
  });

beforeEach(() => {
  asked = [];
  useUiStore.setState({ lang: "en" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  notifyManager.setScheduler((cb) => setTimeout(cb, 0));
});

/**
 * Moves the fake clock on by `ms`, then lets every answer that time released
 * land: a response is parsed over a few promise turns after its timer fires.
 */
async function tick(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
  for (let i = 0; i < 5; i += 1) {
    await act(() => vi.advanceTimersByTimeAsync(0));
  }
}

/**
 * The fake clock, React told on a microtask, the wallet's own reads on
 * screen, and `/api/withdrawals/{id}` answering `answer` each time.
 */
function setUp(answer: () => [number, unknown]) {
  vi.useFakeTimers({
    now: Date.parse("2026-10-04T09:00:05Z"),
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  // TanStack tells React about an answer on a zero timeout; on the fake clock
  // that one would wait for the next tick, so answers are told on a microtask
  // instead (restored after each test).
  notifyManager.setScheduler((cb) => queueMicrotask(cb));
  const started = Date.now();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    asked.push({
      path: `${url.pathname}${url.search}`,
      at: Date.now() - started,
    });
    if (url.pathname === "/api/wallet") return json(200, CONTRACT_WALLET);
    if (url.pathname === "/api/wallet/transactions") {
      return json(200, CONTRACT_HISTORY);
    }
    if (url.pathname === `/api/withdrawals/${PROCESSING.id}`) {
      return json(...answer());
    }
    throw new Error(`unexpected ${url}`);
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => {
      // The balance and recent activity on screen, as the wallet has them.
      useWallet(true);
      useRecentTransactions(true);
      return useWithdrawal(PROCESSING.id);
    },
    { wrapper },
  );
}

const withdrawalReads = () =>
  asked.filter((a) => a.path.startsWith("/api/withdrawals/"));
const reread = (path: string) => asked.filter((a) => a.path === path).length;

describe("following a withdrawal (AC-4)", () => {
  it("reads a withdrawal every 10 s until it is paid, and reads the balance again only when its status changes (AC-4)", async () => {
    const reads = [PROCESSING, PROCESSING, PAID];
    const { result } = setUp(() => [200, reads.shift() ?? PAID]);

    await tick(0);
    expect(result.current.data?.status).toBe("processing");
    expect(reread("/api/wallet")).toBe(1);

    await tick(10_000);
    expect(result.current.data?.status).toBe("processing");
    // Still processing: nothing about the balance has changed, so nothing is read.
    expect(reread("/api/wallet")).toBe(1);
    expect(reread("/api/wallet/transactions?limit=5")).toBe(1);

    await tick(10_000);
    expect(result.current.data?.status).toBe("paid");
    expect(withdrawalReads().map((a) => a.at)).toEqual([0, 10_000, 20_000]);
    // Paid: the balance and the history are read again, once.
    expect(reread("/api/wallet")).toBe(2);
    expect(reread("/api/wallet/transactions?limit=5")).toBe(2);

    // Final: no more reads of either.
    await tick(60_000);
    expect(withdrawalReads()).toHaveLength(3);
    expect(reread("/api/wallet")).toBe(2);
  });

  it("reads one in review once a minute, not every 10 s", async () => {
    setUp(() => [200, REVIEW]);

    await tick(0);
    await tick(50_000);
    expect(withdrawalReads()).toHaveLength(1);

    await tick(10_000);
    expect(withdrawalReads().map((a) => a.at)).toEqual([0, 60_000]);
    // Same status: the balance is left alone.
    expect(reread("/api/wallet")).toBe(1);
  });

  it("stops reading a withdrawal the API says isn't this player's", async () => {
    setUp(() => [
      404,
      {
        type: "about:blank",
        title: "Not found",
        status: 404,
        code: "NOT_FOUND",
      },
    ]);

    await tick(0);
    await tick(60_000);

    expect(withdrawalReads()).toHaveLength(1);
  });

  it("reads nothing while the tab is hidden, and reads again as soon as it is back", async () => {
    let visibility: DocumentVisibilityState = "visible";
    const spy = vi
      .spyOn(document, "visibilityState", "get")
      .mockImplementation(() => visibility);
    setUp(() => [200, PROCESSING]);

    await tick(0);
    expect(withdrawalReads()).toHaveLength(1);

    visibility = "hidden";
    window.dispatchEvent(new Event("visibilitychange"));
    await tick(30_000);
    expect(withdrawalReads()).toHaveLength(1);

    visibility = "visible";
    window.dispatchEvent(new Event("visibilitychange"));
    await tick(0);
    expect(withdrawalReads()).toHaveLength(2);
    spy.mockRestore();
  });
});
