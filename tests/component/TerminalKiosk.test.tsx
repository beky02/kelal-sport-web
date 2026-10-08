import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { notifyManager } from "@tanstack/react-query";
import { quote, type Slip } from "@golden/slipcalc";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { CompetitionView } from "@/features/competitions/components/CompetitionView";
import { EventDetailView } from "@/features/events/components/EventDetailView";
import { createDeviceKey } from "@/features/terminal/lib/device-key";
import { toBettingRules } from "@/lib/api/mappers/config";
import { formatMoney, formatOdds } from "@/lib/i18n/format";
import am from "@/lib/i18n/messages/am.json";
import en from "@/lib/i18n/messages/en.json";
import { terminalKeys } from "@/lib/query/keys";
import { example } from "../contract";
import { address } from "./navigation";
import {
  BOARD,
  boardOf,
  BOOKED,
  BOOKING,
  EVENT,
  KIOSK_CONFIG,
  SEARCH,
  SPORTS,
  TERMINAL,
  TOP_COMPETITIONS,
  active,
  asked,
  json,
  keys,
  kioskHeading,
  problem,
  renderTerminal,
  routes,
  setUpTerminalTests,
} from "./terminal";

vi.mock("next/navigation", () => import("./navigation"));

setUpTerminalTests();

/**
 * The morning the contract's board is read for (`BOARD`), 11:00 in Addis
 * Ababa: the day strip and the board's day are fixed, whenever the suite runs.
 */
const NOW = Date.parse("2026-10-04T08:00:00Z");
const TODAY = "2026-10-04";
const TOMORROW = "2026-10-05";

// An activated PC: its device key is here, so the status is read. Only the
// date is fake here; the timed tests below fake the timers too.
beforeEach(async () => {
  keys.pair = await createDeviceKey();
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  notifyManager.setScheduler((cb) => setTimeout(cb, 0));
});

const reads = (route: string) => asked.filter((a) => a.route.startsWith(route));
const boardReads = () => reads("/api/terminal/catalogue/board");
const lastQuery = (route: string) =>
  new URL(reads(route).at(-1)!.route, "http://terminal.localhost").searchParams;
const lastBoardQuery = () => lastQuery("/api/terminal/catalogue/board");

type Row = (typeof BOARD)[number]["events"][number];

/** The contract's first match on the board, and its 1X2 market. */
const FIRST = BOARD[0].events[0];
const HOME_WIN = FIRST.markets.matchResult!.outcomes[0];
const matchName = (row: Row) =>
  `${row.event.home.name.en} – ${row.event.away.name.en}`;
/** A price's accessible name, as the player's board gives it. */
const priceName = (
  row: Row,
  outcome: { label: { en: string }; odds: string | null },
) =>
  new RegExp(
    `^${matchName(row)}: ${outcome.label.en} ${formatOdds(outcome.odds!).replace(".", "\\.")}`,
  );
const homeWin = () =>
  screen.findByRole("button", { name: priceName(FIRST, HOME_WIN) });

/** An amount as the screen's text reads it (its no-break space as a space). */
const money = (amount: string, lang: "en" | "am" = "en") =>
  formatMoney(amount, lang).replace(/\s/g, " ");

/** The slip's column, by the slip's own heading. */
const slip = () =>
  within(
    screen
      .getAllByRole("heading", { level: 2, name: en.betSlip.title })[0]
      .closest("aside")!,
  );

