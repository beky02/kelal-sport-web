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
import {
  lookup,
  toBoard,
  toCountries,
  toEventDetail,
  toSearchResults,
  toSports,
  toTopCompetitions,
} from "@/lib/api/mappers/catalogue";
import { toBooking, toBookingReceipt } from "@/lib/api/mappers/bookings";
import { toTerminalConfigView } from "@/lib/api/mappers/config";
import {
  toTerminalActivation,
  toTerminalInfo,
} from "@/lib/api/mappers/terminal";
import type { components } from "@/lib/api/schema";
import { createTerminalQueryClient } from "@/app/(terminal)/providers";
import { SportsbookView } from "@/features/sportsbook/components/SportsbookView";
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

/** The morning of 4 October, when the contract's three matches are still to play. */
const MORNING = new Date("2026-10-04T08:00:00Z");

/** The board, from the contract's three matches on 4 October, read that morning. */
export const BOARD = toBoard(
  { en: example("/v1/events").items, am: example("/v1/events").items },
  DICTIONARY,
  MORNING,
  false,
);

/** The sidebar's lists, from the contract's `/v1/sports` counts. */
export const TOP_COMPETITIONS = toTopCompetitions(
  DICTIONARY,
  example("/v1/sports").items,
);
export const COUNTRIES = toCountries(DICTIONARY, example("/v1/sports").items);

/** The contract's match with its whole book (`/v1/events/{id}`). */
export const EVENT = toEventDetail(
  { en: example("/v1/events/{id}"), am: example("/v1/events/{id}") },
  DICTIONARY,
  MORNING,
  false,
);

/** What a search finds, from the contract's `/v1/search`. */
export const SEARCH = toSearchResults(
  { en: example("/v1/search"), am: example("/v1/search") },
  DICTIONARY,
  example("/v1/sports").items,
  MORNING,
  false,
);

/**
 * The contract's booking (`/v1/bookings/{code}`), mapped: one leg still on
 * sale, re-priced from 2.05 to 2.10, and one whose match has started.
 */
/** The contract's answer to Book bet (`POST /v1/bookings`), mapped. */
export const BOOKED = toBookingReceipt(
  responseExample(
    "/v1/bookings",
    "post",
    201,
  ) as components["schemas"]["BookingCreated"],
  "2026-10-04T08:00:00Z",
);

export const BOOKING = toBooking({
  en: example("/v1/bookings/{code}"),
  am: example("/v1/bookings/{code}"),
});

/** The kiosk's board heading once it is up: the player's, named after its first sport. */
const KIOSK_HEADING = {
  level: 2,
  name: new RegExp(`^${SPORTS[0].name.en}`),
} as const;

/** The kiosk, up: waits for its board's heading. */
export const kioskHeading = () => screen.findByRole("heading", KIOSK_HEADING);

/** The kiosk's board heading, now (for fake-timer tests that tick first). */
export const kioskHeadingNow = () => screen.getByRole("heading", KIOSK_HEADING);

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
    // A kiosk starts clean: no picks, no language chosen, at its start page,
    // and its catalogue sent to its own routes, as its root layout says
    // (`<html data-api>`).
    useBetSlipStore.getState().clear();
    useKioskStore.getState().reset();
    address.go("/");
    document.documentElement.dataset.api = "/api/terminal/";
    document.documentElement.lang = "en";
    vi.spyOn(deviceKeyStore, "load").mockImplementation(async () => keys.pair);
    vi.spyOn(deviceKeyStore, "save").mockImplementation(async (pair) => {
      if (keys.broken) throw new DOMException("Blocked", "UnknownError");
      keys.pair = pair;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete document.documentElement.dataset.api;
  });
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
 * active terminal, an activation the contract's, and the kiosk's config and
 * catalogue (sports, board, the sidebar's lists, a match, search) the
 * contract's; the token route answers only when given, and any route without
 * an answer throws. A call is matched on its path (a match's on its prefix)
 * and logged with its query.
 */
export function routes({
  status = () => json(200, active()),
  activate = () => json(200, ACTIVATION),
  token,
  config = () => json(200, KIOSK_CONFIG),
  sports = () => json(200, SPORTS),
  board = () => json(200, BOARD),
  top = () => json(200, TOP_COMPETITIONS),
  countries = () => json(200, COUNTRIES),
  event = () => json(200, EVENT),
  search = () => json(200, SEARCH),
  booking = () => json(200, BOOKING),
  bookBet = () => json(201, BOOKED),
}: {
  status?: Answer;
  activate?: Answer;
  token?: Answer;
  config?: Answer;
  sports?: Answer;
  board?: Answer;
  top?: Answer;
  countries?: Answer;
  /** `/api/terminal/catalogue/events/{id}`, whatever the id. */
  event?: Answer;
  search?: Answer;
  booking?: Answer;
  /** `POST /api/terminal/bookings`: Book bet. */
  bookBet?: Answer;
} = {}) {
  const answers = new Map<string, Answer | undefined>([
    ["/api/terminal/status", status],
    ["/api/terminal/activate", activate],
    ["/api/terminal/token", token],
    ["/api/terminal/config", config],
    ["/api/terminal/catalogue/sports", sports],
    ["/api/terminal/catalogue/board", board],
    ["/api/terminal/catalogue/competitions/top", top],
    ["/api/terminal/catalogue/competitions/countries", countries],
    ["/api/terminal/catalogue/search", search],
    ["/api/terminal/bookings", bookBet],
  ]);
  const since = Date.now();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    // The terminal's client asks with a path, the shared one with an absolute
    // URL: both are logged as the path and query.
    const asked_ = new URL(String(input), "http://terminal.localhost");
    const route = `${asked_.pathname}${asked_.search}`;
    asked.push({
      route,
      method: init?.method ?? "GET",
      headers: { ...(init?.headers as Record<string, string>) },
      body: init?.body == null ? undefined : String(init.body),
      at: Date.now() - since,
    });
    const url = new URL(route, "http://terminal.localhost");
    const answer = url.pathname.startsWith("/api/terminal/catalogue/events/")
      ? event
      : url.pathname.startsWith("/api/terminal/bookings/")
        ? booking
        : answers.get(url.pathname);
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
 * The query client `TerminalProviders` builds (`createTerminalQueryClient`),
 * with the app's retry policy — two more tries on a 5xx or a network failure — unless
 * `retry: false` switches query retries off, for a test that needs a failed
 * read to stay failed at once.
 */
export function terminalQueryClient({
  retry,
}: { retry?: false } = {}): QueryClient {
  const queryClient = createTerminalQueryClient();
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
  /** The kiosk page an active terminal shows: the home unless said. */
  page?: React.ReactNode;
}

/** Renders the terminal app on a kiosk page in its query client, strict when asked. */
export function renderTerminal({
  retry,
  queryClient = terminalQueryClient({ retry }),
  strict = false,
  page = <SportsbookView />,
}: TerminalRenderOptions = {}) {
  const app = (
    <QueryClientProvider client={queryClient}>
      <TerminalApp>{page}</TerminalApp>
    </QueryClientProvider>
  );
  return {
    queryClient,
    ...render(strict ? <StrictMode>{app}</StrictMode> : app),
  };
}
