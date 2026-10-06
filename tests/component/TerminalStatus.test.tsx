import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { resetTerminalClock } from "@/features/terminal/api/client";
import { TerminalApp } from "@/features/terminal/components/TerminalApp";
import { createDeviceKey } from "@/features/terminal/lib/device-key";
import {
  EMPTY_BODY_SHA256,
  canonicalRequest,
} from "@/features/terminal/lib/signing";
import type { TerminalStatus } from "@/features/terminal/types";
import { toTerminalInfo } from "@/lib/api/mappers/terminal";
import en from "@/lib/i18n/messages/en.json";
import { terminalKeys } from "@/lib/query/keys";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { example } from "../contract";

/** The device key store, in memory: jsdom has no IndexedDB. */
const keys = vi.hoisted(() => ({ pair: null as CryptoKeyPair | null }));
vi.mock("@/features/terminal/lib/device-key", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/terminal/lib/device-key")
  >()),
  deviceKeyStore: {
    load: async () => keys.pair,
    save: async (pair: CryptoKeyPair) => {
      keys.pair = pair;
    },
  },
}));

const NOW = Date.parse("2026-10-06T09:00:00Z");
const MINUTE = 60_000;
const TERMINAL = toTerminalInfo(example("/v1/retail/terminal"));
const active = (rotateDue = false): TerminalStatus => ({
  state: "active",
  terminal: TERMINAL,
  rotateDue,
});

/** Every `/api/terminal/*` call, with when, its headers and its body. */
let asked: {
  route: string;
  method: string;
  headers: Record<string, string>;
  at: number;
}[] = [];

const json = (status: number, body: unknown, headers = {}) =>
  Response.json(body, {
    status,
    headers: {
      "Content-Type":
        status >= 400 ? "application/problem+json" : "application/json",
      ...headers,
    },
  });

const UNAVAILABLE = {
  type: "about:blank",
  title: "The sportsbook API could not be reached",
  status: 503,
  code: "SERVICE_UNAVAILABLE",
};

/**
 * The terminal's routes answer from `answer`, which may take fake time (a
 * slow rotation) by returning a promise that waits on the fake clock.
 */
function routes(
  answer: (route: string, method: string) => Response | Promise<Response>,
) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const route = String(input);
    const method = init?.method ?? "GET";
    asked.push({
      route,
      method,
      headers: { ...(init?.headers as Record<string, string>) },
      at: Date.now() - NOW,
    });
    return answer(route, method);
  });
}

const reads = () => asked.filter((a) => a.route === "/api/terminal/status");
const rotations = () => asked.filter((a) => a.route === "/api/terminal/token");

/** Moves the fake clock on by `ms`, then lets every answer that time released land. */
async function tick(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
  for (let i = 0; i < 10; i += 1) {
    await act(() => vi.advanceTimersByTimeAsync(0));
  }
}

const testClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

function renderTerminal(queryClient: QueryClient = testClient()) {
  // Strict, as `next dev` renders: effects run twice on mount, so a rotation
  // fired from one must still go once.
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <TerminalApp />
      </QueryClientProvider>
    </StrictMode>,
  );
}

const fromBase64 = (text: string) =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

/** Whether a call's signature is the device key's over the API call `method path`. */
const signedFor = (
  call: (typeof asked)[number],
  method: string,
  path: string,
) =>
  crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    keys.pair!.publicKey,
    fromBase64(call.headers["X-Device-Signature"]),
    new TextEncoder().encode(
      canonicalRequest(
        method,
        path,
        Number(call.headers["X-Device-Timestamp"]),
        EMPTY_BODY_SHA256,
      ),
    ),
  );

const readyHeading = () =>
  screen.getByRole("heading", {
    level: 1,
    name: new RegExp(en.terminal.ready.title),
  });

