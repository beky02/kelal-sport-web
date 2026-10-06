import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDeviceKey } from "@/features/terminal/lib/device-key";
import { addDays, todayEat } from "@/lib/i18n/dates";
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

// An activated PC: its device key is here, so the status is read.
beforeEach(async () => {
  keys.pair = await createDeviceKey();
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

    // Every match of the board, its competition and its 1X2 prices as sent.
    for (const section of BOARD) {
      expect(
        await screen.findByRole("heading", {
          level: 2,
          name: section.competition.name.am,
        }),
      ).toBeInTheDocument();
      for (const { event, markets } of section.events) {
        expect(screen.getAllByText(event.home.name.am).length).toBeGreaterThan(
          0,
        );
        expect(screen.getAllByText(event.away.name.am).length).toBeGreaterThan(
          0,
        );
        for (const outcome of markets.matchResult!.outcomes) {
          // A price the API left out is locked, and says so.
          const name =
            outcome.odds === null
              ? `${outcome.label.am}, ${am.a11y.suspended}`
              : `${outcome.label.am} ${formatOdds(outcome.odds)}`;
          const price = screen.getByRole("button", {
            name: new RegExp(`: ${name.replace(".", "\\.")}`),
          });
          expect(price).toBeInTheDocument();
          if (outcome.odds === null) expect(price).toBeDisabled();
        }
      }
    }
  });

  it("reads the board for the sport and day in the URL, and only through /api/terminal", async () => {
    const user = userEvent.setup();
    routes();
    renderTerminal();
    await screen.findByRole("button", { name: homeWinLabel() });
    expect(lastBoardQuery().get("sport")).toBe(SPORTS[0].id);

    const tomorrow = addDays(todayEat(), 1);
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

  it("says there are no matches on an empty day and goes back to the start", async () => {
    const user = userEvent.setup();
    address.go(`/?date=${addDays(todayEat(), 2)}`);
    routes({
      board: (params) =>
        json(200, params.get("date") === todayEat() ? BOARD : []),
    });
    renderTerminal();

    expect(await screen.findByText(am.board.empty.title)).toBeInTheDocument();
    expect(screen.getByText(am.terminal.kiosk.emptyBody)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: am.board.empty.action }),
    );
    expect(address.href).toBe("/");
    expect(
      await screen.findByRole("button", { name: homeWinLabel() }),
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
    await waitFor(() =>
      expect(lastBoardQuery().get("date")).toBe(addDays(todayEat(), 1)),
    );
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