describe("the player's board on the kiosk (F8ca AC-1)", () => {
  it("shows the sports, the days and the board's matches with their prices, read through /api/terminal only", async () => {
    routes();
    renderTerminal();

    expect(await kioskHeading()).toBeInTheDocument();
    await homeWin();
    // The sports, from /v1/sports, as the player's tabs and sidebar list them.
    for (const sport of SPORTS) {
      expect(
        screen.getAllByRole("button", { name: new RegExp(sport.name.en) })
          .length,
      ).toBeGreaterThan(0);
    }
    // Today first in the day strip, pressed.
    expect(
      screen.getByRole("button", {
        name: new RegExp(en.board.filters.today),
        pressed: true,
      }),
    ).toBeInTheDocument();

    // Every match and its 1X2 prices as sent; a price the API left out locked.
    for (const section of BOARD) {
      expect(
        screen.getAllByText(section.competition.name.en).length,
      ).toBeGreaterThan(0);
      for (const row of section.events) {
        for (const outcome of row.markets.matchResult!.outcomes) {
          const price = screen.getByRole("button", {
            name:
              outcome.odds === null
                ? new RegExp(
                    `^${matchName(row)}: ${outcome.label.en}, ${en.a11y.suspended}`,
                  )
                : priceName(row, outcome),
          });
          if (outcome.odds === null) expect(price).toBeDisabled();
        }
      }
    }

    // The top competitions, from the terminal's routes.
    expect(
      screen.getByRole("link", {
        name: new RegExp(TOP_COMPETITIONS[0].name.en),
      }),
    ).toBeInTheDocument();
    expect(asked.length).toBeGreaterThan(0);
    for (const call of asked) {
      expect(call.route.startsWith("/api/terminal/")).toBe(true);
    }
  });

  it("offers nothing that needs a player: no log in, register, my bets, wallet, responsible gaming or favourites", async () => {
    routes();
    renderTerminal();
    await homeWin();

    for (const name of [
      en.header.login,
      en.header.register,
      en.nav.myBets,
      en.nav.wallet,
      en.header.responsibleGaming,
      en.betSlip.myBets,
    ]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
    expect(
      screen.queryByRole("button", { name: en.sidebar.addFavourite }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: en.sidebar.pinLeague }),
    ).toBeNull();
    expect(screen.queryByText(en.sidebar.favourites)).toBeNull();
  });

  it("names no shop and no PC anywhere on the kiosk, as it starts or once it is up (rework 2)", async () => {
    let answer!: () => void;
    routes({
      config: () =>
        new Promise((resolve) => {
          answer = () => resolve(json(200, KIOSK_CONFIG));
        }),
    });
    renderTerminal();
    // The status is in (it names the shop); the config is still on its way.
    await waitFor(() => expect(reads("/api/terminal/config")).toHaveLength(1));
    const shown = () =>
      [TERMINAL.shop.name, TERMINAL.label, TERMINAL.id, TERMINAL.shop.code]
        .filter((value): value is string => Boolean(value))
        .filter(
          (text) => screen.queryAllByText(text, { exact: false }).length > 0,
        );
    expect(shown()).toEqual([]);

    act(() => answer());
    await homeWin();
    expect(shown()).toEqual([]);
  });

  it("carries the licence, the age limit and the helpline, with no link to the player's pages (SRS RG-05, review U6)", async () => {
    routes();
    renderTerminal();
    await homeWin();

    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByText(en.sidebar.licence)).toBeInTheDocument();
    expect(footer.getByText("21+")).toBeInTheDocument();
    expect(footer.getByText(en.sidebar.playResponsibly)).toBeInTheDocument();
    expect(footer.getByText(en.footer.helpline)).toBeInTheDocument();
    // Terms, privacy, help: the player's pages, which a terminal host doesn't serve.
    expect(footer.queryAllByRole("link")).toEqual([]);
  });

  it("reads the board for the sport and day in the URL", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await homeWin();
    expect(lastBoardQuery().get("sport")).toBe(SPORTS[0].id);
    expect(lastBoardQuery().get("date")).toBe(TODAY);

    const today = screen.getByRole("button", {
      name: new RegExp(en.board.filters.today),
      pressed: true,
    });
    const strip = today.parentElement!;
    await user.click(within(strip).getAllByRole("button")[1]);
    await waitFor(() => expect(lastBoardQuery().get("date")).toBe(TOMORROW));
    expect(address.params.get("date")).toBe(TOMORROW);

    const other = SPORTS[1];
    await user.click(
      screen.getAllByRole("button", { name: new RegExp(other.name.en) })[0],
    );
    await waitFor(() => expect(lastBoardQuery().get("sport")).toBe(other.id));
    expect(address.params.get("sport")).toBe(other.slug);
  });

  it("says there are no matches on an empty board and goes back to the start", async () => {
    const user = userEvent.setup();
    address.go("/?sport=basketball");
    routes({
      board: (params) =>
        json(200, params.get("sport") === "s_football" ? BOARD : []),
    });
    renderTerminal();

    expect(await screen.findByText(en.board.empty.title)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: en.board.empty.action }),
    );
    expect(address.href).toBe("/");
    expect(await homeWin()).toBeInTheDocument();
  });

  it("says the matches couldn't load and tries again on a tap", async () => {
    const user = userEvent.setup();
    let fail = true;
    routes({
      board: () =>
        fail ? problem(503, "SERVICE_UNAVAILABLE") : json(200, BOARD),
    });
    renderTerminal({ retry: false });

    expect(await screen.findByText(en.board.error.title)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: en.common.retry }));
    expect(await homeWin()).toBeInTheDocument();
  });

  it("says the server can't be reached when the config can't be read, and tries again", async () => {
    const user = userEvent.setup();
    let fail = true;
    routes({
      config: () =>
        fail ? problem(503, "SERVICE_UNAVAILABLE") : json(200, KIOSK_CONFIG),
    });
    renderTerminal({ retry: false });

    const retry = await screen.findByRole("button", {
      name: new RegExp(en.terminal.offline.retry),
    });
    expect(boardReads()).toHaveLength(0);
    fail = false;
    await user.click(retry);
    expect(await kioskHeading()).toBeInTheDocument();
  });

  it("reads the status again when the kiosk's config is refused as not activated", async () => {
    let statusReads = 0;
    routes({
      status: () => {
        statusReads += 1;
        return json(
          200,
          statusReads === 1
            ? active()
            : { state: "inactive", reason: "expired" },
        );
      },
      config: () => problem(401, "AUTH_INVALID_CREDENTIALS"),
    });
    renderTerminal({ retry: false });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.activate.title),
      }),
    ).toBeInTheDocument();
    expect(statusReads).toBe(2);
  });

  it("reads the status again when a kiosk read is refused as not activated", async () => {
    let statusReads = 0;
    routes({
      status: () => {
        statusReads += 1;
        return json(
          200,
          statusReads === 1
            ? active()
            : { state: "inactive", reason: "expired" },
        );
      },
      board: () => problem(401, "AUTH_INVALID_CREDENTIALS"),
    });
    renderTerminal({ retry: false });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.activate.title),
      }),
    ).toBeInTheDocument();
    expect(statusReads).toBe(2);
  });
});

