import { StrictMode } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resetTerminalClock } from "@/features/terminal/api/client";
import { TerminalApp } from "@/features/terminal/components/TerminalApp";
import { deviceKeyStore } from "@/features/terminal/lib/device-key";
import {
  EMPTY_BODY_SHA256,
  canonicalRequest,
} from "@/features/terminal/lib/signing";
import type { TerminalStatus } from "@/features/terminal/types";
import {
  toTerminalActivation,
  toTerminalInfo,
} from "@/lib/api/mappers/terminal";
import type { components } from "@/lib/api/schema";
import { createQueryClient } from "@/lib/query/client";
import { example, responseExample } from "../contract";

/**
 * The shop terminal's test harness (F8b), as `render.tsx` is the player's: an
 * in-memory device key store, a stub of the terminal's `/api/terminal/*`
 * routes that records every call, and `renderTerminal`, which renders the
 * terminal in the query client its own providers build.
 */

/** The terminal the contract's `/v1/retail/terminal` example describes. */
export const TERMINAL = toTerminalInfo(example("/v1/retail/terminal"));

/** That terminal, running, its token due for rotation or not. */
export const active = (rotateDue = false): TerminalStatus => ({
  state: "active",
  terminal: TERMINAL,
  rotateDue,
});

/** The contract's answer to an activation. */
export const ACTIVATION = toTerminalActivation(
  responseExample(
    "/v1/retail/terminals/activate",
    "post",
    200,
  ) as components["schemas"]["TerminalActivation"],
);

/**
 * The device key store, in memory: jsdom has no IndexedDB. Empty at the start
 * of each test; `broken` makes keeping a key fail, as a browser that refuses
 * IndexedDB does.
 */
export const keys = {
  pair: null as CryptoKeyPair | null,
  broken: false,
};

/** One call to a terminal route, as the browser made it. */
export interface RouteCall {
  route: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
  /** Milliseconds since `routes()` was set up, on whichever clock the test runs. */
  at: number;
}

/** Every `/api/terminal/*` call made in this test, in order. */
export const asked: RouteCall[] = [];

/**
 * Sets every test in the file up: the key store emptied and swapped for
 * `keys`, the call log cleared and the learnt clock offset forgotten; and
 * afterwards every spy, `fetch` included, restored. Call once, at the top of
 * a terminal test file, before its own hooks.
 */
export function setUpTerminalTests() {
  beforeEach(() => {
    keys.pair = null;
    keys.broken = false;
    asked.length = 0;
    resetTerminalClock();
    vi.spyOn(deviceKeyStore, "load").mockImplementation(async () => keys.pair);
    vi.spyOn(deviceKeyStore, "save").mockImplementation(async (pair) => {
      if (keys.broken) throw new DOMException("Blocked", "UnknownError");
      keys.pair = pair;
    });
  });
  afterEach(() => vi.restoreAllMocks());
}

export const json = (status: number, body: unknown, headers = {}) =>
  Response.json(body, {
    status,
    headers: {
      "Content-Type":
        status >= 400 ? "application/problem+json" : "application/json",
      ...headers,
    },
  });

/** A Problem as the route handler passes it through from the API. */
export const problem = (status: number, code: string, headers = {}) =>
  json(
    status,
    { type: "about:blank", title: "Refused", status, code },
    headers,
  );

type Answer = () => Response | Promise<Response>;

/**
 * Stubs `fetch` with the terminal's routes, each answering from its function
 * — a fresh `Response` per call, which may take (fake) time by returning a
 * promise that waits on the clock. Unless told otherwise the status is the
 * active terminal and an activation the contract's; the token route answers
 * only when given, and any route without an answer throws.
 */
export function routes({
  status = () => json(200, active()),
  activate = () => json(200, ACTIVATION),
  token,
}: {
  status?: Answer;
  activate?: Answer;
  token?: Answer;
} = {}) {
  const answers = new Map<string, Answer | undefined>([
    ["/api/terminal/status", status],
    ["/api/terminal/activate", activate],
    ["/api/terminal/token", token],
  ]);
  const since = Date.now();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const route = String(input);
    asked.push({
      route,
      method: init?.method ?? "GET",
      headers: { ...(init?.headers as Record<string, string>) },
      body: init?.body == null ? undefined : String(init.body),
      at: Date.now() - since,
    });
    const answer = answers.get(route);
    if (!answer) throw new Error(`unexpected ${route}`);
    return answer();
  });
}

const fromBase64 = (text: string) =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

/** Whether a call's signature is the device key's over the API call `method path`. */
export const signedFor = (call: RouteCall, method: string, path: string) =>
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

/**
 * The query client `TerminalProviders` builds (`createQueryClient`), with the
 * app's retry policy — two more tries on a 5xx or a network failure — unless
 * `retry: false` switches query retries off, for a test that needs a failed
 * read to stay failed at once.
 */
export function terminalQueryClient({
  retry,
}: { retry?: false } = {}): QueryClient {
  const queryClient = createQueryClient();
  if (retry === false) {
    const defaults = queryClient.getDefaultOptions();
    queryClient.setDefaultOptions({
      ...defaults,
      queries: { ...defaults.queries, retry: false },
    });
  }
  return queryClient;
}

export interface TerminalRenderOptions {
  /** `false` switches query retries off; ignored when `queryClient` is given. */
  retry?: false;
  /** A client of the test's own, from `terminalQueryClient`, to seed or share. */
  queryClient?: QueryClient;
  /** Render in `StrictMode`, as `next dev` does: effects run twice on mount. */
  strict?: boolean;
}

/** Renders the terminal app in its query client, strict when asked. */
export function renderTerminal({
  retry,
  queryClient = terminalQueryClient({ retry }),
  strict = false,
}: TerminalRenderOptions = {}) {
  const app = (
    <QueryClientProvider client={queryClient}>
      <TerminalApp />
    </QueryClientProvider>
  );
  return {
    queryClient,
    ...render(strict ? <StrictMode>{app}</StrictMode> : app),
  };
}
