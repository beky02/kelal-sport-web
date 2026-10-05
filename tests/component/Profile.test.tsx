import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Player } from "@/features/auth/types";
import { ProfileView } from "@/features/profile/components/ProfileView";
import { toPlayer } from "@/lib/api/mappers/auth";
import type { components } from "@/lib/api/schema";
import { sessionKeys } from "@/lib/query/keys";
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
/** Every `/api/…` call made, as `METHOD /path`, in order. */
let asked: string[] = [];
/** Every body sent to `PATCH /api/me`. */
let patches: unknown[] = [];
/** Answers to `PATCH /api/me`, in order; when empty, the account is changed. */
let patchAnswers: Answer[] = [];

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
      return reply([200, view()]);
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
      return reply([200, []]);
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
    expect(offers()).toBeDisabled();

    answer([200, { player: { ...player(), marketingConsent: true } }]);

    await waitFor(() =>
      expect(offers()).toHaveAttribute("aria-checked", "true"),
    );
    expect(offers()).not.toBeDisabled();
  });

  it("shows the consent the API kept, not the one asked for", async () => {
    // The API keeps marketing off (a player on a break, say).
    patchAnswers = [
      [200, { player: { ...player(), marketingConsent: false } }],
    ];
    render(<ProfileView />, { session: player() });

    await userEvent.click(offers());

    await waitFor(() => expect(offers()).not.toBeDisabled());
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
