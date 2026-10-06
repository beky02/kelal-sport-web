import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { notifyManager } from "@tanstack/react-query";
import { CompetitionView } from "@/features/competitions/components/CompetitionView";
import { EventDetailView } from "@/features/events/components/EventDetailView";
import { createDeviceKey } from "@/features/terminal/lib/device-key";
import { formatOdds } from "@/lib/i18n/format";
import am from "@/lib/i18n/messages/am.json";
import en from "@/lib/i18n/messages/en.json";
import { terminalKeys } from "@/lib/query/keys";
import { address } from "./navigation";
import {
  BOARD,
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
  `${row.event.home.name.am} – ${row.event.away.name.am}`;
/** A price's accessible name, as the player's board gives it. */
const priceName = (
  row: Row,
  outcome: { label: { am: string }; odds: string | null },
) =>
  new RegExp(
    `^${matchName(row)}: ${outcome.label.am} ${formatOdds(outcome.odds!).replace(".", "\\.")}`,
  );
const homeWin = () =>
  screen.findByRole("button", { name: priceName(FIRST, HOME_WIN) });

/** The slip's column, by the slip's own heading. */
const slip = () =>
  within(
    screen
      .getAllByRole("heading", { level: 2, name: am.betSlip.title })[0]
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
        screen.getAllByRole("button", { name: new RegExp(sport.name.am) })
          .length,
      ).toBeGreaterThan(0);
    }
    // Today first in the day strip, pressed.
    expect(
      screen.getByRole("button", {
        name: new RegExp(am.board.filters.today),
        pressed: true,
      }),
    ).toBeInTheDocument();

    // Every match and its 1X2 prices as sent; a price the API left out locked.
    for (const section of BOARD) {
      expect(
        screen.getAllByText(section.competition.name.am).length,
      ).toBeGreaterThan(0);
      for (const row of section.events) {
        for (const outcome of row.markets.matchResult!.outcomes) {
          const price = screen.getByRole("button", {
            name:
              outcome.odds === null
                ? new RegExp(
                    `^${matchName(row)}: ${outcome.label.am}, ${am.a11y.suspended}`,
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
        name: new RegExp(TOP_COMPETITIONS[0].name.am),
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
      am.header.login,
      am.header.register,
      am.nav.myBets,
      am.nav.wallet,
      am.header.responsibleGaming,
      am.betSlip.myBets,
    ]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
    expect(
      screen.queryByRole("button", { name: am.sidebar.addFavourite }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: am.sidebar.pinLeague }),
    ).toBeNull();
    expect(screen.queryByText(am.sidebar.favourites)).toBeNull();
    // The shop this PC belongs to is named in the bar.
    expect(screen.getByText(TERMINAL.shop.name)).toBeInTheDocument();
  });

  it("carries the licence, the age limit and the helpline, with no link to the player's pages (SRS RG-05, review U6)", async () => {
    routes();
    renderTerminal();
    await homeWin();

    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByText(am.sidebar.licence)).toBeInTheDocument();
    expect(footer.getByText("21+")).toBeInTheDocument();
    expect(footer.getByText(am.sidebar.playResponsibly)).toBeInTheDocument();
    expect(footer.getByText(am.footer.helpline)).toBeInTheDocument();
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
      name: new RegExp(am.board.filters.today),
      pressed: true,
    });
    const strip = today.parentElement!;
    await user.click(within(strip).getAllByRole("button")[1]);
    await waitFor(() => expect(lastBoardQuery().get("date")).toBe(TOMORROW));
    expect(address.params.get("date")).toBe(TOMORROW);

    const other = SPORTS[1];
    await user.click(
      screen.getAllByRole("button", { name: new RegExp(other.name.am) })[0],
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

    expect(await screen.findByText(am.board.empty.title)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: am.board.empty.action }),
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

    expect(await screen.findByText(am.board.error.title)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: am.common.retry }));
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
    expect(slip().getByText(am.betSlip.emptyTitle)).toBeInTheDocument();

    await user.click(price);
    expect(price).toHaveAttribute("aria-pressed", "true");
    expect(slip().getByText(matchName(FIRST))).toBeInTheDocument();
    expect(slip().getByText(HOME_WIN.label.am)).toBeInTheDocument();
    expect(slip().getByText(formatOdds(HOME_WIN.odds!))).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: am.nav.slipAria.replace("{n}", "1"),
      }),
    ).toBeInTheDocument();

    await user.click(price);
    expect(price).toHaveAttribute("aria-pressed", "false");
    expect(slip().getByText(am.betSlip.emptyTitle)).toBeInTheDocument();
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
        name: am.betSlip.remove.replace("{pick}", HOME_WIN.label.am),
      }),
    );
    expect(slip().queryByText(matchName(FIRST))).toBeNull();
    expect(slip().getByText(matchName(second))).toBeInTheDocument();

    await user.click(slip().getByRole("button", { name: am.betSlip.clearAll }));
    expect(slip().getByText(am.betSlip.emptyTitle)).toBeInTheDocument();
  });
});

