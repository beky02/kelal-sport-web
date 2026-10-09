import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MainNav } from "@/components/layout/MainNav";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SessionWatcher } from "@/features/auth/hooks/use-session";
import { ProfileView } from "@/features/profile/components/ProfileView";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { PromotionsView } from "@/features/promotions/components/PromotionsView";
import { usePromoStore } from "@/features/promotions/stores/promo.store";
import { toMyBonuses, toPromotions } from "@/lib/api/mappers/promotions";
import { toWalletBalances } from "@/lib/api/mappers/wallet";
import en from "@/lib/i18n/messages/en.json";
import am from "@/lib/i18n/messages/am.json";
import {
  bonusKeys,
  sessionKeys,
  transactionKeys,
  walletKeys,
} from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import { example } from "../contract";
import { CONTRACT_PLAYER, render } from "./render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/promotions",
  useSearchParams: () => new URLSearchParams(),
}));

/** An answer now, never (`"drop"`), or later (a promise the test settles). */
type Answer = [number, unknown] | "drop" | Promise<[number, unknown]>;

interface Call {
  method: string;
  path: string;
  key: string | null;
  body: unknown;
}

/** Every `/api/…` call made, in order. */
let calls: Call[] = [];
let offers: Answer;
let bonuses: Answer;
/** Answers to `POST /api/promo-codes/redeem`, in order; when empty, granted. */
let redeemAnswers: Answer[] = [];
/** What `/api/me` answers: who is signed in. */
let me: Answer;

const OFFERS = () => toPromotions(example("/v1/promotions").items);
const BONUSES = () => toMyBonuses(example("/v1/me/bonuses"));
const NONE = { active: null, freeBets: [] };

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
    const headers = new Headers(init?.headers);
    calls.push({
      method,
      path: url.pathname,
      key: headers.get("idempotency-key"),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const reply = async (answer: Answer | undefined) => {
      if (answer === "drop") throw new TypeError("Failed to fetch");
      const [status, body] = (await answer) ?? [200, {}];
      return Response.json(body, {
        status,
        headers: {
          "Content-Type":
            status >= 400 ? "application/problem+json" : "application/json",
        },
      });
    };
    if (url.pathname === "/api/promotions") return reply(offers);
    if (url.pathname === "/api/me/bonuses") return reply(bonuses);
    if (url.pathname === "/api/me") return reply(me);
    if (url.pathname === "/api/promo-codes/redeem") {
      return reply(
        redeemAnswers.shift() ?? [
          200,
          { result: "granted", message: "50 ETB free bet added" },
        ],
      );
    }
    return reply([404, problem(404, "NOT_FOUND")]);
  });
}

const asked = (path: string, method = "GET") =>
  calls.filter((c) => c.path === path && c.method === method);
const redeems = () => asked("/api/promo-codes/redeem", "POST");

beforeEach(() => {
  calls = [];
  offers = [200, OFFERS()];
  bonuses = [200, BONUSES()];
  redeemAnswers = [];
  me = [200, { player: CONTRACT_PLAYER }];
  useUiStore.setState({
    lang: "en",
    dataSaver: false,
    clock: "eat",
    calendar: "gregorian",
  });
  usePromoStore.setState({ intent: null });
  useAuthStore.setState({ entry: null });
  api();
});

afterEach(() => vi.restoreAllMocks());

/** The offers list, once it has loaded. */
const offersList = async () =>
  screen.findByRole("list", { name: en.promotions.offersTitle });

/** The player's bonus card, once it has loaded. */
const bonusSection = async () => {
  await screen.findByText(en.promotions.yourBonus);
  return screen.getByRole("region", { name: en.promotions.yourBonus });
};

const codeField = () =>
  screen.getByRole("textbox", { name: en.promotions.codeLabel });

async function typeAndRedeem(code: string) {
  const user = userEvent.setup();
  await user.clear(codeField());
  await user.type(codeField(), code);
  await user.click(screen.getByRole("button", { name: en.promotions.redeem }));
  return user;
}