describe("picking prices into the kiosk's slip (F8ca AC-2)", () => {
  it("puts a tapped price in the player's slip and takes it out on a second tap", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();

    const price = await homeWin();
    expect(price).toHaveAttribute("aria-pressed", "false");
    expect(slip().getByText(en.betSlip.emptyTitle)).toBeInTheDocument();

    await user.click(price);
    expect(price).toHaveAttribute("aria-pressed", "true");
    expect(slip().getByText(matchName(FIRST))).toBeInTheDocument();
    expect(slip().getByText(HOME_WIN.label.en)).toBeInTheDocument();
    // In the pick's own row: the slip's total odds say it too, priced from
    // the start at the shop's minimum stake.
    const row = within(
      slip().getByRole("button", {
        name: en.betSlip.remove.replace("{pick}", HOME_WIN.label.en),
      }).parentElement!,
    );
    expect(row.getByText(formatOdds(HOME_WIN.odds!))).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: en.nav.slipAria.replace("{n}", "1"),
      }),
    ).toBeInTheDocument();

    await user.click(price);
    expect(price).toHaveAttribute("aria-pressed", "false");
    expect(slip().getByText(en.betSlip.emptyTitle)).toBeInTheDocument();
  });

  it("removes one pick and clears the slip", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();

    const second = BOARD[1].events[0];
    const away = second.markets.matchResult!.outcomes[2];
    await user.click(await homeWin());
    await user.click(
      screen.getByRole("button", { name: priceName(second, away) }),
    );
    expect(slip().getByText(matchName(second))).toBeInTheDocument();

    await user.click(
      slip().getByRole("button", {
        name: en.betSlip.remove.replace("{pick}", HOME_WIN.label.en),
      }),
    );
    expect(slip().queryByText(matchName(FIRST))).toBeNull();
    expect(slip().getByText(matchName(second))).toBeInTheDocument();

    await user.click(slip().getByRole("button", { name: en.betSlip.clearAll }));
    expect(slip().getByText(en.betSlip.emptyTitle)).toBeInTheDocument();
  });
});

describe("loading booking codes in the kiosk slip (F8ca AC-9)", () => {
  /** The contract's booking: the leg still on sale, and the one that started. */
  const [ON_SALE, STARTED] = BOOKING.legs;

  /** The slip's sheet, opened from its bar with `n` picks in it. */
  const openSlip = async (user: ReturnType<typeof userEvent.setup>, n = 0) => {
    await user.click(
      screen.getByRole("button", {
        name: en.nav.slipAria.replace("{n}", String(n)),
      }),
    );
    return within(screen.getByRole("dialog"));
  };

  /** A pick in the slip, by its Remove button (one per pick). */
  const pickNamed = (
    slip: ReturnType<typeof within>,
    pick: string | undefined,
  ) =>
    slip.queryByRole("button", {
      name: en.betSlip.remove.replace("{pick}", pick ?? ""),
    });

  it("loads a code's picks into the slip through the terminal, at the server's prices, and says what couldn't come", async () => {
    expect(ON_SALE.unavailable).toBeNull();
    expect(STARTED.unavailable).toBe("EVENT_STARTED");
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await homeWin();

    const slip = await openSlip(user);
    await user.type(slip.getByLabelText(en.betSlip.loadCode), "7kq2-m9x");
    await user.click(slip.getByRole("button", { name: en.betSlip.load }));

    // The leg still on sale is in the slip, at the server's price now, with
    // the code's price struck through beside it.
    await waitFor(() =>
      expect(pickNamed(slip, ON_SALE.outcomeName?.en)).not.toBeNull(),
    );
    expect(slip.getByText(ON_SALE.eventName!.en)).toBeInTheDocument();
    // The pick's own row (its Remove button's): the slip's total odds say
    // 2.10 too, now that it is priced (F8cb).
    const row = within(
      pickNamed(slip, ON_SALE.outcomeName?.en)!.parentElement!,
    );
    expect(
      row.getByText(formatOdds(ON_SALE.odds!), { exact: false }),
    ).toBeInTheDocument();
    expect(row.getByText(formatOdds(ON_SALE.oddsAtCode!))).toBeInTheDocument();
    // …and only it: the started match is said, not added.
    expect(
      slip.getAllByRole("button", {
        name: new RegExp(`^${en.betSlip.remove.replace("{pick}", ".+")}$`),
      }),
    ).toHaveLength(1);
    const notice = slip.getByTestId("booking-notice");
    expect(notice).toHaveTextContent(
      en.booking.loaded.replace("{code}", BOOKING.code),
    );
    expect(notice).toHaveTextContent(en.booking.reason.EVENT_STARTED);
    // The code's stake hint is the stake now (F8cb, the user's answer at the
    // plan gate), priced with the shop's rules.
    expect(BOOKING.stakeHint).toBe("50.00");
    expect(
      slip.getByRole("textbox", { name: en.betSlip.totalStake }),
    ).toHaveValue("50.00");
    expect(slip.getByTestId("net-payout")).toHaveTextContent(
      money(
        quote(
          {
            betType: "single",
            legs: [{ odds: ON_SALE.odds! }],
            stake: "50.00",
          },
          RETAIL.calc,
        ).netPayout,
        "en",
      ),
    );
    // Worked by hand (review M1): tax 7.50, net 42.50 × 2.10 = 89.25.
    expect(slip.getByTestId("net-payout")).toHaveTextContent("ETB 89.25");

    const call = asked.find((entry) =>
      entry.route.startsWith("/api/terminal/bookings/"),
    );
    expect(call?.route).toBe(`/api/terminal/bookings/${BOOKING.code}`);
    expect(call?.method).toBe("GET");
    expect(call?.headers["Accept-Language"]).toBe("en");
  });

  it("leaves the slip as it was when nothing in the code can be added, and says so", async () => {
    const user = userEvent.setup();
    routes({
      booking: () => json(200, { ...BOOKING, legs: [STARTED] }),
    });
    renderTerminal();
    await user.click(await homeWin());

    const slip = await openSlip(user, 1);
    await user.type(slip.getByLabelText(en.betSlip.loadCode), BOOKING.code);
    await user.click(slip.getByRole("button", { name: en.betSlip.load }));

    expect(await slip.findByTestId("booking-notice")).toHaveTextContent(
      en.booking.nothingAdded.replace("{code}", BOOKING.code),
    );
    // The pick tapped on the board is still there, and nothing else is.
    expect(pickNamed(slip, HOME_WIN.label.en)).not.toBeNull();
    expect(pickNamed(slip, STARTED.outcomeName?.en)).toBeNull();
  });

  it("books the slip as a code through the terminal once there is a pick, with one key per slip (the user's third review)", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await homeWin();
    // Nothing to book in an empty slip.
    expect(
      slip().queryByRole("button", { name: en.betSlip.bookBet }),
    ).toBeNull();

    await user.click(await homeWin());
    await user.click(slip().getByRole("button", { name: en.betSlip.bookBet }));

    // The code in a dialog over the slip: code, barcode, no Copy or Share.
    const box = await screen.findByRole("dialog", {
      name: en.betSlip.bookingCode,
    });
    const dialog = within(box);
    expect(box).toHaveAttribute("data-testid", "booking-code");
    expect(box).toHaveTextContent(BOOKED.code);
    expect(
      dialog.getByRole("img", {
        name: `${en.betSlip.bookingCode}: ${BOOKED.code}`,
      }),
    ).toBeInTheDocument();
    expect(
      dialog.queryByRole("button", { name: en.betSlip.copyCode }),
    ).toBeNull();
    expect(dialog.queryByRole("link", { name: /Telegram/ })).toBeNull();
    expect(screen.queryByText(en.betSlip.shareTelegram)).toBeNull();
    const calls = asked.filter(
      (call) => call.route === "/api/terminal/bookings",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    // The picks, and the stake the slip starts at: the shop's minimum.
    expect(JSON.parse(calls[0].body!)).toEqual({
      betType: "single",
      systemSizes: [],
      outcomeIds: [HOME_WIN.id],
      stake: "10.00",
    });
    // Done closes it; "Booked" opens it again, and books nothing more.
    await user.click(dialog.getByRole("button", { name: en.betSlip.done }));
    expect(
      screen.queryByRole("dialog", { name: en.betSlip.bookingCode }),
    ).toBeNull();
    await user.click(slip().getByRole("button", { name: en.booking.booked }));
    expect(
      await screen.findByRole("dialog", { name: en.betSlip.bookingCode }),
    ).toBeInTheDocument();
    expect(
      asked.filter((call) => call.route === "/api/terminal/bookings"),
    ).toHaveLength(1);
  });

  it("does not offer a loader when booking codes are disabled", async () => {
    routes({
      config: () => json(200, { ...KIOSK_CONFIG, bookingCodes: false }),
    });
    renderTerminal();
    await homeWin();
    expect(screen.queryByLabelText(en.betSlip.loadCode)).toBeNull();
  });

  it("rejects a malformed code before calling the booking route", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await homeWin();
    await user.click(
      screen.getByRole("button", {
        name: en.nav.slipAria.replace("{n}", "0"),
      }),
    );
    const input = within(screen.getByRole("dialog")).getByLabelText(
      en.betSlip.loadCode,
    );
    await user.type(input, "bad!");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: en.betSlip.load,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.booking.invalidCode,
    );
    expect(asked.some((entry) => entry.route.includes("/bookings/"))).toBe(
      false,
    );
  });
});

