// The QR encoder, loaded once here, so the code screen's own `import()` of it
// resolves at once under the fake clock.
import "qrcode";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { notifyManager } from "@tanstack/react-query";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { createDeviceKey } from "@/features/terminal/lib/device-key";
import { sha256Hex, canonicalRequest } from "@/features/terminal/lib/signing";
import { useKioskStore } from "@/features/terminal/stores/kiosk.store";
import type { TerminalStatus } from "@/features/terminal/types";
import { formatMoney, formatOdds } from "@/lib/i18n/format";
import am from "@/lib/i18n/messages/am.json";
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

/** The contract's answer to Get code, as the route maps it. */
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
const getCodeButton = (name = en.terminal.code.get) =>
  slip().getByRole("button", { name });
const codeScreen = (name = en.terminal.code.title) =>
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

/** The terminal with its own idle and display times. */
const timed =
  (idleResetSeconds: number | null, codeDisplaySeconds: number | null) =>
  (): Response =>
    json(200, {
      state: "active",
      terminal: { ...TERMINAL, idleResetSeconds, codeDisplaySeconds },
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

describe("Get code in the kiosk's slip (F8cc, decision 1)", () => {
  it("offers Get code in Book bet's place, and only for a slip that can be a code", async () => {
    routes({ slipCodes: () => json(201, CODE) });
    renderTerminal();
    await price(FIRST);
    // An empty slip has no Get code, and no Book bet anywhere.
    expect(
      slip().queryByRole("button", { name: en.terminal.code.get }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: en.betSlip.bookBet }),
    ).toBeNull();

    tap(await price(FIRST));
    expect(getCodeButton()).not.toHaveAttribute("aria-disabled", "true");
    expect(
      screen.queryByRole("button", { name: en.betSlip.bookBet }),
    ).toBeNull();

    // Under the shop's minimum there is no code (Book bet's rule, the user's
    // decision of 2026-10-08): off, and a tap sends nothing.
    const stake = slip().getByRole("textbox", { name: en.betSlip.totalStake });
    type(stake, "");
    expect(getCodeButton()).toHaveAttribute("aria-disabled", "true");
    tap(getCodeButton());
    await settle();
    expect(codeCalls()).toHaveLength(0);
  });
});

describe("the code screen (F8cc AC-1)", () => {
  it("shows 4829 1735 with its QR and when it expires, then starts over after the terminal's display time", async () => {
    address.go(`/?date=${TOMORROW}`);
    routes({ slipCodes: () => json(201, CODE) });
    await withPicks(FIRST, SECOND);
    tap(getCodeButton());

    const box = await until(() => codeScreen());
    const dialog = within(box);
    expect(box).toHaveTextContent("4829 1735");
    expect(
      dialog.getByRole("img", {
        name: en.terminal.code.qr.replace("{code}", "4829 1735"),
      }),
    ).toBeInTheDocument();
    await until(() => dialog.queryByTestId("qr-symbol"));
    expect(box).toHaveTextContent(en.terminal.code.take);
    // 13:00 UTC is 16:00 in Addis Ababa (D7).
    expect(box).toHaveTextContent("Valid until Sun 4 Oct, 16:00");
    expect(box).toHaveTextContent(
      en.terminal.code.clears.replace("{seconds}", "60"),
    );
    expect(dialog.getByRole("button", { name: en.betSlip.done })).toHaveFocus();

    // On screen for the terminal's 60 s (the contract's example), no less…
    await tick(59_000);
    expect(codeScreen()).not.toBeNull();
    expect(codeScreen()).toHaveTextContent(
      en.terminal.code.clears.replace("{seconds}", "1"),
    );
    // …then a clean screen for the next customer.
    await tick(1_000);
    expect(codeScreen()).toBeNull();
    expect(slipStore().active).toBe(0);
    expect([0, 1, 2].map(picksIn)).toEqual([0, 0, 0]);
    expect(slipStore().stake).toBe("10");
    expect(address.href).toBe("/");
    expect(document.documentElement.lang).toBe("en");
  });

  it("starts over at once on Done", async () => {
    address.go(`/?date=${TOMORROW}`);
    routes({ slipCodes: () => json(201, CODE) });
    await withPicks(FIRST);
    tap(getCodeButton());
    const box = await until(() => codeScreen());
    tap(within(box).getByRole("button", { name: en.betSlip.done }));
    expect(codeScreen()).toBeNull();
    expect(picksIn(0)).toBe(0);
    expect(address.href).toBe("/");
  });

  it("keeps the other slips when one becomes a code: the next comes up, in the customer's language and page (the user's answer at the gate)", async () => {
    address.go(`/?date=${TOMORROW}`);
    routes({ slipCodes: () => json(201, CODE) });
    await withPicks(FIRST);
    // Slip 2 gets a pick of its own; back to Slip 1 for its code.
    tap(
      slip().getByRole("button", {
        name: en.betSlip.slipNAria.replace("{n}", "2").replace("{count}", "0"),
      }),
    );
    tap(await price(SECOND));
    tap(
      slip().getByRole("button", {
        name: en.betSlip.slipNAria.replace("{n}", "1").replace("{count}", "1"),
      }),
    );
    tap(getCodeButton());
    await until(() => codeScreen());
    act(() => useKioskStore.getState().choose("am"));

    tap(
      within(codeScreen(am.terminal.code.title)!).getByRole("button", {
        name: am.betSlip.done,
      }),
    );
    expect(codeScreen(am.terminal.code.title)).toBeNull();
    // Slip 1 became the code; Slip 2 is on screen with its pick.
    expect(slipStore().active).toBe(1);
    expect([0, 1].map(picksIn)).toEqual([0, 1]);
    expect(slipStore().selections[0].outcomeId).toBe(homeWinOf(SECOND).id);
    expect(useKioskStore.getState().chosen).toBe("am");
    expect(address.href).toBe(`/?date=${TOMORROW}`);
  });

  it("uses the terminal's own display time, and C19's 60 s without one", async () => {
    routes({ status: timed(null, 30), slipCodes: () => json(201, CODE) });
    await withPicks(FIRST);
    tap(getCodeButton());
    await until(() => codeScreen());
    await tick(29_000);
    expect(codeScreen()).not.toBeNull();
    await tick(1_000);
    expect(codeScreen()).toBeNull();
  });
});

describe("Get code, signed (F8cc AC-c1)", () => {
  it("signs the API call over the exact body it sends", async () => {
    routes({ slipCodes: () => json(201, CODE) });
    await withPicks(FIRST);
    tap(getCodeButton());
    await until(() => codeScreen());

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

  it("sends one Idempotency-Key per Get code — the same on a retry, a new one for a changed slip", async () => {
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

    tap(getCodeButton());
    await until(() => slip().queryByText(en.terminal.code.failed));
    tap(getCodeButton());
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
    tap(getCodeButton());
    await until(() => codeScreen());
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
    routes({ status: timed(45, null) });
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

  it("says when the terminal can make the next code after a 429, and Get code waits until then", async () => {
    let n = 0;
    routes({
      // An hour's idle time, so the wait is the only clock that runs.
      status: timed(3600, null),
      slipCodes: () =>
        (n += 1) === 1
          ? problem(429, "RATE_LIMITED", { "Retry-After": "240" })
          : json(201, CODE),
    });
    await withPicks(FIRST);
    tap(getCodeButton());
    const said = await until(() => slip().queryByText(MESSAGE(4)));
    expect(said.closest("[role=status]")).not.toBeNull();
    expect(getCodeButton()).toHaveAttribute("aria-disabled", "true");

    // A tap while it waits sends nothing.
    tap(getCodeButton());
    await settle();
    expect(codeCalls()).toHaveLength(1);

    await tick(180_000);
    expect(slip().getByText(MESSAGE(1))).toBeInTheDocument();
    expect(getCodeButton()).toHaveAttribute("aria-disabled", "true");

    await tick(60_000);
    expect(slip().queryByText(/too many codes/)).toBeNull();
    expect(getCodeButton()).not.toHaveAttribute("aria-disabled", "true");
    tap(getCodeButton());
    await until(() => codeScreen());
    // The same Get code, waited out: the same key.
    expect(codeCalls()[1].headers["Idempotency-Key"]).toBe(
      codeCalls()[0].headers["Idempotency-Key"],
    );
  });

  it("keeps the wait through an idle reset: it is the terminal's, not the customer's", async () => {
    routes({
      slipCodes: () => problem(429, "RATE_LIMITED", { "Retry-After": "240" }),
    });
    await withPicks(FIRST);
    tap(getCodeButton());
    await until(() => slip().queryByText(MESSAGE(4)));

    await tick(90_000);
    expect(picksIn(0)).toBe(0);
    tap(await price(FIRST));
    // 150 s left.
    expect(slip().getByText(MESSAGE(3))).toBeInTheDocument();
    expect(getCodeButton()).toHaveAttribute("aria-disabled", "true");
  });

  it("says try again later after a 429 without Retry-After, and doesn't hold Get code", async () => {
    routes({ slipCodes: () => problem(429, "RATE_LIMITED") });
    await withPicks(FIRST);
    tap(getCodeButton());
    await until(() => slip().queryByText(en.terminal.code.pausedLater));
    expect(getCodeButton()).not.toHaveAttribute("aria-disabled", "true");
    tap(getCodeButton());
    await until(() => (codeCalls().length === 2 ? true : null));
  });
});

describe("what a refused Get code offers (F8cc AC-c3)", () => {
  /** An amount as the screen reads it (its no-break space as a space). */
  const money = (amount: string) =>
    formatMoney(amount, "en").replace(/\s/g, " ");

  it("offers the server's stake when it refuses the hint, and sends it on the next Get code", async () => {
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
    tap(getCodeButton());
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
    tap(getCodeButton());
    await until(() => codeScreen());
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
    tap(getCodeButton());
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
    tap(getCodeButton());
    await until(() => slip().queryByText(en.betSlip.alerts.suspendedTitle));
    expect(slip().queryByText(/wasn’t placed/)).toBeNull();
    expect(
      slipStore().selections.find((s) => s.outcomeId === homeWinOf(SECOND).id)
        ?.suspended,
    ).toBe(true);
    expect(
      slip().getByRole("button", { name: en.betSlip.alerts.removeIt }),
    ).toBeInTheDocument();

    tap(getCodeButton());
    await until(() => codeScreen());
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
    tap(getCodeButton());
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
    tap(getCodeButton());
    await until(() =>
      screen.queryByRole("heading", {
        name: new RegExp(en.terminal.closed.title),
      }),
    );
    expect(statusReads()).toHaveLength(2);
  });
});