describe("offers, the bonus and free bets (AC-11)", () => {
  it("shows each offer's title, summary and dates from /api/promotions", async () => {
    render(<PromotionsView />);

    const list = await offersList();
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("100% first deposit bonus")).toBeTruthy();
    expect(
      within(items[0]).getByText(
        "Up to 1,000 ETB, 5x wagering on 3+ leg accumulators at 1.50+",
      ),
    ).toBeTruthy();
    expect(within(items[0]).getByText("From 1 Nov 2026")).toBeTruthy();
    expect(within(items[0]).getByText("Full terms…")).toBeTruthy();
    expect(within(items[1]).getByText("Accumulator bonus")).toBeTruthy();
    expect(
      within(items[1]).getByText("Up to 100% extra profit on 20+ legs"),
    ).toBeTruthy();
    // The rule's code is the operator's, never the player's to see.
    expect(screen.queryByText(/WELCOME_100/)).toBeNull();
    expect(asked("/api/promotions")).toHaveLength(1);
  });

  it("shows an offer's image, but not with data saver on", async () => {
    const { unmount } = render(<PromotionsView />);
    const list = await offersList();
    const image = list.querySelector("img");
    expect(image?.getAttribute("src")).toBe(
      "https://cdn.example.et/promo/welcome.webp",
    );
    expect(image?.getAttribute("referrerpolicy")).toBe("no-referrer");
    unmount();

    useUiStore.setState({ dataSaver: true });
    render(<PromotionsView />);
    expect((await offersList()).querySelector("img")).toBeNull();
  });

  it("drops an offer's image that fails to load, leaving the text card", async () => {
    render(<PromotionsView />);
    const list = await offersList();
    const image = list.querySelector("img")!;
    expect(image.closest("[data-offer-image]")).not.toBeNull();

    // Prism's example host doesn't exist: the browser can't load it.
    act(() => {
      image.dispatchEvent(new Event("error"));
    });

    expect(list.querySelector("img")).toBeNull();
    expect(list.querySelector("[data-offer-image]")).toBeNull();
    expect(within(list).getByText("100% first deposit bonus")).toBeTruthy();
  });

  it("shows the active bonus's wagered and required amounts and its expiry exactly as the API sends them", async () => {
    render(<PromotionsView />);

    const section = await bonusSection();
    await within(section).findByText("ETB 850.00 of ETB 2,500.00 wagered");
    expect(within(section).getByText("100% first deposit bonus")).toBeTruthy();
    expect(within(section).getByText("ETB 500.00")).toBeTruthy();
    // The bar is the API's two figures: 850.00 of 2,500.00 is 34%.
    expect(
      section.querySelector<HTMLElement>("[data-wagered]")?.style.width,
    ).toBe("34%");
    // 09:00 UTC is 12:00 in East Africa Time.
    expect(
      within(section).getByText("Expires 17 Oct 2026, 12:00"),
    ).toBeTruthy();
    // No figure the API didn't send: nothing "left to wager".
    expect(within(section).queryByText(/1,650/)).toBeNull();
  });

  it("lists each free bet with its stake, conditions and expiry", async () => {
    render(<PromotionsView />);

    const list = await screen.findByRole("list", {
      name: en.promotions.freeBets,
    });
    const [bet] = within(list).getAllByRole("listitem");
    expect(within(bet).getByText("ETB 50.00 free bet")).toBeTruthy();
    expect(within(bet).getByText("Picks: 3 or more")).toBeTruthy();
    expect(within(bet).getByText("Odds per pick: 1.50 or more")).toBeTruthy();
    // No total-odds condition on this one: nothing said about it.
    expect(within(bet).queryByText(/Total odds/)).toBeNull();
    // 21:00 UTC on the 10th is midnight starting the 11th in EAT.
    expect(within(bet).getByText("Expires 11 Oct 2026, 00:00")).toBeTruthy();
  });

  it("says there is no active bonus and no free bets when the API has none", async () => {
    bonuses = [200, NONE];
    render(<PromotionsView />);

    expect(await screen.findByText(en.promotions.noBonus)).toBeTruthy();
    expect(screen.getByText(en.promotions.noFreeBets)).toBeTruthy();
    expect(screen.queryByText(/ of .* wagered$/)).toBeNull();
  });

  it("offers Try again when the bonus can't be read, and still shows the offers", async () => {
    bonuses = [503, problem(503, "SERVICE_UNAVAILABLE")];
    render(<PromotionsView />);

    await screen.findByText(en.promotions.bonusFailedTitle);
    expect(await offersList()).toBeTruthy();

    bonuses = [200, BONUSES()];
    await userEvent.click(
      screen.getByRole("button", {
        name: en.common.retry,
        description: en.promotions.bonusFailedTitle,
      }),
    );
    await screen.findByText("ETB 850.00 of ETB 2,500.00 wagered");
    expect(asked("/api/me/bonuses")).toHaveLength(2);
  });

  it("offers Try again when the offers can't be read, and says when there are none", async () => {
    offers = [503, problem(503, "SERVICE_UNAVAILABLE")];
    render(<PromotionsView />);

    await screen.findByText(en.promotions.offersFailedTitle);
    offers = [200, []];
    await userEvent.click(
      screen.getByRole("button", {
        name: en.common.retry,
        description: en.promotions.offersFailedTitle,
      }),
    );
    await screen.findByText(en.promotions.offersNone);
    expect(asked("/api/promotions")).toHaveLength(2);
  });

  it("asks a guest to log in and still shows the offers", async () => {
    render(<PromotionsView />, { session: "guest" });

    await screen.findByText(en.promotions.guestTitle);
    expect(await offersList()).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: en.header.login }),
    );
    expect(useAuthStore.getState().entry).toBe("login");
    // New here: a code is entered while signing up (REG-12).
    expect(screen.getByText(en.promotions.guestRegisterBody)).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: en.header.register }),
    );
    expect(useAuthStore.getState().entry).toBe("register");
    // Nothing of a player's is asked for.
    expect(asked("/api/me/bonuses")).toHaveLength(0);
  });

  it("shows neither a guest's prompt nor a bonus until /api/me has answered", async () => {
    me = new Promise(() => {});
    render(<PromotionsView />, { session: null });

    expect(await offersList()).toBeTruthy();
    expect(screen.queryByText(en.promotions.guestTitle)).toBeNull();
    expect(asked("/api/me/bonuses")).toHaveLength(0);
  });

  it("drops the player's bonus when another player signs in", async () => {
    const { queryClient } = render(
      <>
        <SessionWatcher />
        <PromotionsView />
      </>,
    );
    await screen.findByText("ETB 850.00 of ETB 2,500.00 wagered");
    expect(queryClient.getQueryData(bonusKeys.mine())).toBeTruthy();

    // Someone else signs in (another tab): the first player's bonus goes, and
    // the next player's is read for them.
    bonuses = [200, NONE];
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), {
        player: { ...CONTRACT_PLAYER, id: "01J9A7R0000000000000000099" },
      });
    });

    await screen.findByText(en.promotions.noBonus);
    expect(screen.queryByText("ETB 850.00 of ETB 2,500.00 wagered")).toBeNull();
    expect(asked("/api/me/bonuses")).toHaveLength(2);
  });

  it("moves to the code field from an offer that needs a code", async () => {
    offers = [
      200,
      OFFERS().map((offer, i) => ({ ...offer, requiresCode: i === 1 })),
    ];
    render(<PromotionsView />);

    const items = within(await offersList()).getAllByRole("listitem");
    expect(within(items[1]).getByText(en.promotions.needsCode)).toBeTruthy();
    expect(within(items[0]).queryByText(en.promotions.needsCode)).toBeNull();
    await userEvent.click(
      within(items[1]).getByRole("button", { name: en.promotions.enterCode }),
    );
    expect(document.activeElement).toBe(codeField());
  });

  it("reads in Amharic, the API's figures unchanged", async () => {
    useUiStore.setState({ lang: "am" });
    render(<PromotionsView />);

    await screen.findByText(am.promotions.yourBonus);
    await screen.findByText(
      am.promotions.wagered
        .replace("{required}", "2,500.00 ብር")
        .replace("{done}", "850.00 ብር"),
    );
  });
});

