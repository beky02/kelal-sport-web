import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionWatcher } from "@/features/auth/hooks/use-session";
import type { Player } from "@/features/auth/types";
import { ProfileView } from "@/features/profile/components/ProfileView";
import { toDeviceSessions } from "@/lib/api/mappers/account";
import { toPlayer } from "@/lib/api/mappers/auth";
import type { components } from "@/lib/api/schema";
import { accountKeys, sessionKeys } from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import am from "@/lib/i18n/messages/am.json";
import en from "@/lib/i18n/messages/en.json";
import { example } from "../contract";
import { render } from "./render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/profile",
}));

type ApiMe = components["schemas"]["Me"];

/** An answer now, never (`"drop"`), or later (a promise the test settles). */
type Answer = [number, unknown] | "drop" | Promise<[number, unknown]>;

/**
 * The account as the API holds it: what `/api/me` reads and `PATCH` changes.
 * Starts as the contract's player, reading English.
 */
let account: ApiMe;
/** The session was ended at the API: `/api/me` answers nobody. */
let signedOut = false;
/** Every `/api/…` call made, as `METHOD /path`, in order. */
let asked: string[] = [];
/** Every body sent to `PATCH /api/me`. */
let patches: unknown[] = [];
/** Answers to `PATCH /api/me`, in order; when empty, the account is changed. */
let patchAnswers: Answer[] = [];
/** The devices signed in, as the API holds them; a sign-out removes one. */
let devices: components["schemas"]["Session"][];
/** Answers to `GET /api/me/sessions`, in order; when empty, `devices`. */
let listAnswers: Answer[] = [];
/** Answers to `DELETE /api/me/sessions/{id}`, in order; when empty, 204. */
let revokeAnswers: Answer[] = [];

/** Prism's two devices: this browser, and the Android app. */
const PHONE = "01J9A7S0000000000000000002";

const problem = (status: number, code: string) => ({
  type: "about:blank",
  title: `The API's title for ${code}`,
  status,
  code,
});

/** What the route handler answers: the account in `/api/me`'s shape. */
const view = () => ({ player: toPlayer(account) });

function api() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    asked.push(`${method} ${url.pathname}`);
    const reply = ([status, body]: [number, unknown]) =>
      status === 204
        ? new Response(null, { status })
        : Response.json(body, {
            status,
            headers: {
              "Content-Type":
                status >= 400 ? "application/problem+json" : "application/json",
            },
          });
    if (url.pathname === "/api/me" && method === "GET") {
      return reply([200, signedOut ? { player: null } : view()]);
    }
    if (url.pathname === "/api/me" && method === "PATCH") {
      const change = JSON.parse(String(init?.body));
      patches.push(change);
      const next = patchAnswers.shift();
      if (next === "drop") throw new TypeError("Failed to fetch");
      if (next) return reply(await next);
      if (change.language) account.language = change.language;
      if (change.marketingConsent !== undefined) {
        account.marketing_consent = change.marketingConsent;
      }
      return reply([200, view()]);
    }
    if (url.pathname === "/api/me/sessions" && method === "GET") {
      const next = listAnswers.shift();
      if (next === "drop") throw new TypeError("Failed to fetch");
      if (next) return reply(await next);
      return reply([200, toDeviceSessions(devices)]);
    }
    const one = url.pathname.match(/^\/api\/me\/sessions\/([^/]+)$/);
    if (one && method === "DELETE") {
      const next = revokeAnswers.shift();
      if (next === "drop") throw new TypeError("Failed to fetch");
      if (next) {
        const [status, body] = await next;
        // A 404: it was gone already.
        if (status === 404) devices = devices.filter((d) => d.id !== one[1]);
        return reply([status, body]);
      }
      devices = devices.filter((d) => d.id !== one[1]);
      return reply([204, null]);
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
}

/** The signed-in player as `/api/me` reports them now. */
const player = (): Player => toPlayer(account);

beforeEach(() => {
  account = { ...example("/v1/me"), language: "en" };
  asked = [];
  patches = [];
  patchAnswers = [];
  signedOut = false;
  devices = example("/v1/me/sessions").items;
  listAnswers = [];
  revokeAnswers = [];
  useUiStore.setState({ lang: "en" });
  api();
});

afterEach(() => vi.restoreAllMocks());

