import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { SessionWatcher } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import type { Player } from "@/features/auth/types";
import { ResponsibleGamingView } from "@/features/responsible-gaming/components/ResponsibleGamingView";
import { useSelfExclude } from "@/features/responsible-gaming/hooks/use-responsible-gaming";
import type { RgLimit } from "@/features/responsible-gaming/types";
import { CoolOffBanner } from "@/features/system/components/StatusBanners";
import { SystemOverlays } from "@/features/system/components/SystemOverlays";
import {
  toExclusion,
  toLimit,
  toLimits,
} from "@/lib/api/mappers/responsible-gambling";
import type { components } from "@/lib/api/schema";
import { rgKeys, sessionKeys } from "@/lib/query/keys";
import { useSystemStore } from "@/stores/system.store";
import { useUiStore } from "@/stores/ui.store";
import { example, responseExample } from "../contract";
import { CONTRACT_PLAYER, render } from "./render";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: vi.fn(() => "/responsible-gaming"),
}));

/** The contract's player on a break until `until`, as `/v1/me` reports it. */
const onBreakUntil = (until: string): Player => ({
  ...CONTRACT_PLAYER,
  flags: { ...CONTRACT_PLAYER.flags, excludedUntil: until },
});

/** Someone else, signing in on the same phone. */
const OTHER_PLAYER: Player = {
  ...CONTRACT_PLAYER,
  id: "01J9A7R0000000000000000099",
};

/**
 * What `/api/me/limits` answers for Prism's player: a weekly deposit limit of
 * 1,000.00 with 500.00 used and 2,000.00 pending from 4 Oct, 13:00 EAT, and a
 * daily time limit of 120 minutes.
 */
const CONTRACT_LIMITS = toLimits(example("/v1/me/limits").items);
const [WEEKLY_DEPOSIT, DAILY_TIME] = CONTRACT_LIMITS;
/** What `PUT` answers in the contract: the raise held back until 4 Oct. */
const RAISED = toLimit(
  responseExample(
    "/v1/me/limits",
    "put",
    200,
  ) as components["schemas"]["RgLimit"],
);
/** The contract's break: a 7-day time-out ending 10 Oct, 15:00 EAT. */
const STARTED = toExclusion(
  responseExample(
    "/v1/me/self-exclusion",
    "post",
    201,
  ) as components["schemas"]["Exclusion"],
);

type Answer = [number, unknown] | "drop";

/** Every `/api/…` call made, as `METHOD /path`, in order. */
let asked: string[] = [];
/** Every body sent to `PUT /api/me/limits`. */
let saved: unknown[] = [];
/** Every body sent to `POST /api/me/self-exclusion`. */
let excluded: unknown[] = [];
let limits: () => [number, unknown] = () => [200, CONTRACT_LIMITS];
let saves: Answer[] = [];
let exclusions: Answer[] = [];
/** Who `/api/me` says is signed in when it is read. */
let signedIn: Player | null = CONTRACT_PLAYER;

const problem = (status: number, code: string, extra = {}) => ({
  type: "about:blank",
  title: `The API's title for ${code}`,
  status,
  code,
  ...extra,
});

function api() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    asked.push(`${method} ${url.pathname}`);
    const reply = ([status, body]: [number, unknown]) =>
      Response.json(body, {
        status,
        headers: {
          "Content-Type":
            status >= 400 ? "application/problem+json" : "application/json",
        },
      });
    const answer = (queue: Answer[]) => {
      const next = queue.shift() ?? [500, problem(500, "SERVICE_UNAVAILABLE")];
      if (next === "drop") throw new TypeError("Failed to fetch");
      return reply(next);
    };
    if (url.pathname === "/api/me") return reply([200, { player: signedIn }]);
    if (url.pathname === "/api/me/limits" && method === "GET") {
      return reply(limits());
    }
    if (url.pathname === "/api/me/limits" && method === "PUT") {
      saved.push(JSON.parse(String(init?.body)));
      return answer(saves);
    }
    if (url.pathname === "/api/me/self-exclusion" && method === "POST") {
      excluded.push(JSON.parse(String(init?.body)));
      return answer(exclusions);
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
}

const user = userEvent.setup();

const count = (call: string) => asked.filter((a) => a === call).length;

/** A limit's card, by its title. */
const card = (name: string) => screen.getByRole("region", { name });

