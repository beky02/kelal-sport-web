import { StrictMode } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { resetTerminalClock } from "@/features/terminal/api/client";
import { TerminalApp } from "@/features/terminal/components/TerminalApp";
import { deviceKeyStore } from "@/features/terminal/lib/device-key";
import {
  EMPTY_BODY_SHA256,
  canonicalRequest,
} from "@/features/terminal/lib/signing";
import { useKioskStore } from "@/features/terminal/stores/kiosk.store";
import type { TerminalStatus } from "@/features/terminal/types";
import { lookup, toBoard, toSports } from "@/lib/api/mappers/catalogue";
import { toTerminalConfigView } from "@/lib/api/mappers/config";
import {
  toTerminalActivation,
  toTerminalInfo,
} from "@/lib/api/mappers/terminal";
import am from "@/lib/i18n/messages/am.json";
import type { components } from "@/lib/api/schema";
import { createQueryClient } from "@/lib/query/client";
import { example, responseExample } from "../contract";
import { address } from "./navigation";

/**
 * The shop terminal's test harness (F8b), as `render.tsx` is the player's: an
 * in-memory device key store, a stub of the terminal's `/api/terminal/*`
 * routes that records every call, and `renderTerminal`, which renders the
 * terminal in the query client its own providers build.
 *
 * Since the kiosk (F8ca) keeps its board filters in the URL, a terminal test
 * file mocks `next/navigation` with the in-memory one:
 *
 *   vi.mock("next/navigation", () => import("./navigation"));
 */

/** The terminal the contract's `/v1/retail/terminal` example describes. */
export const TERMINAL = toTerminalInfo(example("/v1/retail/terminal"));

/** That terminal, running, its token due for rotation or not. */
export const active = (rotateDue = false): TerminalStatus => ({
  state: "active",
  terminal: TERMINAL,
  rotateDue,
});

/** The kiosk's config as `/api/terminal/config` answers it: the contract's, mapped. */
export const KIOSK_CONFIG = toTerminalConfigView(example("/v1/config/public"));

const DICTIONARY = lookup({
  en: example("/v1/dictionary"),
  am: example("/v1/dictionary"),
});

/** The sport tabs, from the contract's `/v1/sports` (Prism answers the same in both languages). */
export const SPORTS = toSports(DICTIONARY, example("/v1/sports").items);

/** The board, from the contract's three matches on 4 October, read that morning. */
export const BOARD = toBoard(
  { en: example("/v1/events").items, am: example("/v1/events").items },
  DICTIONARY,
  new Date("2026-10-04T08:00:00Z"),
  false,
);

/** The kiosk's heading once it is up, in the tenant's default language (Amharic). */
export const kioskHeading = () =>
  screen.findByRole("heading", {
    level: 1,
    name: am.terminal.kiosk.matches,
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
    // A kiosk starts clean: no picks, no language chosen, at its start page.
    useBetSlipStore.getState().clear();
    useKioskStore.getState().reset();
    address.go("/");
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

/** A route's answer may read the call's query (the kiosk's board, F8ca). */
type Answer = (params: URLSearchParams) => Response | Promise<Response>;

/**
 * Stubs `fetch` with the terminal's routes, each answering from its function
 * — a fresh `Response` per call, which may take (fake) time by returning a
 * promise that waits on the clock. Unless told otherwise the status is the
 * active terminal, an activation the contract's, and the kiosk's config,
 * sports and board the contract's; the token route answers only when given,
 * and any route without an answer throws. A call is matched on its path and
 * logged with its query.
 */
export function routes({
  status = () => json(200, active()),
  activate = () => json(200, ACTIVATION),
  token,
  config = () => json(200, KIOSK_CONFIG),
  sports = () => json(200, SPORTS),
  board = () => json(200, BOARD),
}: {
  status?: Answer;
  activate?: Answer;
  token?: Answer;
  config?: Answer;
  sports?: Answer;
  board?: Answer;
} = {}) {
  const answers = new Map<string, Answer | undefined>([
    ["/api/terminal/status", status],
    ["/api/terminal/activate", activate],
    ["/api/terminal/token", token],
    ["/api/terminal/config", config],
    ["/api/terminal/catalogue/sports", sports],
    ["/api/terminal/catalogue/board", board],
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
    const url = new URL(route, "http://terminal.localhost");
    const answer = answers.get(url.pathname);
    if (!answer) throw new Error(`unexpected ${route}`);
    return answer(url.searchParams);
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