describe("language on the account (AC-8)", () => {
  it("switching language as a player saves it on the account", async () => {
    const { queryClient } = render(<ProfileView />, { session: player() });

    await userEvent.click(screen.getByRole("button", { name: "አማርኛ" }));

    // The page reads Amharic at once; the account follows through the API.
    expect(useUiStore.getState().lang).toBe("am");
    await waitFor(() => expect(patches).toEqual([{ language: "am" }]));
    await waitFor(() =>
      expect(
        queryClient.getQueryData<{ player: Player }>(sessionKeys.me())?.player
          .language,
      ).toBe("am"),
    );
    expect(screen.queryByText(am.profile.languageNotSaved)).toBeNull();
  });

  it("a guest's language stays on this device and nothing is sent", async () => {
    render(<ProfileView />, { session: "guest" });

    await userEvent.click(screen.getByRole("button", { name: "አማርኛ" }));

    expect(useUiStore.getState().lang).toBe("am");
    expect(asked.filter((call) => call.startsWith("PATCH"))).toEqual([]);
  });

  it("says the language isn't saved on the account until it is, and Save sends it", async () => {
    patchAnswers = [[503, problem(503, "SERVICE_UNAVAILABLE")]];
    render(<ProfileView />, { session: player() });

    await userEvent.click(screen.getByRole("button", { name: "አማርኛ" }));

    const unsaved = await screen.findByText(am.profile.languageNotSaved);
    expect(patches).toEqual([{ language: "am" }]);
    await userEvent.click(
      within(unsaved.closest("div")!).getByRole("button", {
        name: am.profile.languageSave,
      }),
    );

    await waitFor(() =>
      expect(patches).toEqual([{ language: "am" }, { language: "am" }]),
    );
    await waitFor(() =>
      expect(screen.queryByText(am.profile.languageNotSaved)).toBeNull(),
    );
    expect(account.language).toBe("am");
  });
});

describe("language saves in a hurry (review Q2, SEC1)", () => {
  it("switching back before the first save answers leaves the account on the language shown", async () => {
    let first!: (reply: [number, unknown]) => void;
    patchAnswers = [new Promise((resolve) => (first = resolve))];
    const { queryClient } = render(<ProfileView />, { session: player() });

    await userEvent.click(screen.getByRole("button", { name: "አማርኛ" }));
    await waitFor(() => expect(patches).toEqual([{ language: "am" }]));
    // Back to English while the first save is still out.
    await userEvent.click(screen.getByRole("button", { name: "English" }));

    account.language = "am";
    first([200, view()]);

    // The saves run in order, so the last one sent is the account's.
    await waitFor(() =>
      expect(patches).toEqual([{ language: "am" }, { language: "en" }]),
    );
    await waitFor(() =>
      expect(
        queryClient.getQueryData<{ player: Player }>(sessionKeys.me())?.player
          .language,
      ).toBe("en"),
    );
    expect(account.language).toBe("en");
    expect(useUiStore.getState().lang).toBe("en");
    expect(screen.queryByText(en.profile.languageNotSaved)).toBeNull();
  });

  it("a save answered after logout doesn't bring the player back", async () => {
    let answer!: (reply: [number, unknown]) => void;
    patchAnswers = [new Promise((resolve) => (answer = resolve))];
    const { queryClient } = render(<ProfileView />, { session: player() });

    await userEvent.click(screen.getByRole("switch", { name: /Offers/ }));
    await waitFor(() => expect(patches).toHaveLength(1));
    // Logged out (another tab, say) before the save answered.
    signedOut = true;
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), { player: null });
    });

    answer([200, { player: { ...player(), marketingConsent: true } }]);

    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(queryClient.getQueryData(sessionKeys.me())).toEqual({
      player: null,
    });
  });
});