/** The contract's two rule sets: the shop's (`retail_betting`) and the online one. */
const RETAIL = toBettingRules(example("/v1/config/public").retail_betting!);
const ONLINE = toBettingRules(example("/v1/config/public").betting);

describe("the kiosk's slip, priced with the shop's rules (F8cb)", () => {
  /** The player's stake field, in the slip's column (the user's review: no keypad). */
  const stakeField = () =>
    slip().getByRole("textbox", { name: en.betSlip.totalStake });
  /** Types a stake in place of the one there (the shop's minimum at first). */
  const press = async (
    user: ReturnType<typeof userEvent.setup>,
    keys: string,
  ) => {
    await user.clear(stakeField());
    await user.type(stakeField(), keys);
  };
  const payout = () => slip().getByTestId("net-payout");
  const single = (odds: string, stake: string): Slip => ({
    betType: "single",
    legs: [{ odds }],
    stake,
  });

  it("types the stake in the player's stake field: digits, one point, two decimals at most, and clear; no keypad (F8cb AC-b1, the user's review)", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await user.click(await homeWin());

    expect(stakeField()).toHaveValue("10");
    // No on-screen keypad (the user's review, 2026-10-08).
    for (const key of ["1", "7", "0"]) {
      expect(slip().queryByRole("button", { name: key })).toBeNull();
    }

    // The player's rules: no leading zeros, one point, two decimals.
    await press(user, "0012.345.");
    expect(stakeField()).toHaveValue("12.34");
    await user.keyboard("{Backspace}{Backspace}");
    expect(stakeField()).toHaveValue("12.");
    await user.type(stakeField(), "5");
    expect(stakeField()).toHaveValue("12.5");
    expect(payout()).toHaveTextContent(
      money(quote(single(HOME_WIN.odds!, "12.5"), RETAIL.calc).netPayout, "en"),
    );
    // Worked by hand (review M1): tax 1.87, net 10.63 × 1.95 = 20.72.
    expect(payout()).toHaveTextContent("ETB 20.72");

    await user.click(
      slip().getByRole("button", { name: en.betSlip.clearStake }),
    );
    expect(stakeField()).toHaveValue("");
    expect(payout()).toHaveTextContent("—");
  });

  it("starts the stake at the shop's minimum, and books nothing under it — cleared or zero (F8cb AC-b1, the user's decisions)", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await user.click(await homeWin());

    // The shop's 10.00, not the online 5.00 (the user's decision, 2026-10-08).
    expect(stakeField()).toHaveValue("10");
    expect(payout()).toHaveTextContent("ETB 16.57");

    const book = () => slip().getByRole("button", { name: en.betSlip.bookBet });
    for (const stake of ["", "0"]) {
      await user.clear(stakeField());
      if (stake) await user.type(stakeField(), stake);
      expect(payout()).toHaveTextContent("—");
      expect(book()).toHaveAttribute("aria-disabled", "true");
      await user.click(book());
    }
    expect(
      asked.some((entry) => entry.route === "/api/terminal/bookings"),
    ).toBe(false);
  });

  it("says the shop's minimum at the stake field — 10.00, not the online 5.00 — and books nothing under it (F8cb AC-3, the user's decision)", async () => {
    // Online, 5.00 would be priced.
    expect(() => quote(single(HOME_WIN.odds!, "5"), ONLINE.calc)).not.toThrow();
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await user.click(await homeWin());

    await press(user, "5");
    // A red border and the minimum below the field; no alert (the user's
    // decision, 2026-10-08).
    expect(stakeField()).toHaveAttribute("aria-invalid", "true");
    expect(stakeField()).toHaveAccessibleDescription(
      /^Minimum stake ETB\s10\.00$/,
    );
    expect(slip().queryByRole("alert")).toBeNull();
    expect(payout()).toHaveTextContent("—");
    expect(
      slip().getByRole("button", { name: en.betSlip.bookBet }),
    ).toHaveAttribute("aria-disabled", "true");

    await press(user, "10");
    expect(stakeField()).not.toHaveAttribute("aria-invalid");
    expect(payout()).toHaveTextContent(
      money(quote(single(HOME_WIN.odds!, "10"), RETAIL.calc).netPayout, "en"),
    );
    // Worked by hand (review M1): tax 1.50, net 8.50 × 1.95 = 16.57.
    expect(payout()).toHaveTextContent("ETB 16.57");
  });

  it("prices a multiple with the shop's rules: no accumulator bonus, and slipcalc's payout to the santim (F8cb AC-3)", async () => {
    // The contract's board with Real Madrid v Barcelona's 1X2 open again,
    // so three matches can be combined.
    const items = example("/v1/events").items.map((item) =>
      item.main?.status === "suspended"
        ? {
            ...item,
            main: {
              ...item.main,
              status: "active" as const,
              outcomes: item.main.outcomes.map((o) => ({ ...o, active: true })),
            },
          }
        : item,
    );
    const board = boardOf(items);
    const homes = board.flatMap((section) =>
      section.events.map((row) => ({
        row,
        outcome: row.markets.matchResult!.outcomes[0],
      })),
    );
    expect(homes).toHaveLength(3);
    const multiple: Slip = {
      betType: "multiple",
      legs: homes.map(({ outcome }) => ({ odds: outcome.odds! })),
      stake: "100",
    };
    const shop = quote(multiple, RETAIL.calc);
    const online = quote(multiple, ONLINE.calc);
    // Online, three picks at 1.30 or more earn a bonus; the shop's table is empty.
    expect(online.accaBonus).not.toBe("0.00");
    expect(shop.accaBonus).toBe("0.00");
    expect(shop.netPayout).not.toBe(online.netPayout);
    // Worked by hand (review M1): net 85.00 × 10.03275 = 852.78; online adds
    // 3 % of the profit, 23.03.
    expect([shop.netPayout, online.netPayout]).toEqual(["852.78", "875.81"]);

    const user = userEvent.setup();
    routes({ board: () => json(200, board) });
    renderTerminal();
    await homeWin();
    for (const { row, outcome } of homes) {
      await user.click(
        screen.getByRole("button", { name: priceName(row, outcome) }),
      );
    }
    await user.click(slip().getByRole("button", { name: en.betSlip.multiple }));
    await press(user, "100");

    expect(payout()).toHaveTextContent(money(shop.netPayout, "en"));
    expect(payout()).toHaveTextContent("ETB 852.78");
    expect(
      slip().getByText(formatOdds(shop.totalOdds!), { exact: false }),
    ).toBeInTheDocument();
    expect(slip().queryByText(en.betSlip.accaBonus)).toBeNull();
    expect(slip().queryByText(money(online.netPayout, "en"))).toBeNull();
  });

  it("offers the shop's quick stakes when its rule set has them, each setting the total (F8cb, review S2)", async () => {
    const user = userEvent.setup();
    const rules = { ...RETAIL, quickStakes: ["20.00", "50.00"] };
    routes({ config: () => json(200, { ...KIOSK_CONFIG, rules }) });
    renderTerminal();
    await user.click(await homeWin());

    await user.click(slip().getByRole("button", { name: "50" }));
    expect(stakeField()).toHaveValue("50");
    await user.click(slip().getByRole("button", { name: "20" }));
    expect(stakeField()).toHaveValue("20");
    // The online set's quick stakes (100, 500) are not offered.
    expect(slip().queryByRole("button", { name: "500" })).toBeNull();
  });

  it("books the stake typed as the code's hint, and offers the server's stake when it refuses it (F8cb AC-b1)", async () => {
    const answers = [
      () =>
        json(422, {
          type: "about:blank",
          title: "Refused",
          status: 422,
          code: "BET_STAKE_TOO_HIGH",
          errors: [{ field: "stake", code: "MAX", limit: "40.00" }],
        }),
      () => json(201, BOOKED),
    ];
    const user = userEvent.setup();
    routes({ bookBet: () => answers.shift()!() });
    renderTerminal();
    await user.click(await homeWin());
    await press(user, "50");

    await user.click(slip().getByRole("button", { name: en.betSlip.bookBet }));
    const alert = within(await slip().findByRole("alert"));
    expect(
      alert.getByText(
        en.betSlip.errors.stakeTooHighBody.replace(
          "{amount}",
          money("40.00", "en"),
        ),
      ),
    ).toBeInTheDocument();
    await user.click(
      alert.getByRole("button", {
        name: en.betSlip.setMax.replace("{amount}", "40.00"),
      }),
    );
    expect(stakeField()).toHaveValue("40.00");

    await user.click(slip().getByRole("button", { name: en.betSlip.bookBet }));
    await screen.findByRole("dialog", { name: en.betSlip.bookingCode });
    const bodies = asked
      .filter((entry) => entry.route === "/api/terminal/bookings")
      .map((entry) => JSON.parse(entry.body!));
    expect(bodies.map((body) => body.stake)).toEqual(["50.00", "40.00"]);
  });

  it("shows no balance, no log in and no place button — only Book bet (F8cb AC-b2)", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await user.click(await homeWin());
    await press(user, "50");
    expect(payout()).not.toHaveTextContent("—");

    expect(slip().queryByText(en.betSlip.balance, { exact: false })).toBeNull();
    for (const name of [en.betSlip.loginToBet, en.betSlip.placeBet]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(
      slip().getByRole("button", { name: en.betSlip.bookBet }),
    ).toBeInTheDocument();
    // Nothing but the terminal's own routes: no session, wallet or online config.
    expect(
      asked.every((entry) => entry.route.startsWith("/api/terminal/")),
    ).toBe(true);
  });

  it("shows the picks without any figure when the tenant has no shop rule set, never the online one's (F8cb AC-b2)", async () => {
    const user = userEvent.setup();
    routes({ config: () => json(200, { ...KIOSK_CONFIG, rules: null }) });
    renderTerminal();
    await user.click(await homeWin());

    expect(slip().getByText(matchName(FIRST))).toBeInTheDocument();
    // A notice, as the slip's others are (review U6).
    expect(
      slip().getByText(en.terminal.kiosk.noRules).closest('[role="status"]'),
    ).not.toBeNull();
    expect(
      slip().queryByRole("textbox", { name: en.betSlip.totalStake }),
    ).toBeNull();
    expect(slip().queryByTestId("net-payout")).toBeNull();
    expect(slip().queryByText(en.betSlip.totalOdds)).toBeNull();
    expect(slip().queryByText(/ETB|ብር/)).toBeNull();

    // A code's stake hint comes into the slip, but is neither shown nor sent.
    const sheet = within(
      await (async () => {
        await user.click(
          screen.getByRole("button", {
            name: en.nav.slipAria.replace("{n}", "1"),
          }),
        );
        return screen.getByRole("dialog");
      })(),
    );
    await user.type(sheet.getByLabelText(en.betSlip.loadCode), BOOKING.code);
    await user.click(sheet.getByRole("button", { name: en.betSlip.load }));
    await sheet.findByTestId("booking-notice");
    expect(useBetSlipStore.getState().stake).toBe("50.00");
    expect(sheet.queryByText(/ETB|ብር|50\.00/)).toBeNull();
    await user.click(sheet.getByRole("button", { name: en.betSlip.bookBet }));
    await screen.findByRole("dialog", { name: en.betSlip.bookingCode });
    const call = asked.find(
      (entry) => entry.route === "/api/terminal/bookings",
    );
    expect(JSON.parse(call!.body!)).toMatchObject({ stake: null });
  });
});