beforeEach(async () => {
  asked = [];
  keys.pair = await createDeviceKey();
  resetTerminalClock();
  vi.useFakeTimers({
    now: NOW,
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  // TanStack tells React about an answer on a zero timeout; on the fake clock
  // that one would wait for the next tick, so answers are told on a microtask.
  notifyManager.setScheduler((cb) => queueMicrotask(cb));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  notifyManager.setScheduler((cb) => setTimeout(cb, 0));
});

describe("the terminal's status (AC-5)", () => {
  it("reads the status on boot and every 5 minutes", async () => {
    routes(() => json(200, active()));
    renderTerminal();

    await tick(0);
    expect(readyHeading()).toBeInTheDocument();
    expect(screen.getByText("Adama Kebele 04")).toBeInTheDocument();
    expect(reads().map((r) => r.at)).toEqual([0]);

    await tick(5 * MINUTE - 1);
    expect(reads()).toHaveLength(1);
    await tick(1);
    expect(reads().map((r) => r.at)).toEqual([0, 5 * MINUTE]);
    await tick(5 * MINUTE);
    expect(reads().map((r) => r.at)).toEqual([0, 5 * MINUTE, 10 * MINUTE]);
  });

  it("rotates the token when it is due, once, without touching the screen", async () => {
    let rotated = false;
    routes(async (route) => {
      if (route === "/api/terminal/token") {
        // A rotation that takes a second, so the screen can be watched during it.
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        rotated = true;
        return json(200, { rotated: true });
      }
      return json(200, active(!rotated));
    });
    renderTerminal();

    await tick(0);
    const heading = readyHeading();
    expect(rotations()).toHaveLength(1);
    expect(rotations()[0].method).toBe("POST");
    expect(rotations()[0].headers[CSRF_HEADER]).toBe(CSRF_VALUE);
    // Signed for the API's rotation, over no body (AC-2).
    expect(
      await signedFor(rotations()[0], "POST", "/v1/retail/terminal/token"),
    ).toBe(true);
    // Mid-rotation: the same screen, nothing loading.
    expect(readyHeading()).toBe(heading);
    expect(screen.queryByRole("status")).toBeNull();

    await tick(1_000);
    // Done: the status read again says nothing is due; the screen never changed.
    expect(reads()).toHaveLength(2);
    expect(readyHeading()).toBe(heading);
    expect(screen.queryByRole("status")).toBeNull();

    await tick(10 * MINUTE);
    expect(rotations()).toHaveLength(1);
  });

  it("rotates once when a screen mounts with a due status already read, however often it mounts", async () => {
    routes((route) =>
      route === "/api/terminal/token"
        ? json(200, { rotated: true })
        : json(200, active(false)),
    );
    // A kiosk page opening with the status in the cache (F8c's pages share
    // it). Strict mode runs the mount's effects twice; a second page mounts
    // the same hook again.
    const queryClient = testClient();
    queryClient.setQueryData(terminalKeys.status(), active(true));
    renderTerminal(queryClient);
    renderTerminal(queryClient);

    await tick(0);
    expect(rotations()).toHaveLength(1);
  });

  it("tries a failed rotation again at the next read", async () => {
    const answers = [json(500, UNAVAILABLE), json(200, { rotated: true })];
    routes((route) =>
      route === "/api/terminal/token"
        ? answers.shift()!
        : json(200, active(true)),
    );
    renderTerminal();

    await tick(0);
    expect(rotations()).toHaveLength(1);
    const heading = readyHeading();

    await tick(5 * MINUTE - 1);
    expect(rotations()).toHaveLength(1);
    await tick(1);
    expect(rotations().map((r) => r.at)).toEqual([0, 5 * MINUTE]);
    expect(readyHeading()).toBe(heading);
  });

  it("keeps the screen when a read fails after the terminal is up", async () => {
    const answers = [json(200, active()), json(503, UNAVAILABLE)];
    routes(() => answers.shift() ?? json(200, active()));
    renderTerminal();

    await tick(0);
    const heading = readyHeading();
    await tick(5 * MINUTE);
    expect(reads()).toHaveLength(2);
    expect(readyHeading()).toBe(heading);
    expect(screen.queryByText(en.terminal.offline.title)).toBeNull();
  });

  it("stops reading once the terminal is revoked", async () => {
    routes(() => json(200, { state: "blocked", reason: "revoked" }));
    renderTerminal();

    await tick(0);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.blocked.revokedTitle),
      }),
    ).toBeInTheDocument();
    await tick(15 * MINUTE);
    expect(reads()).toHaveLength(1);
  });

  it("shows the closed shop until it opens, then the terminal, by itself", async () => {
    const closed: TerminalStatus = {
      state: "active",
      rotateDue: false,
      terminal: { ...TERMINAL, shop: { ...TERMINAL.shop, openNow: false } },
    };
    const answers = [json(200, closed)];
    routes(() => answers.shift() ?? json(200, active()));
    renderTerminal();

    await tick(0);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.closed.title),
      }),
    ).toBeInTheDocument();
    await tick(5 * MINUTE);
    expect(readyHeading()).toBeInTheDocument();
  });

  it("says the server can't be reached when the first read fails, and tries again on a tap", async () => {
    const answers = [json(503, UNAVAILABLE)];
    routes(() => answers.shift() ?? json(200, active()));
    renderTerminal();

    await tick(0);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.offline.title),
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(en.terminal.offline.retry),
      }),
    );
    await tick(0);
    expect(readyHeading()).toBeInTheDocument();
    expect(reads()).toHaveLength(2);
  });

  it("asks nothing and shows activation when this browser holds no device key", async () => {
    keys.pair = null;
    routes(() => json(200, active()));
    renderTerminal();

    await tick(0);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.activate.title),
      }),
    ).toBeInTheDocument();
    expect(asked).toHaveLength(0);
  });
});

describe("signing the terminal's calls (AC-2)", () => {
  it("signs the status read for the API's path, not its own route", async () => {
    routes(() => json(200, active()));
    renderTerminal();
    await tick(0);

    const [read] = reads();
    expect(read.method).toBe("GET");
    expect(read.headers["X-Device-Timestamp"]).toBe(String(NOW));
    expect(await signedFor(read, "GET", "/v1/retail/terminal")).toBe(true);
    expect(await signedFor(read, "GET", "/api/terminal/status")).toBe(false);
    // The route handler names the device, from its cookie; the token never
    // passes through the browser.
    expect(read.headers["X-Device-Id"]).toBeUndefined();
    expect(read.headers.Authorization).toBeUndefined();
  });

  it("corrects a skewed clock from the server's answer and signs again, once", async () => {
    const serverTime = NOW + 2 * MINUTE;
    const answers = [
      json(400, {
        type: "about:blank",
        title: "This terminal's clock is wrong",
        status: 400,
        code: "VALIDATION_FAILED",
        errors: [
          {
            field: "X-Device-Timestamp",
            code: "CLOCK_SKEW",
            current: String(serverTime),
          },
        ],
      }),
    ];
    routes(() => answers.shift() ?? json(200, active()));
    renderTerminal();
    await tick(0);

    expect(reads().map((r) => r.headers["X-Device-Timestamp"])).toEqual([
      String(NOW),
      String(serverTime),
    ]);
    expect(await signedFor(reads()[1], "GET", "/v1/retail/terminal")).toBe(
      true,
    );
    expect(readyHeading()).toBeInTheDocument();

    // Later reads are signed on the server's time too.
    await tick(5 * MINUTE);
    expect(reads()[2].headers["X-Device-Timestamp"]).toBe(
      String(serverTime + 5 * MINUTE),
    );
  });
});
