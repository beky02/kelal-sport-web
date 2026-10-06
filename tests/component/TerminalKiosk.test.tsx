import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { notifyManager } from "@tanstack/react-query";
import { createDeviceKey } from "@/features/terminal/lib/device-key";
import { formatOdds } from "@/lib/i18n/format";
import am from "@/lib/i18n/messages/am.json";
import en from "@/lib/i18n/messages/en.json";
import { terminalKeys } from "@/lib/query/keys";
import { address } from "./navigation";
import {
  BOARD,
  KIOSK_CONFIG,
  SPORTS,
  TERMINAL,
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
// date is fake here; the midnight test below fakes the timers too.
beforeEach(async () => {
  keys.pair = await createDeviceKey();
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  notifyManager.setScheduler((cb) => setTimeout(cb, 0));
});

const boardReads = () =>
  asked.filter((a) => a.route.startsWith("/api/terminal/catalogue/board"));
const lastBoardQuery = () =>
  new URL(boardReads().at(-1)!.route, "http://terminal.localhost").searchParams;

/** The contract's first match on the board, and its 1X2 market. */
const FIRST = BOARD[0].events[0];
const HOME_WIN = FIRST.markets.matchResult!.outcomes[0];
const homeWinLabel = (lang: "en" | "am" = "am") =>
  new RegExp(
    `${FIRST.event.home.name[lang]}.*${HOME_WIN.label[lang]} ${formatOdds(HOME_WIN.odds!).replace(".", "\\.")}`,
  );

/** What a competition's heading says: its country, then its name (a continental cup has none). */
const headingOf = ({ competition }: (typeof BOARD)[number]) =>
  competition.region.code === null
    ? competition.name.am
    : `${competition.region.name.am} · ${competition.name.am}`;

/** A competition's section on the board, named by its heading. */
const sectionOf = (section: (typeof BOARD)[number]) =>
  screen.getByRole("region", { name: headingOf(section) });

/** The slip panel, by its heading. */
const slipPanel = () =>
  screen.getByRole("complementary", { name: am.betSlip.title });

describe("the kiosk's board (F8ca AC-1)", () => {
  it("shows the sports, the days and the board's matches with their prices once the terminal is active", async () => {
    routes();
    renderTerminal();

    expect(await kioskHeading()).toBeInTheDocument();
    // The sport tabs, from /v1/sports.
    const tabs = screen.getByRole("navigation", { name: am.nav.sports });
    await within(tabs).findByRole("button", { name: SPORTS[0].name.am });
    for (const sport of SPORTS) {
      expect(
        within(tabs).getByRole("button", { name: sport.name.am }),
      ).toBeInTheDocument();
    }
    expect(
      within(tabs).getByRole("button", { name: SPORTS[0].name.am }),
    ).toHaveAttribute("aria-pressed", "true");
    // Today first, then five more days.
    const days = screen.getByRole("group", { name: am.terminal.kiosk.days });
    const dayButtons = within(days).getAllByRole("button");
    expect(dayButtons).toHaveLength(6);
    expect(dayButtons[0]).toHaveTextContent(am.board.filters.today);
    expect(dayButtons[0]).toHaveAttribute("aria-pressed", "true");

    // Every match of the board, in its competition, with its 1X2 prices as sent.
    await screen.findByRole("button", { name: homeWinLabel() });
    for (const section of BOARD) {
      const inSection = within(sectionOf(section));
      for (const { event, markets } of section.events) {
        expect(inSection.getByText(event.home.name.am)).toBeInTheDocument();
        expect(inSection.getByText(event.away.name.am)).toBeInTheDocument();
        for (const outcome of markets.matchResult!.outcomes) {
          // A price the API left out is locked, and says so.
          const name =
            outcome.odds === null
              ? `${outcome.label.am}, ${am.a11y.suspended}`
              : `${outcome.label.am} ${formatOdds(outcome.odds)}`;
          const price = inSection.getByRole("button", {
            name: new RegExp(`: ${name.replace(".", "\\.")}`),
          });
          expect(price).toBeInTheDocument();
          if (outcome.odds === null) expect(price).toBeDisabled();
        }
      }
    }
  });

  it("names each competition with its country, so two Premier Leagues can be told apart", async () => {
    routes();
    renderTerminal();
    await screen.findByRole("button", { name: homeWinLabel() });
    for (const section of BOARD) {
      expect(
        within(sectionOf(section)).getByRole("heading", { level: 2 }),
      ).toHaveTextContent(headingOf(section));
    }
    // No two sections are headed alike.
    const headings = BOARD.map(headingOf);
    expect(new Set(headings).size).toBe(headings.length);
    // Prism's board has a domestic league, so at least one says its country.
    expect(BOARD.some(({ competition }) => competition.region.code)).toBe(true);
  });

  it("reads the board for the sport and day in the URL, and only through /api/terminal", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await screen.findByRole("button", { name: homeWinLabel() });
    expect(lastBoardQuery().get("sport")).toBe(SPORTS[0].id);

    const tomorrow = TOMORROW;
    const days = screen.getByRole("group", { name: am.terminal.kiosk.days });
    await user.click(within(days).getAllByRole("button")[1]);
    await waitFor(() => expect(lastBoardQuery().get("date")).toBe(tomorrow));
    expect(address.params.get("date")).toBe(tomorrow);

    const other = SPORTS[1];
    await user.click(
      within(screen.getByRole("navigation", { name: am.nav.sports })).getByRole(
        "button",
        { name: other.name.am },
      ),
    );
    await waitFor(() => expect(lastBoardQuery().get("sport")).toBe(other.id));
    expect(address.params.get("sport")).toBe(other.slug);

    expect(asked.length).toBeGreaterThan(0);
    for (const call of asked) {
      expect(call.route.startsWith("/api/terminal/")).toBe(true);
    }
  });

  it("says there are no matches on an empty day and goes back to today", async () => {
    const user = userEvent.setup();
    address.go("/?sport=basketball&date=2026-10-06");
    routes({
      board: (params) => json(200, params.get("date") === TODAY ? BOARD : []),
    });
    renderTerminal();

    expect(await screen.findByText(am.board.empty.title)).toBeInTheDocument();
    expect(screen.getByText(am.terminal.kiosk.emptyBody)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: am.terminal.kiosk.backToToday }),
    );
    // Today, same sport.
    expect(address.href).toBe("/?sport=basketball");
    expect(
      await screen.findByRole("button", { name: homeWinLabel() }),
    ).toBeInTheDocument();
  });

  it("offers the start of the board when today itself is empty", async () => {
    const user = userEvent.setup();
    address.go("/?sport=basketball");
    routes({
      board: (params) =>
        json(200, params.get("sport") === "s_football" ? BOARD : []),
    });
    renderTerminal();

    expect(await screen.findByText(am.board.empty.title)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: am.terminal.kiosk.backToToday }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: am.board.empty.action }),
    );
    expect(address.href).toBe("/");
    expect(
      await screen.findByRole("button", { name: homeWinLabel() }),
    ).toBeInTheDocument();
  });

  it("says the sports couldn't load and tries again on a tap", async () => {
    const user = userEvent.setup();
    let fail = true;
    routes({
      sports: () =>
        fail ? problem(503, "SERVICE_UNAVAILABLE") : json(200, SPORTS),
    });
    renderTerminal({ retry: false });

    const tabs = await screen.findByRole("navigation", { name: am.nav.sports });
    expect(
      await within(tabs).findByText(am.terminal.kiosk.sportsFailed),
    ).toBeInTheDocument();
    fail = false;
    await user.click(
      within(tabs).getByRole("button", { name: am.common.retry }),
    );
    expect(
      await within(tabs).findByRole("button", { name: SPORTS[0].name.am }),
    ).toBeInTheDocument();
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
    expect(
      await screen.findByRole("button", { name: homeWinLabel() }),
    ).toBeInTheDocument();
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
      sports: () => problem(401, "AUTH_INVALID_CREDENTIALS"),
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
  it("puts a tapped price in the slip and takes it out on a second tap", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();

    const price = await screen.findByRole("button", { name: homeWinLabel() });
    expect(price).toHaveAttribute("aria-pressed", "false");
    expect(
      within(slipPanel()).getByText(am.betSlip.emptyTitle),
    ).toBeInTheDocument();

    await user.click(price);
    expect(price).toHaveAttribute("aria-pressed", "true");
    const slip = within(slipPanel());
    expect(slip.getByText(HOME_WIN.label.am)).toBeInTheDocument();
    expect(
      slip.getByText(
        `${FIRST.event.home.name.am} – ${FIRST.event.away.name.am}`,
      ),
    ).toBeInTheDocument();
    expect(slip.getByText(formatOdds(HOME_WIN.odds!))).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: am.nav.slipAria.replace("{n}", "1"),
      }),
    ).toBeInTheDocument();

    await user.click(price);
    expect(price).toHaveAttribute("aria-pressed", "false");
    expect(slip.getByText(am.betSlip.emptyTitle)).toBeInTheDocument();
  });

  it("removes one pick and clears the slip", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();

    const outcomes = FIRST.markets.matchResult!.outcomes;
    const second = BOARD[0].events[1] ?? BOARD[1].events[0];
    await user.click(
      await screen.findByRole("button", { name: homeWinLabel() }),
    );
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(
          `${second.event.home.name.am}.*${second.markets.matchResult!.outcomes[2].label.am} `,
        ),
      }),
    );
    const slip = within(slipPanel());
    expect(slip.getAllByRole("listitem")).toHaveLength(2);

    await user.click(
      slip.getByRole("button", {
        name: am.betSlip.remove.replace("{pick}", outcomes[0].label.am),
      }),
    );
    expect(slip.getAllByRole("listitem")).toHaveLength(1);

    await user.click(slip.getByRole("button", { name: am.betSlip.clearAll }));
    expect(slip.queryAllByRole("listitem")).toHaveLength(0);
    expect(slip.getByText(am.betSlip.emptyTitle)).toBeInTheDocument();
  });
});