describe("the kiosk's language (F8ca AC-3)", () => {
  const switchTo = (lang: "en" | "am") =>
    screen.getByRole("button", { name: lang === "en" ? "EN" : "አማ" });

  it("opens in the tenant's default language and switches with one tap", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();

    await homeWin();
    expect(document.documentElement.lang).toBe("am");
    expect(switchTo("am")).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: am.board.filters.top }),
    ).toBeInTheDocument();

    await user.click(switchTo("en"));
    expect(document.documentElement.lang).toBe("en");
    expect(
      screen.getByRole("button", { name: en.board.filters.top }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2, name: en.betSlip.title })
        .length,
    ).toBeGreaterThan(0);

    await user.click(switchTo("am"));
    expect(document.documentElement.lang).toBe("am");
  });

  it("asks in the kiosk's language", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await homeWin();
    expect(boardReads().at(-1)!.headers["Accept-Language"]).toBe("am");

    await user.click(switchTo("en"));
    await user.click(
      screen.getByRole("button", { name: en.board.filters.upcoming }),
    );
    await waitFor(() =>
      expect(lastBoardQuery().get("filter")).toBe("upcoming"),
    );
    expect(boardReads().at(-1)!.headers["Accept-Language"]).toBe("en");
  });

  it("starts in English for a tenant whose default is English", async () => {
    routes({
      config: () => json(200, { ...KIOSK_CONFIG, defaultLanguage: "en" }),
    });
    renderTerminal();
    expect(
      await screen.findByRole("button", { name: en.board.filters.top }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });

  it("falls back to the tenant's default, on screen and in its calls, when the language chosen is no longer offered", async () => {
    const user = userEvent.setup();
    routes();
    const { queryClient } = renderTerminal();
    await homeWin();
    await user.click(switchTo("en"));
    expect(document.documentElement.lang).toBe("en");

    // The tenant now offers Amharic only.
    act(() =>
      queryClient.setQueryData(terminalKeys.config(), {
        ...KIOSK_CONFIG,
        languages: ["am"],
        defaultLanguage: "am",
      }),
    );
    expect(
      await screen.findByRole("button", { name: am.board.filters.top }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("am");
    await user.click(
      screen.getByRole("button", { name: am.board.filters.upcoming }),
    );
    await waitFor(() =>
      expect(lastBoardQuery().get("filter")).toBe("upcoming"),
    );
    expect(boardReads().at(-1)!.headers["Accept-Language"]).toBe("am");
  });

  it("offers no switch when the tenant has one language", async () => {
    routes({
      config: () =>
        json(200, {
          ...KIOSK_CONFIG,
          languages: ["am"],
          defaultLanguage: "am",
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
      name: am.nav.slipAria.replace("{n}", "1"),
    });
    await user.click(bar);
    const sheet = await screen.findByRole("dialog");
    await user.click(
      within(sheet).getByRole("button", { name: am.betSlip.close }),
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
          `^${matchName(FIRST)}: ${HOME_WIN.label.am}, ${am.a11y.suspended}`,
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
        name: new RegExp(am.terminal.kiosk.unavailable.title),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(
      asked.filter((a) => a.route.startsWith("/api/terminal/catalogue/")),
    ).toHaveLength(0);
    // The shop is still named, as on the closed screen.
    expect(screen.getByText(TERMINAL.shop.name)).toBeInTheDocument();
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
        name: new RegExp(TOP_COMPETITIONS[0].name.am),
      }),
    ).toHaveAttribute(
      "href",
      `/terminal/competition/${encodeURIComponent(TOP_COMPETITIONS[0].id)}`,
    );
    const more = screen.getAllByRole("link", {
      name: am.board.moreMarketsAria.replace(
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
            `${outcome.label.am} ${formatOdds(outcome.odds!).replace(".", "\\.")}`,
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
      screen.getByRole("link", { name: new RegExp(am.event.backToBoard) }),
    ).toHaveAttribute("href", "/");
  });

  it("says a match isn't there when the terminal has no book for it (in play, or gone)", async () => {
    routes({ event: () => json(200, null) });
    renderTerminal({ page: <EventDetailView eventId={EVENT.event.id} /> });
    expect(await screen.findByText(am.event.notFound)).toBeInTheDocument();
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
      screen.getByRole("combobox", { name: am.header.search }),
      "pre",
    );
    const option = await screen.findByRole("option", {
      name: new RegExp(league.name.am),
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
      screen.getByRole("combobox", { name: am.header.search }),
      "ars",
    );
    const row = SEARCH.events[0];
    const option = await screen.findByRole("option", {
      name: new RegExp(row.event.home.name.am),
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
        name: new RegExp(am.board.filters.today),
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
      screen.getAllByRole("button", { name: new RegExp(SPORTS[1].name.am) })
        .length,
    ).toBeGreaterThan(0);
  });
});