describe("marketing consent on the account (AC-8)", () => {
  const offers = () => screen.getByRole("switch", { name: /Offers/ });

  it("Offers shows the account's consent, waits for the API and shows its answer", async () => {
    let answer!: (reply: [number, unknown]) => void;
    patchAnswers = [new Promise((resolve) => (answer = resolve))];
    render(<ProfileView />, { session: player() });
    expect(offers()).toHaveAttribute("aria-checked", "false");

    await userEvent.click(offers());

    // Nothing is assumed while the API decides: the switch waits, unchanged.
    await waitFor(() => expect(patches).toEqual([{ marketingConsent: true }]));
    expect(offers()).toHaveAttribute("aria-checked", "false");
    expect(offers()).toHaveAttribute("aria-busy", "true");
    // Waiting, but still focusable (review Q3): a second press sends nothing.
    expect(offers()).toHaveAttribute("aria-disabled", "true");
    expect(offers()).not.toBeDisabled();
    await userEvent.click(offers());
    expect(patches).toHaveLength(1);

    answer([200, { player: { ...player(), marketingConsent: true } }]);

    await waitFor(() =>
      expect(offers()).toHaveAttribute("aria-checked", "true"),
    );
    expect(offers()).not.toHaveAttribute("aria-disabled");
    // The press while it waited was never sent, not even afterwards.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(patches).toEqual([{ marketingConsent: true }]);
  });

  it("shows the consent the API kept, not the one asked for", async () => {
    // The API keeps marketing off (a player on a break, say).
    patchAnswers = [
      [200, { player: { ...player(), marketingConsent: false } }],
    ];
    render(<ProfileView />, { session: player() });

    await userEvent.click(offers());

    await waitFor(() => expect(offers()).not.toHaveAttribute("aria-busy"));
    expect(patches).toEqual([{ marketingConsent: true }]);
    expect(offers()).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("the saved consent is the one shown after a reload", async () => {
    const first = render(<ProfileView />, { session: player() });
    await userEvent.click(offers());
    await waitFor(() =>
      expect(offers()).toHaveAttribute("aria-checked", "true"),
    );
    first.unmount();

    // A reload: a fresh cache, and `/api/me` read from the account.
    render(<ProfileView />, { session: null });

    await waitFor(() =>
      expect(offers()).toHaveAttribute("aria-checked", "true"),
    );
    expect(asked).toContain("GET /api/me");
  });

  it("a refused save says so with the API's words and offers Try again", async () => {
    patchAnswers = [[422, problem(422, "VALIDATION_FAILED")]];
    render(<ProfileView />, { session: player() });

    await userEvent.click(offers());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(en.profile.saveFailed);
    expect(alert).toHaveTextContent("The API's title for VALIDATION_FAILED");
    expect(offers()).toHaveAttribute("aria-checked", "false");

    await userEvent.click(
      within(alert).getByRole("button", { name: en.common.retry }),
    );

    await waitFor(() =>
      expect(offers()).toHaveAttribute("aria-checked", "true"),
    );
    expect(patches).toEqual([
      { marketingConsent: true },
      { marketingConsent: true },
    ]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("an unanswered save asks to check the connection", async () => {
    patchAnswers = ["drop"];
    render(<ProfileView />, { session: player() });

    await userEvent.click(offers());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(en.profile.saveFailedBody);
  });
});

describe("devices signed in (AC-9)", () => {
  const rows = () => screen.getAllByRole("listitem");
  const signOut = (device: string) =>
    screen.getByRole("button", { name: `Sign out ${device}` });

  it("lists the devices from /api/me/sessions with this one marked", async () => {
    render(<ProfileView />, { session: player() });

    const list = await screen.findByRole("list", { name: en.profile.devices });
    const [current, phone] = within(list).getAllByRole("listitem");
    expect(current).toHaveTextContent("Chrome 129 on Windows");
    expect(current).toHaveTextContent(en.profile.thisDevice);
    expect(current).toHaveTextContent("196.188.x.x");
    expect(phone).toHaveTextContent("App 1.0.3");
    expect(phone).not.toHaveTextContent(en.profile.thisDevice);
    // Last used 2 Oct at 20:41 UTC: 23:41 East Africa Time.
    expect(phone).toHaveTextContent(/2 Oct.*23:41/);
    expect(asked).toContain("GET /api/me/sessions");
  });

  it("offers no sign-out for this device: Log out is the way out of it", async () => {
    render(<ProfileView />, { session: player() });

    const list = await screen.findByRole("list", { name: en.profile.devices });
    const [current] = within(list).getAllByRole("listitem");
    expect(within(current).queryByRole("button")).toBeNull();
  });

  it("signing another device out sends DELETE and removes it once the API answers", async () => {
    let answer!: (reply: [number, unknown]) => void;
    revokeAnswers = [new Promise((resolve) => (answer = resolve))];
    render(<ProfileView />, { session: player() });
    await screen.findByText("App 1.0.3");

    await userEvent.click(signOut("App 1.0.3"));

    // Nothing leaves the list until the API has answered.
    await waitFor(() =>
      expect(asked).toContain(`DELETE /api/me/sessions/${PHONE}`),
    );
    expect(screen.getByText("App 1.0.3")).toBeInTheDocument();
    expect(signOut("App 1.0.3")).toHaveAttribute("aria-disabled", "true");
    expect(signOut("App 1.0.3")).not.toBeDisabled();
    await userEvent.click(signOut("App 1.0.3"));
    expect(
      asked.filter((call) => call === `DELETE /api/me/sessions/${PHONE}`),
    ).toHaveLength(1);

    devices = devices.filter((d) => d.id !== PHONE);
    answer([204, null]);

    await waitFor(() => expect(screen.queryByText("App 1.0.3")).toBeNull());
    expect(rows()).toHaveLength(1);
    expect(
      asked.filter((call) => call === "GET /api/me/sessions"),
    ).toHaveLength(2);
  });

  it("a device already gone leaves the list without an error", async () => {
    revokeAnswers = [[404, problem(404, "NOT_FOUND")]];
    render(<ProfileView />, { session: player() });
    await screen.findByText("App 1.0.3");
    // The list is read again after the 404: held, so the row is still there.
    let reread!: (reply: [number, unknown]) => void;
    listAnswers = [new Promise((resolve) => (reread = resolve))];

    await userEvent.click(signOut("App 1.0.3"));

    await waitFor(() =>
      expect(
        asked.filter((call) => call === "GET /api/me/sessions"),
      ).toHaveLength(2),
    );
    // Gone already is what was asked for: never an error, even before the
    // list has come back without it.
    expect(screen.getByText("App 1.0.3")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    reread([200, toDeviceSessions(devices)]);

    await waitFor(() => expect(screen.queryByText("App 1.0.3")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a failed sign-out says so on that row with Try again", async () => {
    revokeAnswers = [[503, problem(503, "SERVICE_UNAVAILABLE")]];
    render(<ProfileView />, { session: player() });
    await screen.findByText("App 1.0.3");

    await userEvent.click(signOut("App 1.0.3"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(en.profile.signOutFailed);
    expect(alert.closest("li")).toHaveTextContent("App 1.0.3");
    expect(screen.getByText("App 1.0.3")).toBeInTheDocument();

    await userEvent.click(
      within(alert).getByRole("button", { name: en.common.retry }),
    );

    await waitFor(() => expect(screen.queryByText("App 1.0.3")).toBeNull());
    expect(
      asked.filter((call) => call === `DELETE /api/me/sessions/${PHONE}`),
    ).toHaveLength(2);
  });

  it("a failed list offers Try again", async () => {
    listAnswers = [[503, problem(503, "SERVICE_UNAVAILABLE")]];
    render(<ProfileView />, { session: player() });

    const failed = await screen.findByText(en.profile.devicesFailed);
    await userEvent.click(
      within(failed.closest("div")!).getByRole("button", {
        name: en.common.retry,
      }),
    );

    expect(await screen.findByText("App 1.0.3")).toBeInTheDocument();
  });

  it("a guest sees no devices and nothing is read", async () => {
    render(<ProfileView />, { session: "guest" });

    await screen.findByRole("button", { name: "Log in" });
    expect(screen.queryByText(en.profile.devices)).toBeNull();
    expect(asked).not.toContain("GET /api/me/sessions");
  });

  it("drops the devices when another player signs in", async () => {
    const { queryClient } = render(
      <>
        <SessionWatcher />
        <ProfileView />
      </>,
      { session: player() },
    );
    await screen.findByText("App 1.0.3");
    expect(queryClient.getQueryData(accountKeys.sessions())).toHaveLength(2);

    // Someone else signs in (another tab): the first player's devices go,
    // and the next player's are read for them.
    devices = devices.filter((d) => d.current);
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), {
        player: { ...player(), id: "01J9A7R0000000000000000099" },
      });
    });

    await waitFor(() => expect(screen.queryByText("App 1.0.3")).toBeNull());
    expect(
      asked.filter((call) => call === "GET /api/me/sessions"),
    ).toHaveLength(2);
  });
});