describe("the kiosk's language (F8ca AC-3)", () => {
  it("opens in the tenant's default language and switches with one tap", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();

    expect(await kioskHeading()).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("am");

    await user.click(screen.getByRole("button", { name: "English" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: en.terminal.kiosk.matches,
      }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(
      screen.getByRole("navigation", { name: en.nav.sports }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: en.betSlip.title }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "አማርኛ" }));
    expect(await kioskHeading()).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("am");
  });

  it("asks in the kiosk's language", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await screen.findByRole("button", { name: homeWinLabel() });
    expect(boardReads().at(-1)!.headers["Accept-Language"]).toBe("am");

    await user.click(screen.getByRole("button", { name: "English" }));
    const days = screen.getByRole("group", { name: en.terminal.kiosk.days });
    await user.click(within(days).getAllByRole("button")[1]);
    await waitFor(() => expect(lastBoardQuery().get("date")).toBe(TOMORROW));
    expect(boardReads().at(-1)!.headers["Accept-Language"]).toBe("en");
  });

  it("starts in English for a tenant whose default is English", async () => {
    routes({
      config: () => json(200, { ...KIOSK_CONFIG, defaultLanguage: "en" }),
    });
    renderTerminal();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: en.terminal.kiosk.matches,
      }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });

  it("falls back to the tenant's default, on screen and in its calls, when the language chosen is no longer offered", async () => {
    const user = userEvent.setup();
    routes();
    const { queryClient } = renderTerminal();
    await screen.findByRole("button", { name: homeWinLabel() });
    await user.click(screen.getByRole("button", { name: "English" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: en.terminal.kiosk.matches,
      }),
    ).toBeInTheDocument();

    // The tenant now offers Amharic only.
    act(() =>
      queryClient.setQueryData(terminalKeys.config(), {
        ...KIOSK_CONFIG,
        languages: ["am"],
        defaultLanguage: "am",
      }),
    );
    expect(await kioskHeading()).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("am");
    const days = screen.getByRole("group", { name: am.terminal.kiosk.days });
    await user.click(within(days).getAllByRole("button")[1]);
    await waitFor(() => expect(lastBoardQuery().get("date")).toBe(TOMORROW));
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
    expect(await kioskHeading()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "English" })).toBeNull();
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
    expect(screen.queryByRole("navigation")).toBeNull();
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

