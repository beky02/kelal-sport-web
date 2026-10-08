import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { notifyManager } from "@tanstack/react-query";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { createDeviceKey } from "@/features/terminal/lib/device-key";
import { sha256Hex, canonicalRequest } from "@/features/terminal/lib/signing";
import { useKioskStore } from "@/features/terminal/stores/kiosk.store";
import type { TerminalStatus } from "@/features/terminal/types";
import { formatMoney, formatOdds } from "@/lib/i18n/format";
import en from "@/lib/i18n/messages/en.json";
import { responseExample } from "../contract";
import { address } from "./navigation";
import {
  BOARD,
  SLIP_CODE,
  TERMINAL,
  active,
  asked,
  json,
  keys,
  problem,
  renderTerminal,
  routes,
  setUpTerminalTests,
  type RouteCall,
} from "./terminal";

vi.mock("next/navigation", () => import("./navigation"));

setUpTerminalTests();

/** 08:00 UTC on 4 October: 11:00 in Addis Ababa, before the contract's matches. */
const NOW = "2026-10-04T08:00:00Z";
const TOMORROW = "2026-10-05";

/** The contract's slip code (Book bet on the kiosk), as the route maps it. */
const CODE = SLIP_CODE;

beforeEach(async () => {
  keys.pair = await createDeviceKey();
  vi.useFakeTimers({
    now: Date.parse(NOW),
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  notifyManager.setScheduler((cb) => queueMicrotask(cb));
});

afterEach(() => {
  vi.useRealTimers();
  notifyManager.setScheduler((cb) => setTimeout(cb, 0));
});

/** Moves the fake clock on by `ms`, then lets every answer it released land. */
async function tick(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
  for (let i = 0; i < 10; i += 1) {
    await act(() => vi.advanceTimersByTimeAsync(0));
  }
}

/**
 * Waits, without moving the clock, until `find` finds something: real work —
 * WebCrypto signing, on Node's threadpool — lands between macrotasks, which
 * the fake clock's ticks alone don't yield to.
 */
async function until<T>(find: () => T | null | undefined): Promise<T> {
  for (let i = 0; i < 50; i += 1) {
    const found = find();
    if (found) return found;
    await new Promise((resolve) => setImmediate(resolve));
    await tick(0);
  }
  throw new Error("never appeared");
}

/**
 * Lets everything a tap set off land — signing included, between macrotasks —
 * before asserting that it sent nothing.
 */
async function settle() {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    await tick(0);
  }
}

/**
 * A touch, as a finger makes one: pointer down, then the click. (Testing
 * Library's async helpers wait on a real timer the fake clock never fires, so
 * events go in directly, as in TerminalStatus.test.tsx.)
 */
function tap(element: Element) {
  fireEvent.pointerDown(element);
  fireEvent.click(element);
}

/** Types into a field as the PC's keyboard would: a key down, then the new value. */
function type(field: Element, value: string) {
  fireEvent.keyDown(field, { key: value.at(-1) ?? "Backspace" });
  fireEvent.change(field, { target: { value } });
}

type Row = (typeof BOARD)[number]["events"][number];
const ROWS = BOARD.flatMap((section) => section.events);
const [FIRST, SECOND] = ROWS;
const homeWinOf = (row: Row) => row.markets.matchResult!.outcomes[0];

/** A price's accessible name, as the player's board gives it. */
const priceName = (row: Row) =>
  new RegExp(
    `^${row.event.home.name.en} – ${row.event.away.name.en}: ${homeWinOf(row).label.en} ${formatOdds(homeWinOf(row).odds!).replace(".", "\\.")}`,
  );
const price = (row: Row) =>
  until(() => screen.queryByRole("button", { name: priceName(row) }));

/** The slip's column, by its own heading. */
const slip = () =>
  within(
    screen
      .getAllByRole("heading", { level: 2, name: en.betSlip.title })[0]
      .closest("aside")!,
  );
const bookButton = (name = en.betSlip.bookBet) =>
  slip().getByRole("button", { name });
const codeDialog = (name = en.betSlip.bookingCode) =>
  screen.queryByRole("dialog", { name });
const codeCalls = () =>
  asked.filter((call) => call.route === "/api/terminal/slip-codes");
const boardReads = () =>
  asked.filter((call) =>
    call.route.startsWith("/api/terminal/catalogue/board"),
  );
const statusReads = () =>
  asked.filter((call) => call.route === "/api/terminal/status");
const sentBody = (call: RouteCall) =>
  JSON.parse(call.body!) as {
    bet_type: string;
    legs: { outcome_id: string; odds?: string }[];
    stake_hint?: string;
  };

/** The terminal with its own idle time. */
const timed = (idleResetSeconds: number | null) => (): Response =>
  json(200, {
    state: "active",
    terminal: { ...TERMINAL, idleResetSeconds },
    rotateDue: false,
  } satisfies TerminalStatus);

/** The kiosk up, with a pick of `rows`' home wins in the slip on screen. */
async function withPicks(...rows: Row[]) {
  renderTerminal();
  for (const row of rows) tap(await price(row));
}

const slipStore = () => useBetSlipStore.getState();
const picksIn = (n: number) => {
  const s = slipStore();
  return n === s.active ? s.selections.length : s.slips[n].selections.length;
};

describe("Book bet on the kiosk makes a slip code (F8cc, the user's review)", () => {
  it("offers Book bet only for a slip that can be a code", async () => {
    routes({ slipCodes: () => json(201, CODE) });
    renderTerminal();
    await price(FIRST);
    // An empty slip has no Book bet.
    expect(
      slip().queryByRole("button", { name: en.betSlip.bookBet }),
    ).toBeNull();

    tap(await price(FIRST));
    expect(bookButton()).not.toHaveAttribute("aria-disabled", "true");

    // Under the shop's minimum there is no code (the user's decision of
    // 2026-10-08): off, and a tap sends nothing.
    const stake = slip().getByRole("textbox", { name: en.betSlip.totalStake });
    type(stake, "");
    expect(bookButton()).toHaveAttribute("aria-disabled", "true");
    tap(bookButton());
    await settle();
    expect(codeCalls()).toHaveLength(0);
  });
});

describe("the code in the booking-code dialog (F8cc AC-1, the user's review)", () => {
  it("shows 4829 1735 with its barcode and when it expires, and keeps it until it is closed — no timer", async () => {
    routes({ slipCodes: () => json(201, CODE) });
    await withPicks(FIRST, SECOND);
    tap(bookButton());

    const box = await until(() => codeDialog());
    const dialog = within(box);
    expect(box).toHaveTextContent("4829 1735");
    expect(
      dialog.getByRole("img", {
        name: `${en.betSlip.bookingCode}: 4829 1735`,
      }),
    ).toBeInTheDocument();
    // 13:00 UTC is 16:00 in Addis Ababa (D7).
    expect(box).toHaveTextContent("Valid until Sun 4 Oct, 16:00");
    // No QR, no Copy or Share on a shop PC.
    expect(dialog.queryByRole("img", { name: /QR/ })).toBeNull();
    expect(
      dialog.queryByRole("button", { name: en.betSlip.copyCode }),
    ).toBeNull();

    // Long past any display time, it is still there: the customer closes it.
    // (A touch every minute, as someone still at the kiosk.)
    for (let minute = 0; minute < 5; minute += 1) {
      fireEvent.pointerDown(box);
      await tick(60_000);
    }
    expect(codeDialog()).not.toBeNull();
  });

  it("closes on Done and on a tap outside, leaves the slip as it is, and Booked opens the same code again", async () => {
    // Nothing here is timed: real timers, and real pointer sequences.
    vi.useRealTimers();
    notifyManager.setScheduler((cb) => setTimeout(cb, 0));
    const user = userEvent.setup();
    address.go(`/?date=${TOMORROW}`);
    routes({ slipCodes: () => json(201, CODE) });
    renderTerminal();
    await user.click(
      await screen.findByRole("button", { name: priceName(FIRST) }),
    );
    await user.click(bookButton());
    const box = await screen.findByRole("dialog", {
      name: en.betSlip.bookingCode,
    });

    await user.click(
      within(box).getByRole("button", { name: en.betSlip.done }),
    );
    expect(codeDialog()).toBeNull();
    // Nothing starts over: the slip, the page and the language stay.
    expect(picksIn(0)).toBe(1);
    expect(address.href).toBe(`/?date=${TOMORROW}`);

    // Booked opens it again, and books nothing more…
    await user.click(bookButton(en.booking.booked));
    const again = await screen.findByRole("dialog", {
      name: en.betSlip.bookingCode,
    });
    expect(again).toHaveTextContent("4829 1735");
    // …and a tap outside the dialog — on its overlay, the page beneath
    // taking no pointer while it is open — closes it too.
    const overlay = again.previousElementSibling!;
    expect(overlay.contains(again)).toBe(false);
    await user.click(overlay);
    await waitFor(() => expect(codeDialog()).toBeNull());
    expect(codeCalls()).toHaveLength(1);
  });

  it("books a changed slip anew", async () => {
    routes({ slipCodes: () => json(201, CODE) });
    await withPicks(FIRST);
    tap(bookButton());
    tap(
      within(await until(() => codeDialog())).getByRole("button", {
        name: en.betSlip.done,
      }),
    );
    tap(await price(SECOND));
    tap(bookButton());
    await until(() => codeDialog());
    expect(codeCalls()).toHaveLength(2);
    expect(codeCalls()[1].headers["Idempotency-Key"]).not.toBe(
      codeCalls()[0].headers["Idempotency-Key"],
    );
  });
});

describe("Book bet on the kiosk, signed (F8cc AC-c1)", () => {
  it("signs the API call over the exact body it sends", async () => {
    routes({ slipCodes: () => json(201, CODE) });
    await withPicks(FIRST);
    tap(bookButton());
    await until(() => codeDialog());

    const [call] = codeCalls();
    expect(call.method).toBe("POST");
    // The contract's body, made in the browser: the pick at the odds shown,
    // and the stake the slip starts at (the shop's minimum) as its hint.
    expect(call.body).toBe(
      JSON.stringify({
        bet_type: "single",
        legs: [
          { outcome_id: homeWinOf(FIRST).id, odds: homeWinOf(FIRST).odds },
        ],
        stake_hint: "10.00",
      }),
    );
    const signature = Uint8Array.from(
      atob(call.headers["X-Device-Signature"]),
      (c) => c.charCodeAt(0),
    );
    const signedText = (body: string) =>
      sha256Hex(body).then((hash) =>
        canonicalRequest(
          "POST",
          "/v1/retail/slip-codes",
          Number(call.headers["X-Device-Timestamp"]),
          hash,
        ),
      );
    const verify = async (body: string) =>
      crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        keys.pair!.publicKey,
        signature,
        new TextEncoder().encode(await signedText(body)),
      );
    expect(await verify(call.body!)).toBe(true);
    // Not this app's route, and not any other body.
    expect(await verify(`${call.body!} `)).toBe(false);
    expect(call.headers["X-Device-Id"]).toBeUndefined();
  });

  it("sends one Idempotency-Key per Book bet — the same on a retry, a new one for a changed slip", async () => {
    let n = 0;
    routes({
      slipCodes: () => {
        n += 1;
        if (n === 1) throw new TypeError("Failed to fetch");
        if (n === 2) return problem(503, "SERVICE_UNAVAILABLE");
        return json(201, CODE);
      },
    });
    await withPicks(FIRST);

    tap(bookButton());
    await until(() => slip().queryByText(en.terminal.code.failed));
    tap(bookButton());
    await until(() => (codeCalls().length === 2 ? true : null));
    await tick(0);
    expect(slip().getByText(en.terminal.code.failed)).toBeInTheDocument();
    const [first, retry] = codeCalls();
    expect(first.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(retry.headers["Idempotency-Key"]).toBe(
      first.headers["Idempotency-Key"],
    );

    // A different stake is a different slip: a new intent, a new key.
    const stake = slip().getByRole("textbox", { name: en.betSlip.totalStake });
    type(stake, "20");
    expect(slip().queryByText(en.terminal.code.failed)).toBeNull();
    tap(bookButton());
    await until(() => codeDialog());
    const third = codeCalls()[2];
    expect(sentBody(third).stake_hint).toBe("20.00");
    expect(third.headers["Idempotency-Key"]).not.toBe(
      first.headers["Idempotency-Key"],
    );
  });
});

describe("starting over for the next customer (F8cc AC-1)", () => {
  it("starts over after 90 s without a touch: the slips, the filters, the language, the search and an open sheet", async () => {
    address.go(`/?date=${TOMORROW}`);
    routes();
    await withPicks(FIRST);
    tap(
      slip().getByRole("button", {
        name: en.betSlip.slipNAria.replace("{n}", "2").replace("{count}", "0"),
      }),
    );
    tap(await price(SECOND));
    type(screen.getByRole("combobox", { name: en.header.search }), "Ars");
    tap(
      screen.getByRole("button", {
        name: en.nav.slipAria.replace("{n}", "1"),
      }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => useKioskStore.getState().choose("am"));
    expect(document.documentElement.lang).toBe("am");

    await tick(89_000);
    expect(picksIn(1)).toBe(1);
    expect(useKioskStore.getState().chosen).toBe("am");

    await tick(1_000);
    expect([0, 1, 2].map(picksIn)).toEqual([0, 0, 0]);
    expect(slipStore().active).toBe(0);
    expect(slipStore().stake).toBe("10");
    expect(useKioskStore.getState().chosen).toBeNull();
    expect(document.documentElement.lang).toBe("en");
    expect(address.href).toBe("/");
    expect(
      screen.getByRole("combobox", { name: en.header.search }),
    ).toHaveValue("");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes a code left open, and takes it away, after the idle time", async () => {
    routes({ slipCodes: () => json(201, CODE) });
    await withPicks(FIRST);
    tap(bookButton());
    await until(() => codeDialog());
    await tick(90_000);
    expect(codeDialog()).toBeNull();
    expect(picksIn(0)).toBe(0);
    expect(useKioskStore.getState().codes).toEqual({});
  });

  it("puts the reset back by the whole idle time at every touch", async () => {
    routes();
    await withPicks(FIRST);
    await tick(80_000);
    fireEvent.pointerDown(document.body);
    await tick(80_000);
    expect(picksIn(0)).toBe(1);
    await tick(10_000);
    expect(picksIn(0)).toBe(0);
  });

  it("uses the terminal's own idle time, and C19's 90 s without one", async () => {
    routes({ status: timed(45) });
    await withPicks(FIRST);
    await tick(44_000);
    expect(picksIn(0)).toBe(1);
    await tick(1_000);
    expect(picksIn(0)).toBe(0);
  });
});

describe("no price polling while idle (F8cc AC-c2)", () => {
  it("stops reading prices while idle, reads them again at the first touch, and keeps reading the status", async () => {
    routes();
    renderTerminal();
    await price(FIRST);
    const before = boardReads().length;
    await tick(30_000);
    // Active: the board every 30 s (D5).
    expect(boardReads().length).toBe(before + 1);

    // Idle from 90 s: starting over may read the home board once, then nothing.
    await tick(61_000);
    const idleFrom = boardReads().length;
    const statusFrom = statusReads().length;
    await tick(10 * 60_000);
    expect(boardReads().length).toBe(idleFrom);
    // The terminal's status goes on every 5 minutes, idle or not.
    expect(statusReads().length).toBe(statusFrom + 2);

    // The first touch reads the prices on screen at once, then every 30 s.
    fireEvent.pointerDown(document.body);
    await tick(0);
    expect(boardReads().length).toBe(idleFrom + 1);
    await tick(30_000);
    expect(boardReads().length).toBe(idleFrom + 2);
  });
});

describe("the terminal's 30 codes per 10 minutes (F8cc AC-6)", () => {
  const MESSAGE = (minutes: number) =>
    en.terminal.code.paused.replace("{minutes}", String(minutes));

  it("says when the terminal can make the next code after a 429, and Book bet waits until then", async () => {
    let n = 0;
    routes({
      // An hour's idle time, so the wait is the only clock that runs.
      status: timed(3600),
      slipCodes: () =>
        (n += 1) === 1
          ? problem(429, "RATE_LIMITED", { "Retry-After": "240" })
          : json(201, CODE),
    });
    await withPicks(FIRST);
    tap(bookButton());
    const said = await until(() => slip().queryByText(MESSAGE(4)));
    expect(said.closest("[role=status]")).not.toBeNull();
    expect(bookButton()).toHaveAttribute("aria-disabled", "true");

    // A tap while it waits sends nothing.
    tap(bookButton());
    await settle();
    expect(codeCalls()).toHaveLength(1);

    await tick(180_000);
    expect(slip().getByText(MESSAGE(1))).toBeInTheDocument();
    expect(bookButton()).toHaveAttribute("aria-disabled", "true");

    await tick(60_000);
    expect(slip().queryByText(/too many codes/)).toBeNull();
    expect(bookButton()).not.toHaveAttribute("aria-disabled", "true");
    tap(bookButton());
    await until(() => codeDialog());
    // The same Book bet, waited out: the same key.
    expect(codeCalls()[1].headers["Idempotency-Key"]).toBe(
      codeCalls()[0].headers["Idempotency-Key"],
    );
  });

  it("keeps the wait through an idle reset: it is the terminal's, not the customer's", async () => {
    routes({
      slipCodes: () => problem(429, "RATE_LIMITED", { "Retry-After": "240" }),
    });
    await withPicks(FIRST);
    tap(bookButton());
    await until(() => slip().queryByText(MESSAGE(4)));

    await tick(90_000);
    expect(picksIn(0)).toBe(0);
    tap(await price(FIRST));
    // 150 s left.
    expect(slip().getByText(MESSAGE(3))).toBeInTheDocument();
    expect(bookButton()).toHaveAttribute("aria-disabled", "true");
  });

  it("says try again later after a 429 without Retry-After, and doesn't hold Book bet", async () => {
    routes({ slipCodes: () => problem(429, "RATE_LIMITED") });
    await withPicks(FIRST);
    tap(bookButton());
    await until(() => slip().queryByText(en.terminal.code.pausedLater));
    expect(bookButton()).not.toHaveAttribute("aria-disabled", "true");
    tap(bookButton());
    await until(() => (codeCalls().length === 2 ? true : null));
  });
});

describe("what a refused Book bet offers (F8cc AC-c3)", () => {
  /** An amount as the screen reads it (its no-break space as a space). */
  const money = (amount: string) =>
    formatMoney(amount, "en").replace(/\s/g, " ");

  it("offers the server's stake when it refuses the hint, and sends it on the next Book bet", async () => {
    let n = 0;
    routes({
      slipCodes: () =>
        (n += 1) === 1
          ? json(422, {
              type: "about:blank",
              title: "Stake is below the minimum",
              status: 422,
              code: "BET_STAKE_TOO_LOW",
              // Request 015's shape: the hint is named.
              errors: [{ field: "stake_hint", code: "MIN", limit: "20.00" }],
            })
          : json(201, CODE),
    });
    await withPicks(FIRST);
    tap(bookButton());
    await until(() =>
      slip().queryByText(
        en.betSlip.errors.stakeTooLowBody.replace("{amount}", money("20.00")),
      ),
    );
    tap(
      slip().getByRole("button", {
        name: en.betSlip.setMax.replace("{amount}", "20.00"),
      }),
    );
    expect(
      slip().getByRole("textbox", { name: en.betSlip.totalStake }),
    ).toHaveValue("20.00");
    tap(bookButton());
    await until(() => codeDialog());
    expect(sentBody(codeCalls()[1]).stake_hint).toBe("20.00");
  });

  it("offers the stake from the contract's own example too (field stake)", async () => {
    const example = responseExample(
      "/v1/retail/slip-codes",
      "post",
      422,
      "stake_too_low",
    );
    routes({ slipCodes: () => json(422, example) });
    await withPicks(FIRST);
    tap(bookButton());
    await until(() =>
      slip().queryByRole("button", {
        name: en.betSlip.setMax.replace("{amount}", "5.00"),
      }),
    );
  });

  it("marks a started match from legs[i], with Remove it, and leaves it out of the next code", async () => {
    // The slip's own alert for a pick that can't be sold, without the
    // placing words ("Your bet wasn't placed"): nothing is placed here.
    let n = 0;
    routes({
      slipCodes: () =>
        (n += 1) === 1
          ? json(422, {
              type: "about:blank",
              title: "A match has started",
              status: 422,
              code: "BET_EVENT_STARTED",
              errors: [{ field: "legs[1].outcome_id", code: "EVENT_STARTED" }],
            })
          : json(201, CODE),
    });
    await withPicks(FIRST, SECOND);
    tap(bookButton());
    await until(() => slip().queryByText(en.betSlip.alerts.suspendedTitle));
    expect(slip().queryByText(/wasn’t placed/)).toBeNull();
    expect(
      slipStore().selections.find((s) => s.outcomeId === homeWinOf(SECOND).id)
        ?.suspended,
    ).toBe(true);
    expect(
      slip().getByRole("button", { name: en.betSlip.alerts.removeIt }),
    ).toBeInTheDocument();

    tap(bookButton());
    await until(() => codeDialog());
    expect(sentBody(codeCalls()[1]).legs).toEqual([
      { outcome_id: homeWinOf(FIRST).id, odds: homeWinOf(FIRST).odds },
    ]);
  });

  it("lets the status decide on a 401: a lapsed terminal asks for a new code", async () => {
    let reads = 0;
    routes({
      status: () =>
        (reads += 1) === 1
          ? json(200, active())
          : json(200, { state: "inactive", reason: "expired" }),
      slipCodes: () => problem(401, "AUTH_TOKEN_EXPIRED"),
    });
    await withPicks(FIRST);
    tap(bookButton());
    await until(() => screen.queryByText(en.terminal.activate.lapsed));
    expect(statusReads()).toHaveLength(2);
  });

  it("lets the status decide on a closed shop: the terminal says it is closed", async () => {
    let reads = 0;
    routes({
      status: () =>
        json(200, {
          ...active(),
          terminal: {
            ...TERMINAL,
            shop: { ...TERMINAL.shop, openNow: (reads += 1) === 1 },
          },
        }),
      slipCodes: () => problem(403, "RETAIL_SHOP_CLOSED"),
    });
    await withPicks(FIRST);
    tap(bookButton());
    await until(() =>
      screen.queryByRole("heading", {
        name: new RegExp(en.terminal.closed.title),
      }),
    );
    expect(statusReads()).toHaveLength(2);
  });
});