describe("the kiosk starting (F8ca AC-1, rework 2)", () => {
  /** A route that answers only when the test says. */
  const held = () => {
    let release!: () => void;
    const answer = new Promise<void>((resolve) => (release = resolve));
    return { answer, release };
  };

  it("starts as the main page does — its bar and the board's rows to come — while the status and then the config are read, and reads nothing else", async () => {
    const status = held();
    const config = held();
    routes({
      status: async () => (await status.answer, json(200, active())),
      config: async () => (await config.answer, json(200, KIOSK_CONFIG)),
    });
    renderTerminal();

    const starting = async () => {
      // The page itself, as the main page looks while it loads: the
      // terminal's bar, the sidebar's cards and the board's rows to come —
      // inert, with nothing priced — and a screen reader told the terminal
      // is starting, in the page's language. No spinner, no message.
      const bar = screen.getByRole("banner");
      expect(
        within(bar).getByRole("link", { name: /KelalSport/ }),
      ).toHaveAttribute("href", "/");
      expect(bar.closest("[inert]")).not.toBeNull();
      expect(screen.getByText(en.sidebar.topCompetitions)).toBeInTheDocument();
      expect(screen.getByTestId("board-skeleton")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: priceName(FIRST, HOME_WIN) }),
      ).toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent(en.terminal.loading);
      expect(screen.queryByText(am.terminal.loading)).toBeNull();
    };

    await waitFor(() => expect(reads("/api/terminal/status")).toHaveLength(1));
    await starting();

    status.release();
    await waitFor(() => expect(reads("/api/terminal/config")).toHaveLength(1));
    await starting();
    // Nothing of the catalogue until the kiosk knows it sells.
    expect(asked.map((call) => call.route)).toEqual([
      "/api/terminal/status",
      "/api/terminal/config",
    ]);

    config.release();
    await homeWin();
    expect(screen.getByRole("banner").closest("[inert]")).toBeNull();
    expect(screen.queryByTestId("board-skeleton")).toBeNull();
  });

  it("holds a match page's book too while the terminal starts, and reads it once the kiosk is up", async () => {
    const status = held();
    routes({ status: async () => (await status.answer, json(200, active())) });
    renderTerminal({ page: <EventDetailView eventId={EVENT.event.id} /> });

    await waitFor(() => expect(reads("/api/terminal/status")).toHaveLength(1));
    expect(reads("/api/terminal/catalogue/events/")).toHaveLength(0);

    status.release();
    await waitFor(() =>
      expect(reads("/api/terminal/catalogue/events/")).toHaveLength(1),
    );
    expect(reads("/api/terminal/config")).toHaveLength(1);
  });
});