describe("the slip as a view of its own, below lg (F8ca AC-2)", () => {
  it("moves focus to the slip when it opens, and back to its bar when it closes", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await screen.findByRole("button", { name: homeWinLabel() });

    await user.click(
      screen.getByRole("button", { name: am.nav.slipAria.replace("{n}", "0") }),
    );
    expect(
      within(slipPanel()).getByRole("heading", { level: 2 }),
    ).toHaveFocus();

    await user.click(
      screen.getByRole("button", { name: am.terminal.kiosk.backToMatches }),
    );
    expect(
      screen.getByRole("button", { name: am.nav.slipAria.replace("{n}", "0") }),
    ).toHaveFocus();
  });
});

describe("the kiosk across midnight, East Africa Time (F8ca AC-1)", () => {
  /** Moves the fake clock on by `ms`, then lets every answer it released land. */
  async function tick(ms: number) {
    await act(() => vi.advanceTimersByTimeAsync(ms));
    for (let i = 0; i < 10; i += 1) {
      await act(() => vi.advanceTimersByTimeAsync(0));
    }
  }

  it("moves its board and its day strip to the new day at midnight", async () => {
    // 23:59:58 in Addis Ababa. Timers and the date fake; WebCrypto and the
    // rest real. TanStack tells React on a microtask, not the fake clock's zero
    // timeout (as in TerminalStatus.test.tsx).
    vi.useFakeTimers({
      now: Date.parse("2026-10-04T20:59:58Z"),
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    });
    notifyManager.setScheduler((cb) => queueMicrotask(cb));
    routes();
    renderTerminal();
    // Status, then config, then the board: each answer a few turns apart.
    for (let i = 0; i < 20 && boardReads().length === 0; i += 1) await tick(0);
    expect(lastBoardQuery().get("date")).toBe(TODAY);

    await tick(3_000);
    expect(lastBoardQuery().get("date")).toBe(TOMORROW);
    const today = within(
      screen.getByRole("group", { name: am.terminal.kiosk.days }),
    ).getAllByRole("button")[0];
    expect(today).toHaveTextContent(am.board.filters.today);
    expect(today).toHaveAttribute("aria-pressed", "true");
  });
});