describe("promo codes (AC-12)", () => {
  it("sends the same Idempotency-Key when a code with no answer is tried again", async () => {
    redeemAnswers = ["drop", "drop"];
    render(<PromotionsView />);
    await bonusSection();

    const user = await typeAndRedeem("DERBY50");
    await screen.findByText(en.promotions.unconfirmedTitle);

    // Try again: /api/me says it is still this player, then the same key.
    await user.click(
      screen.getByRole("button", {
        name: en.common.retry,
        description: en.promotions.unconfirmedTitle,
      }),
    );
    // The button goes with its notice while the try is out: focus waits in
    // the field rather than falling to the page.
    expect(document.activeElement).toBe(codeField());
    await waitFor(() => expect(redeems()).toHaveLength(2));
    await screen.findByText(en.promotions.unconfirmedTitle);

    // Redeem with the same code is Try again too.
    await user.click(
      screen.getByRole("button", { name: en.promotions.redeem }),
    );
    await screen.findByText("50 ETB free bet added");

    const keys = redeems().map((c) => c.key);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(redeems().map((c) => c.body)).toEqual([
      { code: "DERBY50" },
      { code: "DERBY50" },
      { code: "DERBY50" },
    ]);
    // Each repeat asked who is signed in first.
    expect(asked("/api/me")).toHaveLength(2);
  });

  it("makes a new key for another code, and for the same code once it was answered", async () => {
    redeemAnswers = [
      "drop",
      [422, problem(422, "PROMO_INVALID")],
      [200, { result: "granted", message: null }],
    ];
    render(<PromotionsView />);
    await bonusSection();

    await typeAndRedeem("DERBY50");
    await screen.findByText(en.promotions.unconfirmedTitle);
    await typeAndRedeem("DERBY60");
    await screen.findByText(en.promotions.codeInvalidTitle);
    await typeAndRedeem("DERBY60");
    await screen.findByText(en.promotions.granted);

    const keys = redeems().map((c) => c.key);
    expect(new Set(keys).size).toBe(3);
  });

  it("says the code isn't valid on PROMO_INVALID and keeps it to edit", async () => {
    redeemAnswers = [[422, problem(422, "PROMO_INVALID")]];
    render(<PromotionsView />);
    await bonusSection();

    await typeAndRedeem("DERBY5O");

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(en.promotions.codeInvalidTitle),
    ).toBeTruthy();
    expect(within(alert).getByText(en.promotions.codeInvalidBody)).toBeTruthy();
    expect((codeField() as HTMLInputElement).value).toBe("DERBY5O");
    expect(document.activeElement).toBe(codeField());
    expect(codeField().getAttribute("aria-invalid")).toBe("true");
    // The field says why whenever it is reached again, not only once.
    expect(codeField()).toHaveAccessibleDescription(
      expect.stringContaining(en.promotions.codeInvalidTitle),
    );
  });

  it("says the code was already used on PROMO_ALREADY_USED", async () => {
    redeemAnswers = [[409, problem(409, "PROMO_ALREADY_USED")]];
    render(<PromotionsView />);
    await bonusSection();

    await typeAndRedeem("DERBY50");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(en.promotions.codeUsedTitle)).toBeTruthy();
    // A refusal moves no money: nothing is read again.
    expect(asked("/api/me/bonuses")).toHaveLength(1);
  });

  it("shows the API's message on a granted code and reads the bonus and the wallet again", async () => {
    const { queryClient } = render(<PromotionsView />);
    queryClient.setQueryData(
      walletKeys.balance(),
      toWalletBalances(example("/v1/wallet")),
    );
    queryClient.setQueryData(transactionKeys.recent("en"), []);
    await bonusSection();
    expect(asked("/api/me/bonuses")).toHaveLength(1);

    await typeAndRedeem("DERBY50");

    const message = await screen.findByText("50 ETB free bet added");
    expect(message.closest('[role="status"]')).not.toBeNull();
    await waitFor(() => expect(asked("/api/me/bonuses")).toHaveLength(2));
    expect(queryClient.getQueryState(walletKeys.balance())?.isInvalidated).toBe(
      true,
    );
    expect(
      queryClient.getQueryState(transactionKeys.recent("en"))?.isInvalidated,
    ).toBe(true);
    expect((codeField() as HTMLInputElement).value).toBe("");
  });

  it("says the code was accepted when the API sends no message, and offers Deposit when it waits for a deposit", async () => {
    redeemAnswers = [
      [200, { result: "granted", message: null }],
      [200, { result: "pending_deposit", message: null }],
    ];
    render(<PromotionsView />);
    await bonusSection();

    await typeAndRedeem("DERBY50");
    await screen.findByText(en.promotions.granted);
    expect(screen.queryByRole("link", { name: en.header.deposit })).toBeNull();

    await typeAndRedeem("FIRSTDEP");
    await screen.findByText(en.promotions.pendingDeposit);
    expect(
      screen
        .getByRole("link", { name: en.header.deposit })
        .getAttribute("href"),
    ).toBe("/wallet?action=deposit");
  });

  it("keeps Redeem off until a code is typed, and takes the player to the field", async () => {
    render(<PromotionsView />);
    await bonusSection();
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: en.promotions.redeem });

    expect(button.getAttribute("aria-disabled")).toBe("true");
    await user.click(button);
    expect(document.activeElement).toBe(codeField());
    await user.type(codeField(), "   ");
    expect(button.getAttribute("aria-disabled")).toBe("true");

    await user.type(codeField(), "DERBY50");
    expect(button.getAttribute("aria-disabled")).toBeNull();
    expect(redeems()).toHaveLength(0);
  });

  it("sends nothing while a code is on its way, and nothing empty", async () => {
    let answer!: (reply: [number, unknown]) => void;
    redeemAnswers = [new Promise((resolve) => (answer = resolve))];
    render(<PromotionsView />);
    await bonusSection();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: en.promotions.redeem }),
    );
    await user.type(codeField(), "   ");
    await user.click(
      screen.getByRole("button", { name: en.promotions.redeem }),
    );
    expect(redeems()).toHaveLength(0);

    await user.clear(codeField());
    await user.type(codeField(), " DERBY50 {Enter}");
    const busy = await screen.findByRole("button", {
      name: en.promotions.redeeming,
    });
    await user.click(busy);
    await user.type(codeField(), "{Enter}");
    expect(redeems()).toHaveLength(1);
    expect(redeems()[0].body).toEqual({ code: "DERBY50" });

    answer([200, { result: "granted", message: null }]);
    await screen.findByText(en.promotions.granted);
  });

  it("offers Verify when the API asks for an ID first", async () => {
    redeemAnswers = [[403, problem(403, "KYC_REQUIRED")]];
    render(<PromotionsView />);
    await bonusSection();

    await typeAndRedeem("DERBY50");

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(en.promotions.codeRefusedTitle),
    ).toBeTruthy();
    expect(
      within(alert).getByText("The API's title for KYC_REQUIRED"),
    ).toBeTruthy();
    await userEvent.click(
      within(alert).getByRole("button", { name: en.profile.verify }),
    );
    expect(useAuthStore.getState().entry).toBe("verify");
  });

  it("keeps a code with no answer for Try again when the player comes back", async () => {
    redeemAnswers = ["drop"];
    const first = render(<PromotionsView />);
    await bonusSection();
    await typeAndRedeem("DERBY50");
    await screen.findByText(en.promotions.unconfirmedTitle);
    first.unmount();

    render(<PromotionsView />);
    await bonusSection();
    expect(screen.getByText(en.promotions.unconfirmedTitle)).toBeTruthy();
    expect((codeField() as HTMLInputElement).value).toBe("DERBY50");
    await userEvent.click(
      screen.getByRole("button", { name: en.common.retry }),
    );
    await screen.findByText("50 ETB free bet added");
    expect(new Set(redeems().map((c) => c.key)).size).toBe(1);
  });

  it("reads the bonus and the wallet again when a code had no answer", async () => {
    redeemAnswers = ["drop"];
    const { queryClient } = render(<PromotionsView />);
    queryClient.setQueryData(
      walletKeys.balance(),
      toWalletBalances(example("/v1/wallet")),
    );
    await bonusSection();
    expect(asked("/api/me/bonuses")).toHaveLength(1);

    await typeAndRedeem("DERBY50");
    await screen.findByText(en.promotions.unconfirmedTitle);

    // It may have gone through: what the server holds now is what shows.
    await waitFor(() => expect(asked("/api/me/bonuses")).toHaveLength(2));
    expect(queryClient.getQueryState(walletKeys.balance())?.isInvalidated).toBe(
      true,
    );
  });

  it("shows the answer to a code sent before the player left when they come back", async () => {
    let answer!: (reply: [number, unknown]) => void;
    redeemAnswers = [new Promise((resolve) => (answer = resolve))];
    const first = render(<PromotionsView />);
    await bonusSection();
    await typeAndRedeem("DERBY50");
    await screen.findByRole("button", { name: en.promotions.redeeming });
    first.unmount();

    render(<PromotionsView />);
    await bonusSection();
    expect(
      screen.getByRole("button", { name: en.promotions.redeeming }),
    ).toBeTruthy();
    answer([422, problem(422, "PROMO_INVALID")]);

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(en.promotions.codeInvalidTitle),
    ).toBeTruthy();
    // The refused code is back in the field, to change.
    expect((codeField() as HTMLInputElement).value).toBe("DERBY50");
  });

  it("sends nothing on Try again when someone else is signed in now", async () => {
    redeemAnswers = ["drop"];
    render(<PromotionsView />);
    await bonusSection();
    await typeAndRedeem("DERBY50");
    await screen.findByText(en.promotions.unconfirmedTitle);

    me = [
      200,
      { player: { ...CONTRACT_PLAYER, id: "01J9A7R0000000000000000099" } },
    ];
    await userEvent.click(
      screen.getByRole("button", { name: en.common.retry }),
    );

    // The second read is the session's, read again because someone else is
    // signed in: only the refused path makes it, so nothing more can follow.
    await waitFor(() => expect(asked("/api/me")).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByText(en.promotions.unconfirmedTitle)).toBeNull(),
    );
    expect(redeems()).toHaveLength(1);
  });
});

