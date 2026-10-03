import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDeposit } from "@/features/wallet/hooks/use-payments";
import {
  useRecentTransactions,
  useWallet,
} from "@/features/wallet/hooks/use-wallet";
import { toDeposit } from "@/lib/api/mappers/payments";
import { toWalletBalances, toWalletTxnPage } from "@/lib/api/mappers/wallet";
import type { components } from "@/lib/api/schema";
import { useUiStore } from "@/stores/ui.store";
import { example, responseExample } from "../contract";

type ApiDeposit = components["schemas"]["Deposit"];

/** What `/api/deposits/{id}` answers: the contract's examples, mapped. */
const allowAll = () => true;
const PHONE_PENDING = toDeposit(
  responseExample("/v1/deposits", "post", 201, "ussd_push") as ApiDeposit,
  allowAll,
);
const PHONE_COMPLETED = {
  ...PHONE_PENDING,
  status: "completed" as const,
  nextAction: null,
  completedAt: "2026-10-03T13:58:41Z",
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

describe("polling a deposit (AC-2)", () => {
  it("polls a phone deposit every 3 s until it completes, then reads the balance and the history again (AC-2)", async () => {
    vi.useFakeTimers({
      now: Date.parse("2026-10-03T13:58:12Z"),
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    });
    // TanStack tells React about an answer on a zero timeout; on the fake
    // clock that one would wait for the next tick, so this test's answers
    // are told on a microtask instead (restored after each test).
    notifyManager.setScheduler((cb) => queueMicrotask(cb));
    const started = Date.now();
    const reads = [PHONE_PENDING, PHONE_PENDING, PHONE_COMPLETED];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      asked.push({
        path: `${url.pathname}${url.search}`,
        at: Date.now() - started,
      });
      if (url.pathname === "/api/wallet") return json(200, CONTRACT_WALLET);
      if (url.pathname === "/api/wallet/transactions")
        return json(200, CONTRACT_HISTORY);
      if (url.pathname === `/api/deposits/${PHONE_PENDING.id}`)
        return json(200, reads.shift() ?? PHONE_COMPLETED);
      throw new Error(`unexpected ${url}`);
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => {
        // The balance and recent activity on screen, as the wallet has them.
        useWallet(true);
        useRecentTransactions(true);
        return useDeposit(PHONE_PENDING.id);
      },
      { wrapper },
    );
    const deposits = () =>
      asked.filter((a) => a.path.startsWith("/api/deposits/"));
    const reread = (path: string) =>
      asked.filter((a) => a.path === path).length;

    await tick(0);
    expect(result.current.data?.status).toBe("pending");
    expect(reread("/api/wallet")).toBe(1);

    await tick(3_000);
    expect(result.current.data?.status).toBe("pending");
    // Still pending: nothing about the balance has changed, so nothing is read.
    expect(reread("/api/wallet")).toBe(1);
    expect(reread("/api/wallet/transactions?limit=5")).toBe(1);

    await tick(3_000);
    expect(result.current.data?.status).toBe("completed");
    expect(deposits().map((a) => a.at)).toEqual([0, 3_000, 6_000]);
    // Completed: the balance and the history are read again, once.
    expect(reread("/api/wallet")).toBe(2);
    expect(reread("/api/wallet/transactions?limit=5")).toBe(2);

    // Final: no more polling, and no more re-reads.
    await tick(9_000);
    expect(deposits()).toHaveLength(3);
    expect(reread("/api/wallet")).toBe(2);
  });
});