/** Types a new limit into a card and saves it. */
async function setLimit(name: string, value: string) {
  const region = card(name);
  const input = within(region).getByLabelText(/New limit/);
  await user.clear(input);
  await user.type(input, value);
  await user.click(within(region).getByRole("button", { name: "Save limit" }));
}

/** Chooses a length in a group and presses its button. */
async function ask(group: string, length: string, button: string) {
  const tiles = screen.getByRole("radiogroup", { name: group });
  await user.click(within(tiles).getByRole("radio", { name: length }));
  await user.click(screen.getByRole("button", { name: button }));
  return screen.findByRole("alertdialog");
}

beforeEach(() => {
  asked = [];
  saved = [];
  excluded = [];
  limits = () => [200, CONTRACT_LIMITS];
  saves = [];
  exclusions = [];
  signedIn = CONTRACT_PLAYER;
  push.mockClear();
  useUiStore.setState({ lang: "en", clock: "eat", calendar: "gregorian" });
  useSystemStore.setState({ overlay: null, loggedOut: false, online: true });
  useAuthStore.setState({ entry: null });
});

afterEach(() => vi.restoreAllMocks());

describe("the break banner", () => {
  it("shows the break /api/me reports, with its end, and View limits", async () => {
    // 15:00 UTC is 18:00 in East Africa Time.
    render(<CoolOffBanner />, {
      session: onBreakUntil("2026-10-10T15:00:00Z"),
    });

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Break active until 10 Oct 2026, 18:00.");
    expect(banner).toHaveTextContent("Betting and deposits are paused.");
    await user.click(screen.getByRole("button", { name: "View limits" }));
    expect(push).toHaveBeenCalledWith("/responsible-gaming");
  });

  it("says a permanent self-exclusion is active, with no end date", () => {
    render(<CoolOffBanner />, {
      session: { ...CONTRACT_PLAYER, status: "self_excluded" },
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Self-exclusion active. Betting and deposits are stopped.",
    );
  });

  it("shows the end in the player's calendar and clock", () => {
    useUiStore.setState({ lang: "am", clock: "eth", calendar: "ethiopian" });
    render(<CoolOffBanner />, {
      session: onBreakUntil("2026-10-10T15:00:00Z"),
    });

    // 18:00 EAT is 12 in the evening on the Ethiopian clock; 10 Oct 2026 is
    // Tikimt 1, 2019.
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("ዕረፍት እስከ");
    expect(banner).toHaveTextContent("2019");
    expect(banner).toHaveTextContent("12:00");
  });

  it("shows nothing without a break, and nothing for a guest", () => {
    const { unmount } = render(<CoolOffBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    unmount();

    render(<CoolOffBanner />, { session: "guest" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("the limits (AC-1)", () => {
  it("shows the limits the account holds, and a limit set on another device after a reload (AC-1)", async () => {
    api();
    const first = render(<ResponsibleGamingView />);

    const deposit = await screen.findByRole("region", {
      name: "Deposit limit",
    });
    // Opened on the period that holds the limit.
    expect(
      within(deposit).getByRole("button", { name: "Weekly" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(deposit).toHaveTextContent("Limit: ETB 1,000.00");
    expect(deposit).toHaveTextContent(
      "ETB 500.00 of ETB 1,000.00 used this week",
    );
    // 10:00 UTC is 13:00 in East Africa Time.
    expect(deposit).toHaveTextContent(
      "Changes to ETB 2,000.00 on 04/10 · 13:00.",
    );
    expect(card("Time limit")).toHaveTextContent("Limit: 120 min");
    expect(card("Stake limit")).toHaveTextContent("No limit set");
    expect(card("Loss limit")).toHaveTextContent("No limit set");
    first.unmount();

    // Set on another device: the account now holds 750.00, nothing pending.
    // A reload is a fresh page: what shows is read from the account again.
    limits = () => [
      200,
      [
        { ...WEEKLY_DEPOSIT, amount: "750.00", pending: null },
        DAILY_TIME,
      ] satisfies RgLimit[],
    ];
    render(<ResponsibleGamingView />);

    const again = await screen.findByRole("region", { name: "Deposit limit" });
    await waitFor(() => expect(again).toHaveTextContent("Limit: ETB 750.00"));
    expect(again).not.toHaveTextContent("Changes to");
    expect(count("GET /api/me/limits")).toBe(2);
  });

  it("shows another period's limit, or none, as the player switches", async () => {
    api();
    render(<ResponsibleGamingView />);
    const deposit = await screen.findByRole("region", {
      name: "Deposit limit",
    });

    await user.click(within(deposit).getByRole("button", { name: "Daily" }));

    expect(deposit).toHaveTextContent("No limit set");
    expect(deposit).not.toHaveTextContent("ETB 1,000.00");
  });

  it("says the limits couldn't load, and Try again reads them", async () => {
    let fail = true;
    limits = () =>
      fail
        ? [503, problem(503, "SERVICE_UNAVAILABLE")]
        : [200, CONTRACT_LIMITS];
    api();
    render(<ResponsibleGamingView />);

    expect(
      await screen.findByRole("heading", {
        name: "We couldn’t load your limits",
      }),
    ).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("region", { name: "Deposit limit" }),
    ).toHaveTextContent("Limit: ETB 1,000.00");
  });

  it("asks a guest to log in, and reads no limits", async () => {
    api();
    render(<ResponsibleGamingView />, { session: "guest" });

    expect(
      screen.getByRole("heading", { name: "Log in to set your limits" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Deposit limit" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(useAuthStore.getState().entry).toBe("login");
    // The help is for everyone.
    expect(screen.getByText("Need to talk to someone?")).toBeInTheDocument();
    expect(count("GET /api/me/limits")).toBe(0);
  });

  it("drops the limits when another player signs in", async () => {
    api();
    const { queryClient } = render(
      <>
        <SessionWatcher />
        <ResponsibleGamingView />
      </>,
    );
    await screen.findByRole("region", { name: "Deposit limit" });
    expect(queryClient.getQueryData(rgKeys.limits())).toEqual(CONTRACT_LIMITS);

    // Someone else signs in (another tab): the first player's limits go, and
    // the next player's are read for them.
    limits = () => [200, []];
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), { player: OTHER_PLAYER });
    });

    await waitFor(() => expect(count("GET /api/me/limits")).toBe(2));
    expect(
      await screen.findByRole("region", { name: "Deposit limit" }),
    ).toHaveTextContent("No limit set");
    expect(screen.queryByText(/1,000\.00/)).not.toBeInTheDocument();
  });
});

describe("setting a limit (AC-5)", () => {
  it("raising a limit shows it pending from the API's effective time (AC-5)", async () => {
    saves = [[200, RAISED]];
    api();
    render(<ResponsibleGamingView />);
    await screen.findByRole("region", { name: "Deposit limit" });

    await setLimit("Deposit limit", "2000");

    const deposit = card("Deposit limit");
    expect(
      await within(deposit).findByText(
        "Saved. Your new limit of ETB 2,000.00 starts on 04/10 · 13:00.",
      ),
    ).toBeInTheDocument();
    expect(saved).toEqual([
      { type: "deposit", period: "week", amount: "2000.00" },
    ]);
    // Read again from the account: the card shows what is in force now.
    await waitFor(() => expect(count("GET /api/me/limits")).toBe(2));
    expect(deposit).toHaveTextContent("Limit: ETB 1,000.00");
  });

  it("lowering a limit shows it in force at once (AC-5)", async () => {
    const lowered: RgLimit = {
      ...WEEKLY_DEPOSIT,
      amount: "600.00",
      pending: null,
    };
    saves = [[200, lowered]];
    api();
    render(<ResponsibleGamingView />);
    await screen.findByRole("region", { name: "Deposit limit" });
    limits = () => [200, [lowered, DAILY_TIME]];

    await setLimit("Deposit limit", "600");

    const deposit = card("Deposit limit");
    expect(
      await within(deposit).findByText("Saved. Your limit is now ETB 600.00."),
    ).toBeInTheDocument();
    // The value is the account's now: the field is ready for the next one.
    expect(within(deposit).getByLabelText(/New limit/)).toHaveValue("");
    await waitFor(() => expect(deposit).toHaveTextContent("Limit: ETB 600.00"));
    expect(deposit).not.toHaveTextContent("Changes to");
  });

  it("sets a time limit in minutes", async () => {
    saves = [[200, { ...DAILY_TIME, minutes: 90 }]];
    api();
    render(<ResponsibleGamingView />);
    await screen.findByRole("region", { name: "Time limit" });

    await setLimit("Time limit", "90");

    expect(
      await within(card("Time limit")).findByText(
        "Saved. Your limit is now 90 min.",
      ),
    ).toBeInTheDocument();
    expect(saved).toEqual([
      { type: "session_minutes", period: "day", minutes: 90 },
    ]);
  });

  it("won't save a limit of nothing or zero", async () => {
    api();
    render(<ResponsibleGamingView />);
    const stake = await screen.findByRole("region", { name: "Stake limit" });
    const save = within(stake).getByRole("button", { name: "Save limit" });
    expect(save).toBeDisabled();

    await user.type(within(stake).getByLabelText(/New limit/), "0");

    expect(stake).toHaveTextContent("Enter an amount above 0.");
    expect(save).toBeDisabled();
    expect(saved).toHaveLength(0);
  });

  it("says a limit wasn't saved, in the API's words", async () => {
    saves = [
      [
        422,
        problem(422, "VALIDATION_FAILED", {
          detail: "A limit can't be lowered below what you've already used.",
        }),
      ],
    ];
    api();
    render(<ResponsibleGamingView />);
    await screen.findByRole("region", { name: "Deposit limit" });

    await setLimit("Deposit limit", "100");

    const alert = await within(card("Deposit limit")).findByRole("alert");
    expect(alert).toHaveTextContent("Your limit wasn’t saved");
    expect(alert).toHaveTextContent("The API's title for VALIDATION_FAILED");
    expect(alert).toHaveTextContent(
      "A limit can't be lowered below what you've already used.",
    );
    expect(count("GET /api/me/limits")).toBe(1);
  });

  it("says it couldn't save without an answer; saving again sends the same limit", async () => {
    saves = ["drop", [200, RAISED]];
    api();
    render(<ResponsibleGamingView />);
    await screen.findByRole("region", { name: "Deposit limit" });

    await setLimit("Deposit limit", "2000");
    const alert = await within(card("Deposit limit")).findByRole("alert");
    expect(alert).toHaveTextContent("We couldn’t save your limit");
    expect(alert).toHaveTextContent("Check your connection and try again.");
    // Kept, to send again.
    expect(
      within(card("Deposit limit")).getByLabelText(/New limit/),
    ).toHaveValue("2000");

    await user.click(
      within(card("Deposit limit")).getByRole("button", { name: "Save limit" }),
    );
    await within(card("Deposit limit")).findByText(/^Saved\./);
    expect(saved).toEqual([
      { type: "deposit", period: "week", amount: "2000.00" },
      { type: "deposit", period: "week", amount: "2000.00" },
    ]);
  });
});

describe("taking a break (AC-6)", () => {
  it("asks once, sends one POST /v1/me/self-exclusion and leaves the player signed out with the end date; a reload changes nothing (AC-6)", async () => {
    exclusions = [[201, STARTED]];
    api();
    const first = render(
      <>
        <SessionWatcher />
        <SystemOverlays />
        <ResponsibleGamingView />
      </>,
    );
    await screen.findByRole("region", { name: "Deposit limit" });

    const dialog = await ask("Take a break", "7 days", "Start break");
    expect(dialog).toHaveAccessibleName("Take a 7 days break?");
    expect(dialog).toHaveTextContent(
      "You’ll be signed out on every device, and you won’t be able to bet or deposit until it ends. It can’t be cancelled early.",
    );
    expect(excluded).toHaveLength(0);
    // Pressed twice in a hurry: one break.
    await user.dblClick(
      within(dialog).getByRole("button", { name: "Confirm" }),
    );

    const heading = await screen.findByRole("heading", {
      name: "Your break has started",
    });
    expect(heading).toHaveFocus();
    // 12:00 UTC is 15:00 in East Africa Time: the API's end, with its year.
    expect(
      screen.getByText(
        "You’ve been signed out on every device. Betting and deposits are paused until 10 Oct 2026, 15:00.",
      ),
    ).toBeInTheDocument();
    expect(excluded).toEqual([{ kind: "time_out", duration: "7d" }]);
    // Signed out, as a logout leaves it: no "session ended", nothing kept.
    expect(first.queryClient.getQueryData(sessionKeys.me())).toEqual({
      player: null,
    });
    expect(first.queryClient.getQueryData(rgKeys.limits())).toBeUndefined();
    expect(
      screen.queryByRole("alertdialog", { name: /session/i }),
    ).not.toBeInTheDocument();
    first.unmount();

    // A reload: nothing in the browser held the break, and the cookie is
    // gone — a guest. Logging in again, /api/me reports the break.
    signedIn = null;
    const reloaded = render(<ResponsibleGamingView />, { session: null });
    expect(
      await screen.findByRole("heading", { name: "Log in to set your limits" }),
    ).toBeInTheDocument();
    reloaded.unmount();

    signedIn = onBreakUntil(STARTED.endsAt!);
    render(
      <>
        <CoolOffBanner />
        <ResponsibleGamingView />
      </>,
      { session: null },
    );
    expect(
      await screen.findByText("Break active until 10 Oct 2026, 15:00."),
    ).toBeInTheDocument();
    expect(excluded).toHaveLength(1);
  });

  it("starts one break however quickly it is asked for twice", async () => {
    exclusions = [[201, STARTED]];
    api();
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSelfExclude(), { wrapper });

    act(() => {
      result.current.start({ kind: "time_out", duration: "7d" });
      result.current.start({ kind: "time_out", duration: "7d" });
    });

    await waitFor(() => expect(result.current.started).not.toBeNull());
    expect(excluded).toHaveLength(1);
  });

  it("a permanent self-exclusion says so, with no end date", async () => {
    exclusions = [
      [
        201,
        {
          kind: "self_exclusion",
          startsAt: "2026-10-05T09:00:00Z",
          endsAt: null,
        },
      ],
    ];
    api();
    render(<ResponsibleGamingView />);
    await screen.findByRole("region", { name: "Deposit limit" });

    const dialog = await ask("Self-exclusion", "Permanent", "Self-exclude");
    expect(dialog).toHaveAccessibleName("Exclude yourself permanently?");
    expect(dialog).toHaveTextContent(
      "You’ll be signed out on every device, and you won’t be able to bet or deposit again. This can’t be undone. Open bets settle as normal.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    expect(
      await screen.findByRole("heading", { name: "You’ve excluded yourself" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "You’ve been signed out on every device. You won’t be able to bet or deposit again.",
      ),
    ).toBeInTheDocument();
    expect(excluded).toEqual([
      { kind: "self_exclusion", duration: "permanent" },
    ]);
  });

  it("offers five years among the self-exclusion lengths", async () => {
    exclusions = [
      [
        201,
        {
          kind: "self_exclusion",
          startsAt: "2026-10-05T09:00:00Z",
          endsAt: "2031-10-05T09:00:00Z",
        },
      ],
    ];
    api();
    render(<ResponsibleGamingView />);
    await screen.findByRole("region", { name: "Deposit limit" });

    const dialog = await ask("Self-exclusion", "5 years", "Self-exclude");
    expect(dialog).toHaveAccessibleName("Exclude yourself for 5 years?");
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    expect(
      await screen.findByText(
        "You’ve been signed out on every device. Betting and deposits are stopped until 5 Oct 2031, 12:00.",
      ),
    ).toBeInTheDocument();
    expect(excluded).toEqual([{ kind: "self_exclusion", duration: "5y" }]);
  });

  it("Go back sends nothing", async () => {
    api();
    render(<ResponsibleGamingView />);
    await screen.findByRole("region", { name: "Deposit limit" });

    const dialog = await ask("Take a break", "24 hours", "Start break");
    await user.click(within(dialog).getByRole("button", { name: "Go back" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(excluded).toHaveLength(0);
  });

  it("says a break that didn't start, in the API's words, and keeps the player signed in", async () => {
    exclusions = [[422, problem(422, "VALIDATION_FAILED")]];
    api();
    const { queryClient } = render(<ResponsibleGamingView />);
    await screen.findByRole("region", { name: "Deposit limit" });

    const dialog = await ask("Take a break", "30 days", "Start break");
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your break didn’t start");
    expect(alert).toHaveTextContent("The API's title for VALIDATION_FAILED");
    expect(queryClient.getQueryData(sessionKeys.me())).toEqual({
      player: CONTRACT_PLAYER,
    });
  });

  it("says a break that may have started without an answer, and Try again sends it again", async () => {
    exclusions = ["drop", [201, STARTED]];
    api();
    render(<ResponsibleGamingView />);
    await screen.findByRole("region", { name: "Deposit limit" });

    const dialog = await ask("Take a break", "7 days", "Start break");
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn’t confirm your break");
    expect(alert).toHaveTextContent(
      "It may have started. If it did, you’ll be signed out.",
    );
    // Whether the session survived is /api/me's to say.
    await waitFor(() => expect(count("GET /api/me")).toBeGreaterThan(0));

    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Your break has started" }),
    ).toBeInTheDocument();
    expect(excluded).toEqual([
      { kind: "time_out", duration: "7d" },
      { kind: "time_out", duration: "7d" },
    ]);
  });
});