describe("where players find it", () => {
  it("is in the desktop nav and the phone's Menu while the tenant offers bonuses", () => {
    render(
      <>
        <MainNav />
        <ProfileView />
      </>,
    );

    const nav = screen.getByRole("link", { name: en.nav.promotions });
    expect(nav.getAttribute("href")).toBe("/promotions");
    expect(nav.getAttribute("aria-current")).toBe("page");
    const row = screen.getByRole("link", {
      name: `${en.nav.promotions}${en.promotions.menuBody}`,
    });
    expect(row.getAttribute("href")).toBe("/promotions");
  });

  it("is offered to a guest too", () => {
    render(
      <>
        <MainNav />
        <ProfileView />
      </>,
      { session: "guest" },
    );

    expect(
      screen.getAllByRole("link", { name: new RegExp(en.nav.promotions) }),
    ).toHaveLength(2);
  });

  it("is in neither when the tenant has no bonuses", () => {
    render(
      <>
        <MainNav />
        <ProfileView />
      </>,
      { bonuses: false },
    );

    expect(
      screen.queryByRole("link", { name: new RegExp(en.nav.promotions) }),
    ).toBeNull();
  });

  it("lights the phone's Menu tab", () => {
    render(<MobileTabBar />);

    expect(
      screen
        .getByRole("link", { name: en.nav.menu })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: en.nav.sports })
        .getAttribute("aria-current"),
    ).toBeNull();
  });
});
