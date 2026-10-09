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
import { bonusKeys } from "@/lib/query/keys";
import type { components } from "@/lib/api/schema";
import { useUiStore } from "@/stores/ui.store";
import { example, responseExample } from "../contract";

type ApiDeposit = components["schemas"]["Deposit"];

/** What `/api/deposits/{id}` answers: the contract's examples, mapped. */
const allowAll = (url: string) => url;
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
  it("polls a phone deposit every 3 s until it completes, then reads the balance and the history again, and marks the bonus stale (AC-2, F7ca)", async () => {
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

    // The player's bonus, read earlier on Promotions (F7ca).
    queryClient.setQueryData(bonusKeys.mine(), { active: null, freeBets: [] });

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
    // A deposit can grant a bonus, or apply a code that waited for it (C11
    // §5): the bonus is stale too, read when Promotions is next shown.
    expect(queryClient.getQueryState(bonusKeys.mine())?.isInvalidated).toBe(
      true,
    );

    // Final: no more polling, and no more re-reads.
    await tick(9_000);
    expect(deposits()).toHaveLength(3);
    expect(reread("/api/wallet")).toBe(2);
  });
});

describe("when a deposit is not read (Q7)", () => {
  /** The fake clock, React told on a microtask, and `/api/deposits/{id}` answering `answer`. */
  function setUp(answer: () => [number, unknown]) {
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
    notifyManager.setScheduler((cb) => queueMicrotask(cb));
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      asked.push({ path: url.pathname, at: Date.now() });
      return json(...answer());
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return renderHook(() => useDeposit(PHONE_PENDING.id), { wrapper });
  }

  const reads = () => asked.filter((a) => a.path.startsWith("/api/deposits/"));

  it("stops reading a deposit the API says isn't this player's", async () => {
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
    await tick(9_000);

    expect(reads()).toHaveLength(1);
  });

  it("reads nothing while the tab is hidden, and reads again as soon as it is back", async () => {
    let visibility: DocumentVisibilityState = "visible";
    const spy = vi
      .spyOn(document, "visibilityState", "get")
      .mockImplementation(() => visibility);
    setUp(() => [200, PHONE_PENDING]);

    await tick(0);
    expect(reads()).toHaveLength(1);

    // The player switches to the phone's prompt…
    visibility = "hidden";
    window.dispatchEvent(new Event("visibilitychange"));
    await tick(9_000);
    expect(reads()).toHaveLength(1);

    // …and comes back: read at once, then every 3 s again.
    visibility = "visible";
    window.dispatchEvent(new Event("visibilitychange"));
    await tick(0);
    expect(reads()).toHaveLength(2);
    await tick(3_000);
    expect(reads()).toHaveLength(3);
    spy.mockRestore();
  });
});