describe("the kiosk's language (F8ca AC-3)", () => {
  const switchTo = (lang: "en" | "am") =>
    screen.getByRole("button", { name: lang === "en" ? "EN" : "አማ" });

  it("opens in English and switches to Amharic with one tap", async () => {
    const user = userEvent.setup();
    // The contract's tenant offers both, with Amharic as its default: the
    // kiosk opens in English all the same (the user's decision, rework 2).
    expect(KIOSK_CONFIG.defaultLanguage).toBe("am");
    routes();
    renderTerminal();

    await homeWin();
    expect(document.documentElement.lang).toBe("en");
    expect(switchTo("en")).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: en.board.filters.top }),
    ).toBeInTheDocument();

    await user.click(switchTo("am"));
    expect(document.documentElement.lang).toBe("am");
    expect(
      screen.getByRole("button", { name: am.board.filters.top }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2, name: am.betSlip.title })
        .length,
    ).toBeGreaterThan(0);

    await user.click(switchTo("en"));
    expect(document.documentElement.lang).toBe("en");
  });

  it("asks in the kiosk's language", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await homeWin();
    expect(boardReads().at(-1)!.headers["Accept-Language"]).toBe("en");

    await user.click(switchTo("am"));
    await user.click(
      screen.getByRole("button", { name: am.board.filters.upcoming }),
    );
    await waitFor(() =>
      expect(lastBoardQuery().get("filter")).toBe("upcoming"),
    );
    expect(boardReads().at(-1)!.headers["Accept-Language"]).toBe("am");
  });

  it("opens in the tenant's default where it doesn't offer English", async () => {
    routes({
      config: () =>
        json(200, {
          ...KIOSK_CONFIG,
          languages: ["am"],
          defaultLanguage: "am",
        }),
    });
    renderTerminal();
    expect(
      await screen.findByRole("button", { name: am.board.filters.top }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("am");
  });

  it("falls back to English, on screen and in its calls, when the language chosen is no longer offered", async () => {
    const user = userEvent.setup();
    routes();
    const { queryClient } = renderTerminal();
    await homeWin();
    await user.click(switchTo("am"));
    expect(document.documentElement.lang).toBe("am");

    // The tenant now offers English only.
    act(() =>
      queryClient.setQueryData(terminalKeys.config(), {
        ...KIOSK_CONFIG,
        languages: ["en"],
        defaultLanguage: "en",
      }),
    );
    expect(
      await screen.findByRole("button", { name: en.board.filters.top }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    await user.click(
      screen.getByRole("button", { name: en.board.filters.upcoming }),
    );
    await waitFor(() =>
      expect(lastBoardQuery().get("filter")).toBe("upcoming"),
    );
    expect(boardReads().at(-1)!.headers["Accept-Language"]).toBe("en");
  });

  it("offers no switch when the tenant has one language", async () => {
    routes({
      config: () =>
        json(200, {
          ...KIOSK_CONFIG,
          languages: ["en"],
          defaultLanguage: "en",
        }),
    });
    renderTerminal();
    await homeWin();
    // No switch at all: not even the one language's own pill.
    expect(screen.queryByRole("button", { name: "EN" })).toBeNull();
    expect(screen.queryByRole("button", { name: "አማ" })).toBeNull();
  });
});

describe("the slip below xl, and prices offline (F8ca AC-2)", () => {
  it("returns focus to the slip's bar when its sheet closes", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await user.click(await homeWin());

    const bar = screen.getByRole("button", {
      name: en.nav.slipAria.replace("{n}", "1"),
    });
    await user.click(bar);
    const sheet = await screen.findByRole("dialog");
    await user.click(
      within(sheet).getByRole("button", { name: en.betSlip.close }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(bar).toHaveFocus();
  });

  it("locks every price while the PC is offline, and opens them when it is back", async () => {
    routes();
    renderTerminal();
    const price = await homeWin();
    expect(price).toBeEnabled();

    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(
      screen.getByRole("button", {
        name: new RegExp(
          `^${matchName(FIRST)}: ${HOME_WIN.label.en}, ${en.a11y.suspended}`,
        ),
      }),
    ).toBeDisabled();

    online.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(await homeWin()).toBeEnabled();
  });
});

describe("a tenant without shop betting (F8ca AC-4)", () => {
  it("says betting isn't available here, with no board and no slip, when retail is off", async () => {
    routes({ config: () => json(200, { ...KIOSK_CONFIG, retail: false }) });
    const { queryClient } = renderTerminal();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.kiosk.unavailable.title),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.kiosk.unavailable.title),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(
      asked.filter((a) => a.route.startsWith("/api/terminal/catalogue/")),
    ).toHaveLength(0);
    expect(screen.queryByText(TERMINAL.shop.name)).toBeNull();
    expect(queryClient.getQueryData(terminalKeys.config())).toMatchObject({
      retail: false,
    });
  });
});

describe("a league and a match on the kiosk (F8ca AC-6, AC-7)", () => {
  it("links the sidebar's leagues and each match to the kiosk's own pages", async () => {
    routes();
    renderTerminal();
    await homeWin();

    expect(
      screen.getByRole("link", {
        name: new RegExp(TOP_COMPETITIONS[0].name.en),
      }),
    ).toHaveAttribute(
      "href",
      `/terminal/competition/${encodeURIComponent(TOP_COMPETITIONS[0].id)}`,
    );
    const more = screen.getAllByRole("link", {
      name: en.board.moreMarketsAria.replace(
        "{n}",
        String(FIRST.event.marketCount),
      ),
    })[0];
    expect(more).toHaveAttribute(
      "href",
      `/terminal/event/${encodeURIComponent(FIRST.event.id)}`,
    );
  });

  it("shows a league's own board on its page (AC-6)", async () => {
    routes();
    const section = BOARD[1];
    const row = section.events[0];
    renderTerminal({
      page: <CompetitionView competitionId={section.competition.id} />,
    });
    expect(
      await screen.findByRole("button", {
        name: priceName(row, row.markets.matchResult!.outcomes[0]),
      }),
    ).toBeInTheDocument();
    expect(lastBoardQuery().get("competition")).toBe(section.competition.id);
  });

  it("shows a match's whole book on its page, and the way home (AC-7)", async () => {
    routes();
    renderTerminal({ page: <EventDetailView eventId={EVENT.event.id} /> });

    // A market of the book, priced as the player's match page shows it.
    const market = EVENT.markets.find(
      (m) => m.status === "open" && m.outcomes.some((o) => o.odds !== null),
    )!;
    const outcome = market.outcomes.find((o) => o.odds !== null)!;
    expect(
      (
        await screen.findAllByRole("button", {
          name: new RegExp(
            `${outcome.label.en} ${formatOdds(outcome.odds!).replace(".", "\\.")}`,
          ),
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(
      reads(
        `/api/terminal/catalogue/events/${encodeURIComponent(EVENT.event.id)}`,
      ),
    ).toHaveLength(1);
    // The match header's own way back (not the brand's link), to the kiosk's home.
    expect(
      screen.getByRole("link", { name: new RegExp(en.event.backToBoard) }),
    ).toHaveAttribute("href", "/");
  });

  it("says a match isn't there when the terminal has no book for it (in play, or gone)", async () => {
    routes({ event: () => json(200, null) });
    renderTerminal({ page: <EventDetailView eventId={EVENT.event.id} /> });
    expect(await screen.findByText(en.event.notFound)).toBeInTheDocument();
  });
});

describe("search on the kiosk (F8ca AC-8)", () => {
  it("finds a league through the terminal and opens it on the kiosk's page", async () => {
    const user = userEvent.setup();
    const league = BOARD[1].competition;
    routes({
      search: () =>
        json(200, {
          leagues: [{ competition: league, eventCount: 3 }],
          events: [],
        }),
    });
    renderTerminal();
    await homeWin();

    await user.type(
      screen.getByRole("combobox", { name: en.header.search }),
      "pre",
    );
    const option = await screen.findByRole("option", {
      name: new RegExp(league.name.en),
    });
    await user.click(option);
    expect(address.href).toBe(
      `/terminal/competition/${encodeURIComponent(league.id)}`,
    );
  });

  it("searches through the terminal and opens a match on the kiosk's page", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await homeWin();

    await user.type(
      screen.getByRole("combobox", { name: en.header.search }),
      "ars",
    );
    const row = SEARCH.events[0];
    const option = await screen.findByRole("option", {
      name: new RegExp(row.event.home.name.en),
    });
    expect(lastQuery("/api/terminal/catalogue/search").get("q")).toBe("ars");

    await user.click(option);
    expect(address.href).toBe(
      `/terminal/event/${encodeURIComponent(row.event.id)}`,
    );
  });
});

describe("the kiosk over time (F8ca AC-1)", () => {
  /** Moves the fake clock on by `ms`, then lets every answer it released land. */
  async function tick(ms: number) {
    await act(() => vi.advanceTimersByTimeAsync(ms));
    for (let i = 0; i < 10; i += 1) {
      await act(() => vi.advanceTimersByTimeAsync(0));
    }
  }

  /** Timers and the date fake; WebCrypto and the rest real (TerminalStatus.test.tsx). */
  function fakeClock(now: string) {
    vi.useFakeTimers({
      now: Date.parse(now),
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    });
    notifyManager.setScheduler((cb) => queueMicrotask(cb));
  }

  it("moves its board and its day strip to the new day at midnight", async () => {
    // 23:59:58 in Addis Ababa.
    fakeClock("2026-10-04T20:59:58Z");
    routes();
    renderTerminal();
    for (let i = 0; i < 20 && boardReads().length === 0; i += 1) await tick(0);
    expect(lastBoardQuery().get("date")).toBe(TODAY);

    await tick(3_000);
    expect(lastBoardQuery().get("date")).toBe(TOMORROW);
    expect(
      screen.getByRole("button", {
        name: new RegExp(en.board.filters.today),
        pressed: true,
      }),
    ).toBeInTheDocument();
  });

  it("reads the board again every 30 s, so a match that has kicked off leaves it (D5, D8)", async () => {
    fakeClock("2026-10-04T08:00:00Z");
    let kickedOff = false;
    routes({
      // The terminal's route answers before-kick-off matches only.
      board: () =>
        json(
          200,
          kickedOff
            ? BOARD.map((section, i) =>
                i === 0
                  ? { ...section, events: section.events.slice(1) }
                  : section,
              ).filter((section) => section.events.length > 0)
            : BOARD,
        ),
    });
    renderTerminal();
    for (let i = 0; i < 20 && boardReads().length === 0; i += 1) await tick(0);
    await tick(0);
    expect(
      screen.getByRole("button", { name: priceName(FIRST, HOME_WIN) }),
    ).toBeInTheDocument();
    const before = boardReads().length;

    kickedOff = true;
    await tick(30_000);
    expect(boardReads().length).toBeGreaterThan(before);
    expect(
      screen.queryByRole("button", { name: priceName(FIRST, HOME_WIN) }),
    ).toBeNull();
  });

  it("reads the sports again by itself when they couldn't be read", async () => {
    fakeClock("2026-10-04T08:00:00Z");
    let fail = true;
    routes({
      sports: () =>
        fail ? problem(503, "SERVICE_UNAVAILABLE") : json(200, SPORTS),
    });
    renderTerminal({ retry: false });
    const sportsReads = () => reads("/api/terminal/catalogue/sports");
    for (let i = 0; i < 20 && sportsReads().length === 0; i += 1) {
      await tick(0);
    }
    const failed = sportsReads().length;
    fail = false;
    await tick(30_000);
    expect(sportsReads().length).toBeGreaterThan(failed);
    expect(
      screen.getAllByRole("button", { name: new RegExp(SPORTS[1].name.en) })
        .length,
    ).toBeGreaterThan(0);
  });
});
