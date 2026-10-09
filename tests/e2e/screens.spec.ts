import { mkdirSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import en from "../../src/lib/i18n/messages/en.json";
import am from "../../src/lib/i18n/messages/am.json";

const MESSAGES = { en, am } as const;
type Device = "phone" | "desktop";
type Lang = keyof typeof MESSAGES;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A slip with one open price from each match on the board (the contract's
 * Real Madrid market is suspended, so two on a phone), open, with the
 * calculation expanded: every D1 figure on one screen.
 */
async function openSlipWithPicks(page: Page, device: Device, lang: Lang) {
  // Odds buttons are named "<match>: <pick> <odds>" in both languages.
  const prices = page.getByRole("button", { name: /: .+ \d+\.\d{2}(,|$)/ });
  await prices.first().waitFor();
  const labels = await prices.evaluateAll((buttons) =>
    buttons.map((b) => b.getAttribute("aria-label") ?? ""),
  );
  const matches = new Set<string>();
  for (const [index, label] of labels.entries()) {
    const match = label.split(":")[0];
    if (matches.has(match)) continue;
    matches.add(match);
    await prices.nth(index).click();
    if (matches.size === 3) break;
  }

  const t = MESSAGES[lang];
  if (device === "phone") {
    await page
      .getByRole("button", {
        name: new RegExp(escape(t.nav.slipAria).replace("\\{n\\}", "\\d+")),
      })
      .click();
  }
}

/** Slip 1 built, then Slip 2 opened from its tab (F3c): the tabs and their counts. */
async function openSecondSlip(page: Page, device: Device, lang: Lang) {
  await openSlipWithPicks(page, device, lang);
  const t = MESSAGES[lang];
  const second = new RegExp(`^${escape(t.betSlip.slipN.replace("{n}", "2"))}`);
  await page
    .getByRole("button", { name: second })
    .locator("visible=true")
    .first()
    .click();
  await page
    .getByText(t.betSlip.emptyTitle)
    .locator("visible=true")
    .first()
    .waitFor();
}

/**
 * A guest's slip after Book bet: the server's code, its expiry and the share
 * buttons. Logging out from Profile is how a session becomes a guest.
 */
async function bookAsGuest(page: Page, device: Device, lang: Lang) {
  const t = MESSAGES[lang];
  // Prism's example code has a fixed expiry (4 October 2026), and the slip
  // drops a code once its lifetime has passed. Give the screen a live one:
  // the same receipt, expiring a day after Prism issued it.
  await page.route("**/api/bookings", async (route) => {
    const response = await route.fetch();
    const receipt = await response.json();
    receipt.expiresAt = new Date(
      Date.parse(receipt.issuedAt) + 24 * 60 * 60 * 1000,
    ).toISOString();
    await route.fulfill({ response, json: receipt });
  });
  await page.getByRole("button", { name: t.profile.logOut }).click();
  await page.waitForURL("/");
  await openSlipWithPicks(page, device, lang);
  await page.getByRole("button", { name: t.betSlip.bookBet }).click();
  // The code opens in a dialog over the slip (the user's fourth review),
  // with its Copy and Share. A full-page shot of a scrolled page paints the
  // sticky header mid-page, so go back to the top.
  await page.getByRole("dialog", { name: t.betSlip.bookingCode }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
}

/**
 * A player, signed in through the route handler before the page loads. Prism
 * answers login with the contract's example, so the cookie this sets is a
 * real sealed session; the pages behind the proxy need it.
 */
async function loginViaApi(page: Page) {
  const response = await page.request.post("/api/auth/login", {
    data: { phone: "911234567", password: "correct horse battery" },
    headers: { "X-Requested-With": "KelalSport" },
  });
  if (!response.ok()) {
    throw new Error(`login failed: ${response.status()}`);
  }
}

/**
 * The account's language, as `/api/me` reads it: Prism's player saved Amharic,
 * which a screen in English would rightly say isn't saved (F7b). A screen of
 * the profile as it usually is reads its own language.
 */
const accountReads = (choose: (lang: Lang) => Lang) =>
  async function (page: Page, lang: Lang) {
    await loginViaApi(page);
    await page.route("**/api/me", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      const json = await response.json();
      if (json.player) json.player.language = choose(lang);
      await route.fulfill({ response, json });
    });
  };
const playerReadingTheScreen = accountReads((lang) => lang);

/** The devices list on Profile, once it has loaded. */
const devicesShow = async (page: Page, _device: Device, lang: Lang) => {
  await page.getByText(MESSAGES[lang].profile.thisDevice).first().waitFor();
};

/**
 * The reality check, an hour into the visit: Prism's player has
 * `reality_check_minutes: 60`. The page's clock is installed before it loads
 * and moved on once it has.
 */
const realityCheckDue = async (page: Page, lang: Lang) => {
  await page.clock.install();
  await playerReadingTheScreen(page, lang);
};
const anHourLater = async (page: Page) => {
  await page.clock.fastForward("01:00:00");
  await page.getByRole("alertdialog").waitFor();
};

/**
 * The login dialog after an answer Prism is asked for with `Prefer` (next dev
 * forwards it): `code=202` is the new-device code step, `code=401` a wrong
 * password, `code=423` a locked account.
 */
const loginAnswering =
  (prefer: string) => async (page: Page, _device: Device, lang: Lang) => {
    const t = MESSAGES[lang];
    await page.route("**/api/auth/login", (route) =>
      route.continue({
        headers: { ...route.request().headers(), prefer },
      }),
    );
    // The dialog's own form: a guest's header has a Log in button too.
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(t.auth.phone, { exact: true }).fill("911234567");
    await dialog
      .getByLabel(t.auth.password, { exact: true })
      .fill("correct horse battery");
    const answered = page.waitForResponse("**/api/auth/login");
    await dialog
      .getByRole("button", { name: t.auth.logIn, exact: true })
      .click();
    await answered;
  };

/** Asks Prism for a named answer on one of this app's routes (next dev only). */
const preferOn = (page: Page, route: string, prefer: string) =>
  page.route(`**${route}`, (r) =>
    r.continue({ headers: { ...r.request().headers(), prefer } }),
  );

/**
 * Registration through the dialog, as far as `stop`: the code step, the
 * details filled in, or the ID step with the account created (Prism's
 * register example sets a real sealed session).
 */
async function registerTo(
  page: Page,
  lang: Lang,
  stop: "code" | "details" | "created",
) {
  const t = MESSAGES[lang];
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(t.auth.phone, { exact: true }).fill("911234567");
  await dialog.getByRole("checkbox").nth(0).check();
  await dialog.getByRole("checkbox").nth(1).check();
  await dialog
    .getByRole("button", { name: t.auth.continue, exact: true })
    .click();
  await dialog.getByLabel(t.auth.otpLabel).waitFor();
  if (stop === "code") return;

  await dialog.getByLabel(t.auth.otpLabel).fill("482913");
  await dialog
    .getByRole("button", { name: t.auth.continue, exact: true })
    .click();
  await dialog.getByLabel(t.auth.fullName).fill("Abebe Kebede");
  await dialog.getByLabel(t.auth.dateOfBirth).fill("12/04/1998");
  await dialog
    .getByLabel(t.auth.password, { exact: true })
    .fill("correct horse battery");
  await dialog.getByLabel(t.auth.confirmPassword).fill("correct horse battery");
  if (stop === "details") return;

  const answered = page.waitForResponse("**/api/auth/register");
  await dialog.getByRole("button", { name: t.auth.createAccount }).click();
  await answered;
}

const registerStep =
  (stop: "code" | "details" | "created") =>
  async (page: Page, _device: Device, lang: Lang) => {
    await registerTo(page, lang, stop);
    if (stop === "created") {
      await page
        .getByRole("dialog")
        .getByLabel(MESSAGES[lang].auth.fin)
        .waitFor();
    }
  };

/**
 * A promo code typed at sign-up that the API refuses (REG-12, F7ca): Prism has
 * no `PROMO_*` example, so the route answers with the Problem.
 */
async function promoRefusedAtSignUp(page: Page, _device: Device, lang: Lang) {
  const t = MESSAGES[lang];
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 422,
      contentType: "application/problem+json",
      json: problemJson(422, "PROMO_INVALID"),
    }),
  );
  await registerTo(page, lang, "details");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(t.auth.promoCode).fill("WELC0ME");
  await dialog.getByRole("button", { name: t.auth.createAccount }).click();
  await dialog.getByText(t.auth.errors.promoInvalid).waitFor();
}

/** `REG_PHONE_TAKEN`: Prism's 409 on `/v1/auth/otp`. */
async function phoneTaken(page: Page, _device: Device, lang: Lang) {
  await preferOn(page, "/api/auth/otp", "code=409");
  const t = MESSAGES[lang];
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(t.auth.phone, { exact: true }).fill("911234567");
  await dialog.getByRole("checkbox").nth(0).check();
  await dialog.getByRole("checkbox").nth(1).check();
  await dialog
    .getByRole("button", { name: t.auth.continue, exact: true })
    .click();
  await dialog.getByRole("alert").waitFor();
}

/**
 * `AUTH_OTP_INVALID` at Create account. Prism has no example of it (contract
 * request 006), so this app's own route answers with the contract's
 * `Problem` shape, in the browser.
 */
async function codeRefused(page: Page, _device: Device, lang: Lang) {
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 422,
      contentType: "application/problem+json",
      json: {
        type: "https://api.example.et/errors/otp-invalid",
        title: "Wrong code",
        status: 422,
        code: "AUTH_OTP_INVALID",
        request_id: "req_ui",
      },
    }),
  );
  await registerTo(page, lang, "created");
  await page.getByRole("dialog").getByRole("alert").waitFor();
}

/** Fayda's verdict, by Prism's named example on `/v1/kyc/fayda/verify` (AC-10). */
const faydaVerdict =
  (example: "verified" | "pending" | "needs_info") =>
  async (page: Page, _device: Device, lang: Lang) => {
    await preferOn(page, "/api/kyc/fayda/verify", `example=${example}`);
    const t = MESSAGES[lang];
    await registerTo(page, lang, "created");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(t.auth.fin).fill("482109375516");
    await dialog.getByRole("checkbox").first().check();
    await dialog.getByRole("button", { name: t.auth.verifyWithFayda }).click();
    await dialog.getByLabel(t.auth.otpLabel).fill("123456");
    const answered = page.waitForResponse("**/api/kyc/fayda/verify");
    await dialog
      .getByRole("button", { name: t.auth.verify, exact: true })
      .click();
    await answered;
    const title = {
      verified: t.auth.kycVerifiedTitle,
      pending: t.auth.pendingTitle,
      needs_info: t.auth.needsInfoTitle,
    }[example];
    await dialog.getByRole("heading", { name: title }).waitFor();
  };

/** A forgotten password from the login form, to the code step or done (AC-9). */
const resetTo =
  (stop: "code" | "done") =>
  async (page: Page, _device: Device, lang: Lang) => {
    const t = MESSAGES[lang];
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(t.auth.phone, { exact: true }).fill("911234567");
    await dialog.getByRole("button", { name: t.auth.forgotPassword }).click();
    await dialog.getByRole("button", { name: t.auth.sendCode }).click();
    await dialog.getByLabel(t.auth.otpLabel).waitFor();
    if (stop === "code") return;

    await dialog.getByLabel(t.auth.otpLabel).fill("551203");
    await dialog
      .getByRole("button", { name: t.auth.continue, exact: true })
      .click();
    await dialog.getByLabel(t.auth.newPassword).fill("another long passphrase");
    await dialog
      .getByLabel(t.auth.confirmPassword)
      .fill("another long passphrase");
    await dialog.getByRole("button", { name: t.auth.savePassword }).click();
    await dialog.getByRole("status").waitFor();
  };

/**
 * A signed-in player's slip, placed through `/api/bets`, showing the engine's
 * answer. `answer` sets it up first — Prism's `Prefer` (next dev forwards it),
 * an answer this app's route gives in the browser where Prism has no example
 * (an RG refusal), or no answer at all. `askMe` sets the odds policy to Ask me
 * first, so a re-priced pick waits for Accept whichever way it moved (Prism's
 * 409 names a price, not a direction).
 */
const placeAnd =
  (
    shown: "ticket" | "alert" | "status",
    {
      answer,
      askMe = false,
      then,
    }: {
      answer?: (page: Page) => Promise<unknown>;
      askMe?: boolean;
      /** A step after the answer, e.g. changing the slip. */
      then?: (page: Page, lang: Lang) => Promise<unknown>;
    } = {},
  ) =>
  async (page: Page, device: Device, lang: Lang) => {
    const t = MESSAGES[lang];
    if (answer) await answer(page);
    await openSlipWithPicks(page, device, lang);
    if (askMe) {
      await page
        .getByLabel(t.betSlip.oddsPolicy.label)
        .filter({ visible: true })
        .selectOption("none");
    }
    await page
      .getByRole("button", { name: new RegExp(escape(t.betSlip.placeBet)) })
      .filter({ visible: true })
      .click();
    const result =
      shown === "ticket"
        ? page.getByTestId("ticket-code").filter({ visible: true })
        : page.getByRole(shown).filter({ visible: true }).first();
    await result.waitFor();
    if (then) await then(page, lang);
    // On a phone the sheet scrolls inside itself: bring the answer into view.
    // On desktop, back to the top so the sticky header stays where it is.
    if (device === "phone") await result.scrollIntoViewIfNeeded();
    else await page.evaluate(() => window.scrollTo(0, 0));
  };

/** A refusal Prism has no example of: the contract's Problem, in the browser. */
const refuse =
  (status: number, problem: Record<string, unknown>) => (page: Page) =>
    page.route("**/api/bets", (route) =>
      route.fulfill({
        status,
        contentType: "application/problem+json",
        json: {
          type: "https://api.example.et/errors/x",
          status,
          request_id: "req_ui",
          ...problem,
        },
      }),
    );

/** `RG_LIMIT_REACHED` has no Prism example: the contract's Problem, in the browser. */
const limitReached = (page: Page) =>
  page.route("**/api/bets", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/problem+json",
      json: {
        type: "https://api.example.et/errors/rg-limit",
        title: "Limit reached",
        status: 403,
        code: "RG_LIMIT_REACHED",
        detail: "Your daily stake limit resets at 00:00.",
        request_id: "req_ui",
      },
    }),
  );

/** No answer to the first try, then 429 to its Try again: still unconfirmed. */
const dropThenRateLimited = (page: Page) => {
  let tries = 0;
  return page.route("**/api/bets", (route) =>
    tries++ === 0
      ? route.abort("connectionreset")
      : route.fulfill({
          status: 429,
          contentType: "application/problem+json",
          headers: { "Retry-After": "30" },
          json: {
            type: "https://api.example.et/errors/rate-limited",
            title: "Too many requests",
            status: 429,
            code: "RATE_LIMITED",
            request_id: "req_ui",
          },
        }),
  );
};

/**
 * My bets as the real API answers each tab. Prism ignores `status` and sends
 * both example bets for either, so the route's own answer is shaped here:
 * open bets under Open, the rest under Settled — the app itself shows
 * whatever the API returns. `more` gives the first page a `next_cursor`, so
 * Show more is on screen.
 */
const myBets =
  ({ more = false }: { more?: boolean } = {}) =>
  async (page: Page) => {
    await loginViaApi(page);
    await page.route(/\/api\/bets\?/, async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as {
        items: { status: string }[];
        nextCursor: string | null;
      };
      const query = new URL(route.request().url()).searchParams;
      const open = query.get("status") === "open";
      body.items = body.items.filter((bet) => (bet.status === "open") === open);
      if (more && !query.has("cursor")) body.nextCursor = "c2";
      await route.fulfill({ response, json: body });
    });
  };

/** My bets answered by the browser: no bets, or a failure. */
const myBetsAnswer = (status: number, json: unknown) => async (page: Page) => {
  await loginViaApi(page);
  await page.route(/\/api\/bets\?/, (route) =>
    route.fulfill({
      status,
      contentType:
        status >= 400 ? "application/problem+json" : "application/json",
      json,
    }),
  );
};

/**
 * A guest on My bets: a session cookie the proxy lets through (it only looks
 * for one) but the API doesn't honour, so `/api/me` says nobody — as when a
 * session ends with the page open.
 */
const staleSession = async (page: Page) => {
  await page.context().addCookies([
    {
      name: "kelal.session",
      value: "v1.stale",
      url: "http://localhost:3000",
    },
  ]);
};

/** My bets, with the next page failing. */
const myBetsMoreFails = async (page: Page) => {
  await myBets({ more: true })(page);
  await page.route(/\/api\/bets\?.*cursor=/, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      json: {
        type: "about:blank",
        title: "The sportsbook API could not be reached",
        status: 503,
        code: "SERVICE_UNAVAILABLE",
      },
    }),
  );
};

const showMoreFails = async (page: Page, _device: Device, lang: Lang) => {
  const t = MESSAGES[lang];
  await page.getByRole("button", { name: t.bets.showMore }).first().click();
  // Retried twice, as every read is, before it says so.
  await page.getByText(t.bets.moreFailed).first().waitFor();
};

/** The ticket detail, answered by the browser: not on this account, or failing. */
const ticketAnswer = (status: number, code: string) => async (page: Page) => {
  await loginViaApi(page);
  await page.route(/\/api\/bets\/01J9A7V0000000000000000001/, (route) =>
    route.fulfill({
      status,
      contentType: "application/problem+json",
      json: { type: "about:blank", title: code, status, code },
    }),
  );
};

const waitForTicketFailure = async (
  page: Page,
  _device: Device,
  lang: Lang,
) => {
  await page
    .getByRole("heading", { name: MESSAGES[lang].bets.ticketFailedTitle })
    .waitFor();
};

/** A failed read is retried twice (the app's default) before it says so. */
const waitForBetsFailure = async (page: Page, _device: Device, lang: Lang) => {
  await page
    .getByRole("heading", { name: MESSAGES[lang].bets.loadFailedTitle })
    .waitFor();
};

const showSettled = async (page: Page, _device: Device, lang: Lang) => {
  await page
    .getByRole("button", { name: MESSAGES[lang].bets.tabSettled })
    .first()
    .click();
};

/**
 * The wallet holding something back: a pending withdrawal and an amount owed,
 * answered in the browser (Prism's player has neither) — with the withdrawal
 * that locked the 300.00 as its recent activity, so the page agrees with
 * itself.
 */
const walletHeld = async (page: Page) => {
  await loginViaApi(page);
  await page.route("**/api/wallet", (route) =>
    route.fulfill({
      json: {
        cash: "0.00",
        bonus: "0.00",
        locked: "300.00",
        debt: "120.00",
        currency: "ETB",
      },
    }),
  );
  await page.route(/\/api\/wallet\/transactions/, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "01J9A7U0000000000000000009",
            type: "withdrawal",
            amount: "-300.00",
            balanceAfter: "0.00",
            label: "telebirr",
            reference: { type: "payment", id: "01J9A7Y0000000000000000001" },
            createdAt: "2026-10-03T09:00:00Z",
          },
        ],
        nextCursor: null,
      },
    }),
  );
};

/** The wallet failing to load: Prism has no failure for it. */
const walletFails = async (page: Page) => {
  await loginViaApi(page);
  await page.route("**/api/wallet", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      json: {
        type: "about:blank",
        title: "The sportsbook API could not be reached",
        status: 503,
        code: "SERVICE_UNAVAILABLE",
      },
    }),
  );
};

/** A failed read is retried twice (the app's default) before it says so. */
const waitForWalletFailure = async (
  page: Page,
  _device: Device,
  lang: Lang,
) => {
  await page
    .getByRole("heading", { name: MESSAGES[lang].wallet.loadFailedTitle })
    .waitFor();
};

/** The history answered by the browser: nothing yet, or a failure. */
const historyAnswer = (status: number, json: unknown) => async (page: Page) => {
  await loginViaApi(page);
  await page.route(/\/api\/wallet\/transactions/, (route) =>
    route.fulfill({
      status,
      contentType:
        status >= 400 ? "application/problem+json" : "application/json",
      json,
    }),
  );
};

/** The history with a next page, so Show more is on screen (Prism's has none). */
const historyMore = async (page: Page) => {
  await loginViaApi(page);
  await page.route(/\/api\/wallet\/transactions/, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { nextCursor: string | null };
    if (!new URL(route.request().url()).searchParams.has("cursor")) {
      body.nextCursor = "c2";
    }
    await route.fulfill({ response, json: body });
  });
};

/** The history with a next page that fails to load. */
const historyMoreFails = async (page: Page) => {
  await historyMore(page);
  await page.route(/\/api\/wallet\/transactions\?.*cursor=/, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      json: {
        type: "about:blank",
        title: "The sportsbook API could not be reached",
        status: 503,
        code: "SERVICE_UNAVAILABLE",
      },
    }),
  );
};

const historyShowMoreFails = async (
  page: Page,
  _device: Device,
  lang: Lang,
) => {
  const t = MESSAGES[lang];
  await page.getByRole("button", { name: t.history.showMore }).click();
  // Retried twice, as every read is, before it says so.
  await page.getByText(t.history.moreFailed).waitFor();
};

/** A failed read is retried twice (the app's default) before it says so. */
const waitForHistoryFailure = async (
  page: Page,
  _device: Device,
  lang: Lang,
) => {
  await page
    .getByRole("heading", { name: MESSAGES[lang].history.loadFailedTitle })
    .waitFor();
};

// ── deposits (F6b) ──────────────────────────────────────────────────────────

/**
 * A deposit as `/api/deposits` answers it: the contract's phone deposit
 * (CBE Birr, 500.00), mapped, in the state a screen needs. Prism has no
 * initiated, failed or expired deposit, so those are answered in the browser.
 */
const deposit = (changes: Record<string, unknown> = {}) => ({
  id: "01J9A7W0000000000000000003",
  method: "cbebirr",
  amount: "500.00",
  status: "pending",
  nextAction: {
    type: "ussd_push",
    message: "Approve the payment on your phone",
  },
  failureReason: null,
  expiresAt: "2026-10-03T14:13:10Z",
  createdAt: "2026-10-03T13:58:10Z",
  completedAt: null,
  ...changes,
});

const problemJson = (status: number, code: string, extra = {}) => ({
  type: "about:blank",
  title: code,
  status,
  code,
  ...extra,
});

/** When the break `onBreak` reports ends: 10 Oct, 18:00 EAT. */
const BREAK_UNTIL = "2026-10-10T15:00:00Z";

/**
 * `/api/me` as the API reports a player on a break (F7a) — from the start, or
 * only once a request to `after` has gone (the refusal that reveals a break
 * taken on another device); `permanent` is a self-exclusion with no end
 * (`status: self_excluded`, no date). Prism's player has none.
 */
const onBreak = async (
  page: Page,
  after?: string,
  { permanent = false }: { permanent?: boolean } = {},
) => {
  let revealed = after === undefined;
  if (after) {
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === after) revealed = true;
    });
  }
  await page.route("**/api/me", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as {
      player: { status: string; flags: Record<string, unknown> } | null;
    };
    if (revealed && body.player) {
      if (permanent) body.player.status = "self_excluded";
      else body.player.flags.excludedUntil = BREAK_UNTIL;
    }
    await route.fulfill({ response, json: body });
  });
};

/** A weekly deposit limit lowered to 600.00: in force at once, as the API answers it. */
const LOWERED_LIMIT = {
  type: "deposit",
  period: "week",
  amount: "600.00",
  minutes: null,
  effectiveFrom: "2026-10-05T09:00:00Z",
  used: "500.00",
  pending: null,
};

/** Logged in, with saving a limit answered in the browser — and every read after it. */
const limitLowered = async (page: Page) => {
  await loginViaApi(page);
  let lowered = false;
  await page.route("**/api/me/limits", async (route) => {
    if (route.request().method() === "PUT") {
      lowered = true;
      return route.fulfill({ json: LOWERED_LIMIT });
    }
    if (!lowered) return route.continue();
    const response = await route.fetch();
    const limits = (await response.json()) as Array<{ type: string }>;
    await route.fulfill({
      response,
      json: [LOWERED_LIMIT, ...limits.filter((l) => l.type !== "deposit")],
    });
  });
};

/** The limits answered in the browser: none set, or a failure. */
const limitsAnswer = (status: number, json: unknown) => async (page: Page) => {
  await loginViaApi(page);
  await page.route("**/api/me/limits", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status,
          contentType:
            status >= 400 ? "application/problem+json" : "application/json",
          json,
        })
      : route.continue(),
  );
};

/** The deposit card's New limit, typed and saved. */
const saveDepositLimit =
  (amount: string) => async (page: Page, _device: Device, lang: Lang) => {
    const t = MESSAGES[lang];
    const card = page.getByRole("region", { name: t.rg.depositLimit });
    await card.getByLabel(t.rg.newLimit).fill(amount);
    await card.getByRole("button", { name: t.rg.saveLimit }).click();
    await card.getByRole("status").waitFor();
  };

/** A length chosen in a group, its button pressed: the question asked once. */
const askFor =
  (
    group: (t: (typeof MESSAGES)[Lang]) => string,
    length: (t: (typeof MESSAGES)[Lang]) => string,
    button: (t: (typeof MESSAGES)[Lang]) => string,
    confirm = false,
  ) =>
  async (page: Page, _device: Device, lang: Lang) => {
    const t = MESSAGES[lang];
    await page
      .getByRole("radiogroup", { name: group(t) })
      .getByRole("radio", { name: length(t) })
      .click();
    await page.getByRole("button", { name: button(t) }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor();
    if (!confirm) return;
    await dialog.getByRole("button", { name: t.rg.confirm }).click();
    await page.getByRole("heading", { name: t.rg.breakStartedTitle }).waitFor();
  };

/** Logged in, with starting a break answered in the browser — `"abort"` for no answer. */
const exclusionAnswers =
  (answer: [number, unknown] | "abort") => async (page: Page) => {
    await loginViaApi(page);
    await page.route("**/api/me/self-exclusion", (route) =>
      answer === "abort"
        ? route.abort("failed")
        : route.fulfill({
            status: answer[0],
            contentType:
              answer[0] >= 400
                ? "application/problem+json"
                : "application/json",
            json: answer[1],
          }),
    );
  };

/** A length chosen and its question confirmed; waits for `text`. */
const confirmBreak =
  (
    group: (t: (typeof MESSAGES)[Lang]) => string,
    length: (t: (typeof MESSAGES)[Lang]) => string,
    button: (t: (typeof MESSAGES)[Lang]) => string,
    text: (t: (typeof MESSAGES)[Lang]) => string,
  ) =>
  async (page: Page, device: Device, lang: Lang) => {
    const t = MESSAGES[lang];
    await askFor(group, length, button)(page, device, lang);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t.rg.confirm })
      .click();
    await page.getByText(text(t), { exact: true }).first().waitFor();
  };

/** Waits for a heading, by its message. */
const headingShows =
  (text: (t: (typeof MESSAGES)[Lang]) => string) =>
  async (page: Page, _device: Device, lang: Lang) => {
    await page.getByRole("heading", { name: text(MESSAGES[lang]) }).waitFor();
  };

/**
 * Logged in, with starting a deposit answered in the browser — `"abort"` for
 * no answer at all — and, when given, every read of it.
 */
const depositAnswers =
  (start: [number, unknown] | "abort", read?: [number, unknown]) =>
  async (page: Page) => {
    await loginViaApi(page);
    await page.route("**/api/deposits", (route) =>
      start === "abort"
        ? route.abort("failed")
        : route.fulfill({
            status: start[0],
            contentType:
              start[0] >= 400 ? "application/problem+json" : "application/json",
            json: start[1],
          }),
    );
    if (read) {
      await page.route(/\/api\/deposits\/[^/?]+$/, (route) =>
        route.fulfill({
          status: read[0],
          contentType:
            read[0] >= 400 ? "application/problem+json" : "application/json",
          json: read[1],
        }),
      );
    }
  };

/** Logged in, with Prism asked for a named deposit on this app's routes. */
const depositPrism = async (page: Page) => {
  await loginViaApi(page);
  await preferOn(page, "/api/deposits", "example=ussd_push");
};

/** The deposit flow on `/wallet?action=deposit`, as far as `stop`. */
const depositTo =
  (stop: "amount" | "confirm" | "confirmed", amount?: string) =>
  async (page: Page, _device: Device, lang: Lang) => {
    const t = MESSAGES[lang];
    await page.getByRole("button", { name: /CBE Birr/ }).click();
    await page
      .getByRole("button", { name: t.wallet.continue, exact: true })
      .click();
    if (amount !== undefined) {
      await page.getByLabel(t.wallet.amount, { exact: true }).fill(amount);
    }
    if (stop === "amount") return;
    await page
      .getByRole("button", { name: t.wallet.continue, exact: true })
      .click();
    if (stop === "confirm") return;
    await page
      .getByRole("button", { name: t.wallet.confirmDeposit, exact: true })
      .click();
  };

/** Confirmed, then waits for `text` — a status's title or a refusal's. */
const depositShows =
  (text: (t: (typeof MESSAGES)[Lang]) => string) =>
  async (page: Page, device: Device, lang: Lang) => {
    await depositTo("confirmed")(page, device, lang);
    await page
      .getByText(text(MESSAGES[lang]), { exact: true })
      .first()
      .waitFor();
  };

/**
 * Back from a provider's page: this tab remembered the deposit it left to pay
 * (Prism's player's), and Prism says it is still pending, on telebirr's page.
 */
const depositReturn = async (page: Page) => {
  await loginViaApi(page);
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "kelal.deposit",
      JSON.stringify({
        id: "01J9A7W0000000000000000002",
        player: "01J9A7R0000000000000000001",
      }),
    );
  });
  await page.route(/\/api\/deposits\/[^/?]+$/, (route) =>
    route.continue({
      headers: { ...route.request().headers(), prefer: "example=pending" },
    }),
  );
};

/** The methods failing to load: Prism has no failure for them. */
const methodsFail = async (page: Page) => {
  await loginViaApi(page);
  await page.route("**/api/payment-methods", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      json: problemJson(503, "SERVICE_UNAVAILABLE"),
    }),
  );
};

// ── withdrawals (F6c) ───────────────────────────────────────────────────────

/**
 * A withdrawal as `/api/withdrawals` answers it: the contract's processing
 * one (telebirr, to the saved +2519••••567), for the 500.00 the flow asks,
 * in the state a screen needs. Prism has only processing, review and paid
 * withdrawals and no cancel worth showing, so the rest are answered here.
 */
const withdrawal = (changes: Record<string, unknown> = {}) => ({
  id: "01J9A7Y0000000000000000001",
  method: "telebirr",
  amount: "500.00",
  status: "processing",
  accountMasked: "+2519••••567",
  reviewReason: null,
  rejectionReason: null,
  createdAt: "2026-10-04T09:00:00Z",
  paidAt: null,
  ...changes,
});

const WITHDRAWAL_PATH = "/wallet?withdrawal=01J9A7Y0000000000000000001";

const fulfil = (route: Route, [status, json]: [number, unknown]) =>
  route.fulfill({
    status,
    contentType:
      status >= 400 ? "application/problem+json" : "application/json",
    json,
  });

/**
 * Logged in, with requesting a withdrawal answered in the browser — `"abort"`
 * for no answer at all — and, when given, every read of one and every cancel.
 */
const withdrawalAnswers =
  ({
    request,
    read,
    cancel,
  }: {
    request?: [number, unknown] | "abort";
    /** Every read, told whether a cancel has been answered yet. */
    read?: (cancelled: boolean) => [number, unknown];
    cancel?: [number, unknown] | "abort";
  }) =>
  async (page: Page) => {
    await loginViaApi(page);
    if (request) {
      await page.route("**/api/withdrawals", (route) =>
        request === "abort" ? route.abort("failed") : fulfil(route, request),
      );
    }
    let cancelled = false;
    await page.route(/\/api\/withdrawals\/[^/?]+$/, (route) => {
      if (route.request().method() === "DELETE") {
        if (!cancel) return route.fallback();
        if (cancel === "abort") return route.abort("failed");
        cancelled = true;
        return fulfil(route, cancel);
      }
      if (!read) return route.fallback();
      return fulfil(route, read(cancelled));
    });
  };

/** The withdraw flow on `/wallet?action=withdraw` with telebirr's saved account, as far as `stop`. */
const withdrawTo =
  (stop: "accounts" | "amount" | "confirm" | "confirmed") =>
  async (page: Page, _device: Device, lang: Lang) => {
    const t = MESSAGES[lang];
    const next = () =>
      page.getByRole("button", { name: t.wallet.continue, exact: true });
    await page.getByRole("button", { name: /telebirr/ }).click();
    await next().click();
    await page.getByRole("radio", { name: /\+2519/ }).click();
    if (stop === "accounts") return;
    await next().click();
    if (stop === "amount") return;
    await next().click();
    if (stop === "confirm") return;
    await page
      .getByRole("button", { name: t.wallet.confirmWithdraw, exact: true })
      .click();
  };

/** Confirmed, then waits for `text` — a status's title or a refusal's. */
const withdrawShows =
  (text: (t: (typeof MESSAGES)[Lang]) => string) =>
  async (page: Page, device: Device, lang: Lang) => {
    await withdrawTo("confirmed")(page, device, lang);
    await page
      .getByText(text(MESSAGES[lang]), { exact: true })
      .first()
      .waitFor();
  };

/** A withdrawal's own screen, waiting for its title. */
const withdrawalShows =
  (text: (t: (typeof MESSAGES)[Lang]) => string) =>
  async (page: Page, _device: Device, lang: Lang) => {
    await page
      .getByText(text(MESSAGES[lang]), { exact: true })
      .first()
      .waitFor();
  };

/** Cancel withdrawal pressed, then waits for `text`. */
const cancelShows =
  (text: (t: (typeof MESSAGES)[Lang]) => string) =>
  async (page: Page, _device: Device, lang: Lang) => {
    const t = MESSAGES[lang];
    await page
      .getByRole("button", { name: t.withdraw.cancel, exact: true })
      .click();
    await page.getByText(text(t), { exact: true }).first().waitFor();
  };

/** `/b/7KQ2M9X`, loaded into the slip — the sheet opens on a phone. */
async function loadBooking(page: Page, _device: Device, lang: Lang) {
  await page
    .getByRole("button", { name: MESSAGES[lang].booking.loadIntoSlip })
    .click();
  await page.getByTestId("booking-notice").filter({ visible: true }).waitFor();
}

/**
 * Prism's offer image lives on a host that doesn't exist: a picture of the
 * right shape stands in for it, so the card is seen as a player would.
 */
const PROMO_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
  '<rect width="640" height="360" fill="steelblue"/>' +
  '<text x="40" y="210" font-size="64" font-family="sans-serif" fill="white">100%</text></svg>';
const promoImages = async (page: Page) => {
  await page.route("https://cdn.example.et/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: PROMO_IMAGE }),
  );
};

/** One of this app's promotion routes answered by the browser. */
const promoAnswer =
  (route: string, status: number, json: unknown) => (page: Page) =>
    page.route(`**${route}`, (r) =>
      r.fulfill({
        status,
        contentType:
          status >= 400 ? "application/problem+json" : "application/json",
        json,
      }),
    );

/** Promotions for a signed-in player (F7ca), with whatever the screen changes. */
const promotionsFor =
  (...changes: Array<(page: Page) => Promise<unknown>>) =>
  async (page: Page) => {
    await promoImages(page);
    await loginViaApi(page);
    for (const change of changes) await change(page);
  };

/** A redeem that never answers: the connection drops. */
const redeemDrops = (page: Page) =>
  page.route("**/api/promo-codes/redeem", (route) => route.abort());

/** Types a code and redeems it, then waits for what the page says. */
const redeemCode =
  (code: string, says: (t: (typeof MESSAGES)[Lang]) => string) =>
  async (page: Page, _device: Device, lang: Lang) => {
    const t = MESSAGES[lang];
    await page
      .getByRole("textbox", { name: t.promotions.codeLabel })
      .fill(code);
    await page
      .getByRole("button", { name: t.promotions.redeem, exact: true })
      .click();
    await page.getByText(says(t), { exact: true }).first().waitFor();
  };

/**
 * Screens worth looking at. Fixture IDs are the contract's examples, which is
 * what Prism serves.
 */
const SCREENS: Array<{
  name: string;
  path: string;
  /**
   * Headers for the page's own request only — e.g. Prism's `Prefer`, which the
   * app passes on in development to show an error state.
   */
  headers?: Record<string, string>;
  /** Runs before the page is opened — logging in, for the account pages. */
  before?: (page: Page, lang: Lang) => Promise<void>;
  /**
   * Console errors this screen is expected to produce: Chrome logs a refused
   * fetch ("Failed to load resource … 401") as an error, and a refusal is the
   * point of an error screen.
   */
  allowConsole?: RegExp;
  prepare?: (page: Page, device: Device, lang: Lang) => Promise<void>;
}> = [
  { name: "home", path: "/" },
  { name: "home-slip", path: "/", prepare: openSlipWithPicks },
  { name: "home-slip-tabs", path: "/", prepare: openSecondSlip },
  {
    name: "home-slip-booked",
    path: "/profile",
    before: loginViaApi,
    prepare: bookAsGuest,
  },
  {
    name: "home-slip-placed",
    path: "/",
    before: loginViaApi,
    prepare: placeAnd("ticket"),
  },
  {
    name: "home-slip-odds-changed",
    path: "/",
    before: loginViaApi,
    prepare: placeAnd("alert", {
      answer: (page) => preferOn(page, "/api/bets", "code=409"),
      askMe: true,
    }),
    allowConsole: /status of 409/,
  },
  {
    name: "home-slip-event-started",
    path: "/",
    before: loginViaApi,
    prepare: placeAnd("alert", {
      answer: (page) =>
        preferOn(page, "/api/bets", "code=409, example=event_started"),
    }),
    allowConsole: /status of 409/,
  },
  {
    name: "home-slip-limit-reached",
    path: "/",
    before: loginViaApi,
    prepare: placeAnd("alert", { answer: limitReached }),
    allowConsole: /status of 403/,
  },
  {
    // Excluded on another device: the refusal, then /api/me's end — the slip
    // locked with it (AC-2).
    name: "home-slip-break",
    path: "/",
    before: async (page) => {
      await loginViaApi(page);
      await onBreak(page, "/api/bets");
    },
    prepare: placeAnd("alert", {
      answer: refuse(403, {
        title: "You’re self-excluded",
        code: "RG_SELF_EXCLUDED",
      }),
      then: (page, lang) =>
        page
          .getByRole("button", { name: MESSAGES[lang].betSlip.paused })
          .filter({ visible: true })
          .waitFor(),
    }),
    allowConsole: /status of 403/,
  },
  {
    // A permanent self-exclusion revealed by a refusal: no end date.
    name: "home-slip-excluded",
    path: "/",
    before: async (page) => {
      await loginViaApi(page);
      await onBreak(page, "/api/bets", { permanent: true });
    },
    prepare: placeAnd("alert", {
      answer: refuse(403, {
        title: "You’ve excluded yourself",
        code: "RG_SELF_EXCLUDED",
      }),
      then: (page, lang) =>
        page
          .getByRole("button", { name: MESSAGES[lang].betSlip.paused })
          .filter({ visible: true })
          .waitFor(),
    }),
    allowConsole: /status of 403/,
  },
  {
    name: "home-slip-insufficient",
    path: "/",
    before: loginViaApi,
    prepare: placeAnd("alert", {
      answer: (page) =>
        preferOn(page, "/api/bets", "code=422, example=insufficient_funds"),
    }),
    allowConsole: /status of 422/,
  },
  {
    name: "home-slip-stake-too-high",
    path: "/",
    before: loginViaApi,
    prepare: placeAnd("alert", {
      answer: refuse(422, {
        title: "Stake is above the maximum",
        code: "BET_STAKE_TOO_HIGH",
        errors: [{ field: "stake", code: "MAX", limit: "50.00" }],
      }),
    }),
    allowConsole: /status of 422/,
  },
  {
    name: "home-slip-verify",
    path: "/",
    before: loginViaApi,
    prepare: placeAnd("alert", {
      answer: (page) => preferOn(page, "/api/bets", "code=403"),
    }),
    allowConsole: /status of 403/,
  },
  {
    // A bet with no answer and a slip changed since: the alert names that
    // bet and holds its Try again, with its amount; the main button places
    // the slip as shown, as a new bet, with the slip's amount.
    name: "home-slip-unconfirmed-changed",
    path: "/",
    before: loginViaApi,
    prepare: placeAnd("alert", {
      answer: (page) =>
        page.route("**/api/bets", (route) => route.abort("connectionreset")),
      then: (page) =>
        page
          .getByRole("button", { name: "50", exact: true })
          .filter({ visible: true })
          .click(),
    }),
    allowConsole: /ERR_CONNECTION_RESET|Failed to load resource/,
  },
  {
    name: "home-slip-unconfirmed",
    path: "/",
    before: loginViaApi,
    prepare: placeAnd("alert", {
      answer: (page) =>
        page.route("**/api/bets", (route) => route.abort("connectionreset")),
    }),
    allowConsole: /ERR_CONNECTION_RESET|Failed to load resource/,
  },
  {
    // Its Try again refused: said as a Try again that didn't go through,
    // never as a bet refused — the first try may still have gone through.
    name: "home-slip-unconfirmed-refused",
    path: "/",
    before: loginViaApi,
    prepare: placeAnd("alert", {
      answer: dropThenRateLimited,
      then: async (page, lang) => {
        const t = MESSAGES[lang];
        await page
          .getByRole("button", {
            name: new RegExp(`^${escape(t.common.retry)}`),
          })
          .filter({ visible: true })
          .first()
          .click();
        await page
          .getByText(t.betSlip.unconfirmed.retryRefused)
          .filter({ visible: true })
          .waitFor();
      },
    }),
    allowConsole: /ERR_CONNECTION_RESET|Failed to load resource|status of 429/,
  },
  { name: "home-upcoming", path: "/?filter=upcoming" },
  { name: "event", path: "/event/fx_arsenal_chelsea" },
  { name: "competition", path: "/competition/t_epl" },
  { name: "booking", path: "/b/7KQ2M9X" },
  { name: "booking-loaded", path: "/b/7KQ2M9X", prepare: loadBooking },
  {
    name: "booking-expired",
    path: "/b/7KQ2M9X",
    headers: { Prefer: "code=410" },
  },
  { name: "my-bets", path: "/my-bets", before: myBets() },
  {
    name: "my-bets-settled",
    path: "/my-bets",
    before: myBets(),
    prepare: showSettled,
  },
  { name: "my-bets-more", path: "/my-bets", before: myBets({ more: true }) },
  {
    name: "my-bets-empty",
    path: "/my-bets",
    before: myBetsAnswer(200, { items: [], nextCursor: null }),
  },
  {
    name: "my-bets-error",
    path: "/my-bets",
    before: myBetsAnswer(503, {
      type: "about:blank",
      title: "The sportsbook API could not be reached",
      status: 503,
      code: "SERVICE_UNAVAILABLE",
    }),
    prepare: waitForBetsFailure,
    allowConsole: /503/,
  },
  {
    name: "my-bets-guest",
    path: "/my-bets",
    before: staleSession,
  },
  {
    name: "my-bets-more-failed",
    path: "/my-bets",
    before: myBetsMoreFails,
    prepare: showMoreFails,
    allowConsole: /503/,
  },
  {
    name: "ticket",
    path: "/my-bets/01J9A7V0000000000000000001",
    before: loginViaApi,
  },
  {
    name: "ticket-not-found",
    path: "/my-bets/01J9A7V0000000000000000001",
    before: ticketAnswer(404, "NOT_FOUND"),
    allowConsole: /404/,
  },
  {
    name: "ticket-failed",
    path: "/my-bets/01J9A7V0000000000000000001",
    before: ticketAnswer(503, "SERVICE_UNAVAILABLE"),
    prepare: waitForTicketFailure,
    allowConsole: /503/,
  },
  { name: "ticket-check", path: "/t/K7Q2-M9XP-M" },
  { name: "ticket-check-form", path: "/t" },
  { name: "ticket-check-invalid", path: "/t?ticket=K7Q2-M9XP-X" },
  {
    // No ticket number in the address: the proxy's 404, rendered whole.
    name: "ticket-check-not-a-number",
    path: "/t/K7Q2-M9XP-X",
    allowConsole: /status of 404/,
  },
  {
    name: "ticket-check-failed",
    path: "/t/K7Q2-M9XP-M",
    // The contract lists a 503 for this operation since the sync of
    // 2026-10-08 (F8cb), so a Prism on the synced contract answers the one
    // asked for; one started before it has no 503 there and answers a 404
    // with no code. The page calls either a failure, as it should. `next dev`
    // replays the server's log of that failure in the browser's console.
    headers: { prefer: "code=503" },
    allowConsole: /Server\s+UpstreamError: Upstream responded (503|404)/,
  },
  { name: "transactions", path: "/transactions", before: loginViaApi },
  { name: "transactions-more", path: "/transactions", before: historyMore },
  {
    name: "transactions-empty",
    path: "/transactions",
    before: historyAnswer(200, { items: [], nextCursor: null }),
  },
  {
    name: "transactions-error",
    path: "/transactions",
    before: historyAnswer(503, {
      type: "about:blank",
      title: "The sportsbook API could not be reached",
      status: 503,
      code: "SERVICE_UNAVAILABLE",
    }),
    prepare: waitForHistoryFailure,
    allowConsole: /503/,
  },
  {
    name: "transactions-more-failed",
    path: "/transactions",
    before: historyMoreFails,
    prepare: historyShowMoreFails,
    allowConsole: /503/,
  },
  { name: "transactions-guest", path: "/transactions", before: staleSession },
  { name: "wallet", path: "/wallet", before: loginViaApi },
  {
    name: "wallet-no-limit",
    path: "/wallet",
    before: limitsAnswer(200, []),
  },
  {
    // Retried twice, as every read is, before it says so.
    name: "wallet-limit-failed",
    path: "/wallet",
    before: limitsAnswer(503, problemJson(503, "SERVICE_UNAVAILABLE")),
    prepare: async (page, _device, lang) => {
      await page
        .getByText(MESSAGES[lang].wallet.depositLimitFailed, { exact: true })
        .waitFor();
    },
    allowConsole: /503/,
  },
  {
    // Deposit off with its reason; Withdraw stays (RG-02).
    name: "wallet-break",
    path: "/wallet",
    before: async (page) => {
      await loginViaApi(page);
      await onBreak(page);
    },
  },
  { name: "wallet-held", path: "/wallet", before: walletHeld },
  {
    name: "wallet-error",
    path: "/wallet",
    before: walletFails,
    prepare: waitForWalletFailure,
    allowConsole: /503/,
  },
  { name: "wallet-guest", path: "/wallet", before: staleSession },
  {
    name: "deposit-methods",
    path: "/wallet?action=deposit",
    before: loginViaApi,
  },
  {
    name: "deposit-methods-failed",
    path: "/wallet?action=deposit",
    before: methodsFail,
    // Retried twice, as every read is, before it says so.
    prepare: async (page, _device, lang) => {
      await page.getByText(MESSAGES[lang].deposit.methodsFailed).waitFor();
    },
    allowConsole: /503/,
  },
  {
    name: "deposit-methods-empty",
    path: "/wallet?action=deposit",
    before: async (page) => {
      await loginViaApi(page);
      await page.route("**/api/payment-methods", (route) =>
        route.fulfill({ json: [] }),
      );
    },
  },
  {
    name: "deposit-amount-invalid",
    path: "/wallet?action=deposit",
    before: loginViaApi,
    prepare: depositTo("amount", "19.99"),
  },
  {
    name: "deposit-confirm",
    path: "/wallet?action=deposit",
    before: loginViaApi,
    prepare: depositTo("confirm"),
  },
  {
    name: "deposit-unconfirmed",
    path: "/wallet?action=deposit",
    before: depositAnswers("abort"),
    prepare: depositShows((t) => t.deposit.unconfirmedTitle),
    allowConsole: /ERR_FAILED/,
  },
  {
    name: "deposit-out-of-range",
    path: "/wallet?action=deposit",
    before: depositAnswers([
      422,
      problemJson(422, "PAY_AMOUNT_OUT_OF_RANGE", {
        // The API's own (translated) title: 500.00 is inside the method's
        // range, so these words, not the range, say why.
        title: "You can’t deposit this much today",
        detail: "Your daily deposits can’t go over 300.00 ETB.",
        errors: [{ field: "amount", code: "MAX", limit: "300.00" }],
      }),
    ]),
    prepare: depositShows((t) => t.deposit.refused.amountTitle),
    allowConsole: /422/,
  },
  {
    name: "deposit-limit",
    path: "/wallet?action=deposit",
    before: depositAnswers([
      403,
      problemJson(403, "RG_LIMIT_REACHED", {
        detail: "Your daily deposit limit of 1,000.00 ETB resets at midnight.",
      }),
    ]),
    prepare: depositShows((t) => t.deposit.refused.limitTitle),
    allowConsole: /403/,
  },
  {
    name: "deposit-unavailable",
    path: "/wallet?action=deposit",
    before: async (page) => {
      await loginViaApi(page);
      // Refused as unavailable — and from then on, the methods say so.
      let refused = false;
      await page.route("**/api/deposits", (route) => {
        refused = true;
        return route.fulfill({
          status: 422,
          contentType: "application/problem+json",
          json: problemJson(422, "PAY_METHOD_UNAVAILABLE"),
        });
      });
      await page.route("**/api/payment-methods", async (route) => {
        const response = await route.fetch();
        const methods = (await response.json()) as {
          code: string;
          available: boolean;
        }[];
        await route.fulfill({
          response,
          json: refused
            ? methods.map((m) =>
                m.code === "cbebirr" ? { ...m, available: false } : m,
              )
            : methods,
        });
      });
    },
    prepare: depositShows((t) => t.deposit.refused.methodTitle),
    allowConsole: /422/,
  },
  {
    name: "deposit-provider-error",
    path: "/wallet?action=deposit",
    before: depositAnswers([502, problemJson(502, "PAY_PROVIDER_ERROR")]),
    prepare: depositShows((t) => t.deposit.refused.providerTitle),
    allowConsole: /502/,
  },
  {
    name: "deposit-break",
    path: "/wallet?action=deposit",
    before: async (page) => {
      await depositAnswers([403, problemJson(403, "RG_COOLING_OFF")])(page);
      // A break taken elsewhere: the refusal reveals it, and /api/me — read
      // again — says until 10 Oct, 18:00 EAT. No deposit starts after that.
      await onBreak(page, "/api/deposits");
    },
    prepare: depositShows((t) => t.deposit.refused.breakTitle),
    allowConsole: /403/,
  },
  {
    // On a break /api/me reports: the header's Deposit lands on this (F7a).
    name: "deposit-paused",
    path: "/wallet?action=deposit",
    before: async (page) => {
      await loginViaApi(page);
      await onBreak(page);
    },
    prepare: headingShows((t) => t.deposit.refused.breakTitle),
  },
  {
    name: "deposit-kyc",
    path: "/wallet?action=deposit",
    before: depositAnswers([403, problemJson(403, "KYC_REQUIRED")]),
    prepare: depositShows((t) => t.deposit.refused.kycTitle),
    allowConsole: /403/,
  },
  {
    name: "deposit-real-money",
    path: "/wallet?action=deposit",
    before: depositAnswers([503, problemJson(503, "REAL_MONEY_DISABLED")]),
    prepare: depositShows((t) => t.deposit.refused.realMoneyTitle),
    allowConsole: /503/,
  },
  {
    // No answer, then a Try again the API refused: still that deposit's key.
    name: "deposit-retry-refused",
    path: "/wallet?action=deposit",
    before: async (page) => {
      await loginViaApi(page);
      let posts = 0;
      await page.route("**/api/deposits", (route) => {
        posts += 1;
        return posts === 1
          ? route.abort("failed")
          : route.fulfill({
              status: 403,
              contentType: "application/problem+json",
              json: problemJson(403, "RG_LIMIT_REACHED", {
                detail:
                  "Your daily deposit limit of 1,000.00 ETB resets at midnight.",
              }),
            });
      });
    },
    prepare: async (page, device, lang) => {
      const t = MESSAGES[lang];
      await depositShows((m) => m.deposit.unconfirmedTitle)(page, device, lang);
      await page
        .getByRole("button", {
          name: new RegExp(`^${escape(t.deposit.retry.split(" ·")[0])}`),
        })
        .click();
      await page
        .getByText(t.deposit.refused.retryTitle, { exact: true })
        .waitFor();
    },
    allowConsole: /ERR_FAILED|403/,
  },
  {
    name: "deposit-starting",
    path: "/wallet?action=deposit",
    before: depositAnswers(
      [201, deposit({ status: "initiated", nextAction: null })],
      [200, deposit({ status: "initiated", nextAction: null })],
    ),
    prepare: depositShows((t) => t.deposit.startingTitle),
  },
  {
    name: "deposit-phone",
    path: "/wallet?action=deposit",
    before: depositAnswers([201, deposit()], [200, deposit()]),
    prepare: depositShows((t) => t.deposit.phoneTitle),
  },
  {
    name: "deposit-web",
    path: "/wallet?deposit=return",
    before: depositReturn,
  },
  {
    name: "deposit-unsupported",
    path: "/wallet?action=deposit",
    // Read as it started: Prism's default read is a completed deposit (U1).
    before: depositAnswers(
      [
        201,
        deposit({ nextAction: { type: "unsupported", reason: "app_sdk" } }),
      ],
      [
        200,
        deposit({ nextAction: { type: "unsupported", reason: "app_sdk" } }),
      ],
    ),
    prepare: depositShows((t) => t.deposit.unsupportedTitle),
  },
  {
    // End to end through Prism: a push to the phone, then its completed read.
    name: "deposit-completed",
    path: "/wallet?action=deposit",
    before: depositPrism,
    prepare: depositShows((t) => t.deposit.completedTitle),
  },
  {
    name: "deposit-failed",
    path: "/wallet?action=deposit",
    before: depositAnswers(
      [201, deposit()],
      [
        200,
        deposit({
          status: "failed",
          nextAction: null,
          failureReason: "Declined by the wallet",
        }),
      ],
    ),
    prepare: depositShows((t) => t.deposit.failedTitle),
  },
  {
    name: "deposit-expired",
    path: "/wallet?action=deposit",
    before: depositAnswers(
      [201, deposit()],
      [200, deposit({ status: "expired", nextAction: null })],
    ),
    prepare: depositShows((t) => t.deposit.expiredTitle),
  },
  {
    // Back from a provider with a deposit the API doesn't know for this player.
    name: "deposit-not-found",
    path: "/wallet?deposit=return",
    before: async (page) => {
      await depositReturn(page);
      await page.route(/\/api\/deposits\/[^/?]+$/, (route) =>
        route.fulfill({
          status: 404,
          contentType: "application/problem+json",
          json: problemJson(404, "NOT_FOUND"),
        }),
      );
    },
    prepare: async (page, _device, lang) => {
      await page
        .getByRole("heading", { name: MESSAGES[lang].deposit.notFoundTitle })
        .waitFor();
    },
    allowConsole: /404/,
  },
  {
    name: "deposit-check-failed",
    path: "/wallet?deposit=return",
    before: async (page) => {
      await depositReturn(page);
      await page.route(/\/api\/deposits\/[^/?]+$/, (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/problem+json",
          json: problemJson(503, "SERVICE_UNAVAILABLE"),
        }),
      );
    },
    // Retried twice, as every read is, before it says so.
    prepare: async (page, _device, lang) => {
      await page
        .getByRole("heading", { name: MESSAGES[lang].deposit.checkFailedTitle })
        .waitFor();
    },
    allowConsole: /503/,
  },
  // ── withdrawals (F6c) ──
  {
    name: "withdraw-methods",
    path: "/wallet?action=withdraw",
    before: loginViaApi,
  },
  {
    name: "withdraw-accounts",
    path: "/wallet?action=withdraw",
    before: loginViaApi,
    prepare: withdrawTo("accounts"),
  },
  {
    // Nothing saved for CBE Birr: the number is the way on.
    name: "withdraw-accounts-empty",
    path: "/wallet?action=withdraw",
    before: loginViaApi,
    prepare: async (page, _device, lang) => {
      const t = MESSAGES[lang];
      await page.getByRole("button", { name: /CBE Birr/ }).click();
      await page
        .getByRole("button", { name: t.wallet.continue, exact: true })
        .click();
      await page
        .getByLabel(t.withdraw.numberLabel.replace("{method}", "CBE Birr"))
        .waitFor();
    },
  },
  {
    name: "withdraw-accounts-failed",
    path: "/wallet?action=withdraw",
    before: async (page) => {
      await loginViaApi(page);
      await page.route("**/api/payout-accounts", (route) =>
        fulfil(route, [503, problemJson(503, "SERVICE_UNAVAILABLE")]),
      );
    },
    // Retried twice, as every read is, before it says so.
    prepare: async (page, _device, lang) => {
      const t = MESSAGES[lang];
      await page.getByRole("button", { name: /telebirr/ }).click();
      await page
        .getByRole("button", { name: t.wallet.continue, exact: true })
        .click();
      await page
        .getByText(t.withdraw.accountsFailed, { exact: true })
        .waitFor();
    },
    allowConsole: /503/,
  },
  {
    name: "withdraw-number",
    path: "/wallet?action=withdraw",
    before: loginViaApi,
    prepare: async (page, device, lang) => {
      const t = MESSAGES[lang];
      await withdrawTo("accounts")(page, device, lang);
      await page
        .getByRole("radio", { name: t.withdraw.anotherNumber, exact: true })
        .click();
      await page
        .getByLabel(t.withdraw.numberLabel.replace("{method}", "telebirr"))
        .fill("922334890");
    },
  },
  {
    name: "withdraw-remove",
    path: "/wallet?action=withdraw",
    before: loginViaApi,
    prepare: async (page, device, lang) => {
      const t = MESSAGES[lang];
      await withdrawTo("accounts")(page, device, lang);
      await page
        .getByRole("button", {
          name: t.withdraw.removeLabel.replace("{account}", "+2519••••567"),
          exact: true,
        })
        .click();
    },
  },
  {
    name: "withdraw-amount",
    path: "/wallet?action=withdraw",
    before: loginViaApi,
    prepare: withdrawTo("amount"),
  },
  {
    name: "withdraw-confirm",
    path: "/wallet?action=withdraw",
    before: loginViaApi,
    prepare: withdrawTo("confirm"),
  },
  {
    name: "withdraw-unconfirmed",
    path: "/wallet?action=withdraw",
    before: withdrawalAnswers({ request: "abort" }),
    prepare: withdrawShows((t) => t.withdraw.unconfirmedTitle),
    allowConsole: /ERR_FAILED/,
  },
  {
    name: "withdraw-kyc",
    path: "/wallet?action=withdraw",
    before: withdrawalAnswers({
      request: [403, problemJson(403, "KYC_REQUIRED")],
    }),
    prepare: withdrawShows((t) => t.withdraw.refused.kycTitle),
    allowConsole: /403/,
  },
  {
    name: "withdraw-bonus",
    path: "/wallet?action=withdraw",
    before: withdrawalAnswers({
      request: [
        422,
        problemJson(422, "PAY_ACTIVE_BONUS_WAGERING", {
          title: "Your bonus is still being wagered",
          detail: "Withdrawing now forfeits your bonus of 50.00 ETB.",
        }),
      ],
    }),
    prepare: withdrawShows((t) => t.withdraw.refused.bonusTitle),
    allowConsole: /422/,
  },
  {
    name: "withdraw-out-of-range",
    path: "/wallet?action=withdraw",
    before: withdrawalAnswers({
      request: [
        422,
        problemJson(422, "PAY_AMOUNT_OUT_OF_RANGE", {
          title: "You can’t withdraw this much today",
          detail: "Your withdrawals today can’t go over 300.00 ETB.",
          errors: [{ field: "amount", code: "DAILY_MAX", limit: "300.00" }],
        }),
      ],
    }),
    prepare: withdrawShows((t) => t.withdraw.refused.amountTitle),
    allowConsole: /422/,
  },
  {
    name: "withdraw-insufficient",
    path: "/wallet?action=withdraw",
    before: withdrawalAnswers({
      request: [
        422,
        problemJson(422, "WALLET_INSUFFICIENT_FUNDS", {
          title: "Balance too low",
        }),
      ],
    }),
    prepare: withdrawShows((t) => t.withdraw.refused.fundsTitle),
    allowConsole: /422/,
  },
  {
    name: "withdraw-break",
    path: "/wallet?action=withdraw",
    before: withdrawalAnswers({
      request: [403, problemJson(403, "RG_SELF_EXCLUDED")],
    }),
    prepare: withdrawShows((t) => t.withdraw.refused.breakTitle),
    allowConsole: /403/,
  },
  {
    name: "withdraw-real-money",
    path: "/wallet?action=withdraw",
    before: withdrawalAnswers({
      request: [503, problemJson(503, "REAL_MONEY_DISABLED")],
    }),
    prepare: withdrawShows((t) => t.withdraw.refused.realMoneyTitle),
    allowConsole: /503/,
  },
  {
    // End to end through Prism: its default answer is processing.
    name: "withdrawal-processing",
    path: "/wallet?action=withdraw",
    before: loginViaApi,
    prepare: withdrawShows((t) => t.withdraw.processingTitle),
  },
  {
    // Prism's review: a first withdrawal of 20,000.00.
    name: "withdrawal-review",
    path: "/wallet?action=withdraw",
    before: async (page) => {
      await loginViaApi(page);
      await preferOn(page, "/api/withdrawals", "example=review");
    },
    prepare: withdrawShows((t) => t.withdraw.reviewTitle),
  },
  {
    // Prism's paid withdrawal, opened from its row in the history.
    name: "withdrawal-paid",
    path: WITHDRAWAL_PATH,
    before: loginViaApi,
    prepare: withdrawalShows((t) => t.withdraw.paidTitle),
  },
  {
    name: "withdrawal-requested",
    path: WITHDRAWAL_PATH,
    before: withdrawalAnswers({
      read: () => [200, withdrawal({ status: "requested" })],
    }),
    prepare: withdrawalShows((t) => t.withdraw.requestedTitle),
  },
  {
    name: "withdrawal-approved",
    path: WITHDRAWAL_PATH,
    before: withdrawalAnswers({
      read: () => [200, withdrawal({ status: "approved" })],
    }),
    prepare: withdrawalShows((t) => t.withdraw.approvedTitle),
  },
  {
    name: "withdrawal-failed",
    path: WITHDRAWAL_PATH,
    before: withdrawalAnswers({
      read: () => [200, withdrawal({ status: "failed" })],
    }),
    prepare: withdrawalShows((t) => t.withdraw.failedTitle),
  },
  {
    name: "withdrawal-rejected",
    path: WITHDRAWAL_PATH,
    before: withdrawalAnswers({
      read: () => [
        200,
        withdrawal({
          status: "rejected",
          rejectionReason:
            "The account holder’s name does not match the name on your account.",
        }),
      ],
    }),
    prepare: withdrawalShows((t) => t.withdraw.rejectedTitle),
  },
  {
    name: "withdrawal-cancelled",
    path: WITHDRAWAL_PATH,
    before: withdrawalAnswers({
      read: () => [200, withdrawal({ status: "requested" })],
      cancel: [200, withdrawal({ status: "cancelled" })],
    }),
    prepare: cancelShows((t) => t.withdraw.cancelledTitle),
  },
  {
    // Cancel pressed just as it moved on: the API's 409, then its status.
    name: "withdrawal-not-cancellable",
    path: WITHDRAWAL_PATH,
    before: withdrawalAnswers({
      read: (cancelled) => [
        200,
        withdrawal({ status: cancelled ? "processing" : "requested" }),
      ],
      cancel: [409, problemJson(409, "PAY_WITHDRAWAL_NOT_CANCELLABLE")],
    }),
    prepare: async (page, device, lang) => {
      await cancelShows((t) => t.withdraw.tooLateTitle)(page, device, lang);
      await page
        .getByText(MESSAGES[lang].withdraw.processingTitle, { exact: true })
        .waitFor();
    },
    allowConsole: /409/,
  },
  {
    name: "withdrawal-cancel-unconfirmed",
    path: WITHDRAWAL_PATH,
    before: withdrawalAnswers({
      read: () => [200, withdrawal({ status: "requested" })],
      cancel: "abort",
    }),
    prepare: cancelShows((t) => t.withdraw.cancelUnconfirmedTitle),
    allowConsole: /ERR_FAILED/,
  },
  {
    name: "withdrawal-not-found",
    path: "/wallet?withdrawal=01J9A7Y0000000000000000009",
    before: withdrawalAnswers({
      read: () => [404, problemJson(404, "NOT_FOUND")],
    }),
    prepare: withdrawalShows((t) => t.withdraw.notFoundTitle),
    allowConsole: /404/,
  },
  {
    name: "withdrawal-check-failed",
    path: WITHDRAWAL_PATH,
    before: withdrawalAnswers({
      read: () => [503, problemJson(503, "SERVICE_UNAVAILABLE")],
    }),
    // Retried twice, as every read is, before it says so.
    prepare: withdrawalShows((t) => t.withdraw.checkFailedTitle),
    allowConsole: /503/,
  },
  {
    // Both of Prism's devices, this one marked (AC-9).
    name: "profile",
    path: "/profile",
    before: playerReadingTheScreen,
    prepare: devicesShow,
  },
  {
    // The account saved the other language: "Not saved to your account".
    name: "profile-language-unsaved",
    path: "/profile",
    before: accountReads((lang) => (lang === "en" ? "am" : "en")),
    prepare: devicesShow,
  },
  {
    name: "profile-devices-failed",
    path: "/profile",
    before: async (page, lang) => {
      await playerReadingTheScreen(page, lang);
      await page.route("**/api/me/sessions", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/problem+json",
          json: problemJson(503, "SERVICE_UNAVAILABLE"),
        }),
      );
    },
    prepare: async (page, _device, lang) => {
      await page.getByText(MESSAGES[lang].profile.devicesFailed).waitFor();
    },
    allowConsole: /503/,
  },
  { name: "profile-guest", path: "/profile" },
  {
    // An hour into the visit: time played, no money figures (AC-10). Over
    // My bets, a page one screen long, so the dialog is the picture.
    name: "reality-check",
    path: "/my-bets",
    before: realityCheckDue,
    prepare: anHourLater,
  },
  {
    // Prism's limits: a weekly deposit limit with a raise pending (AC-5).
    name: "responsible-gaming",
    path: "/responsible-gaming",
    before: loginViaApi,
    prepare: headingShows((t) => t.rg.depositLimit),
  },
  { name: "responsible-gaming-guest", path: "/responsible-gaming" },
  {
    name: "responsible-gaming-failed",
    path: "/responsible-gaming",
    before: limitsAnswer(503, problemJson(503, "SERVICE_UNAVAILABLE")),
    // Retried twice, as every read is, before it says so.
    prepare: headingShows((t) => t.rg.limitsFailedTitle),
    allowConsole: /503/,
  },
  {
    // A cut, in force at once (AC-5).
    name: "responsible-gaming-saved",
    path: "/responsible-gaming",
    before: limitLowered,
    prepare: saveDepositLimit("600"),
  },
  {
    // The API's no to a limit, in its words (AC-5).
    name: "responsible-gaming-not-saved",
    path: "/responsible-gaming",
    before: async (page) => {
      await loginViaApi(page);
      await page.route("**/api/me/limits", (route) =>
        route.request().method() === "PUT"
          ? route.fulfill({
              status: 422,
              contentType: "application/problem+json",
              json: problemJson(422, "VALIDATION_FAILED", {
                title: "This limit can’t be set",
                detail:
                  "A limit can’t be lowered below what you’ve already used.",
              }),
            })
          : route.continue(),
      );
    },
    prepare: async (page, device, lang) => {
      const t = MESSAGES[lang];
      const card = page.getByRole("region", { name: t.rg.depositLimit });
      await card.getByLabel(t.rg.newLimit).fill("100");
      await card.getByRole("button", { name: t.rg.saveLimit }).click();
      await card.getByRole("alert").waitFor();
    },
    allowConsole: /422/,
  },
  {
    // Asked once, in full sentences (AC-6).
    name: "responsible-gaming-confirm",
    path: "/responsible-gaming",
    before: loginViaApi,
    prepare: askFor(
      (t) => t.rg.selfExclusion,
      (t) => t.rg.exclude1y,
      (t) => t.rg.selfExclude,
    ),
  },
  {
    // Prism's 7-day break: signed out, the end shown (AC-6).
    name: "responsible-gaming-started",
    path: "/responsible-gaming",
    before: loginViaApi,
    prepare: askFor(
      (t) => t.rg.takeBreak,
      (t) => t.rg.break7d,
      (t) => t.rg.startBreak,
      true,
    ),
  },
  {
    // No answer to the break: it may have started (AC-6).
    name: "responsible-gaming-unconfirmed",
    path: "/responsible-gaming",
    before: async (page) => {
      await loginViaApi(page);
      await page.route("**/api/me/self-exclusion", (route) =>
        route.abort("failed"),
      );
    },
    prepare: async (page, device, lang) => {
      const t = MESSAGES[lang];
      await askFor(
        (m) => m.rg.takeBreak,
        (m) => m.rg.break7d,
        (m) => m.rg.startBreak,
      )(page, device, lang);
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: t.rg.confirm })
        .click();
      await page
        .getByText(t.rg.breakUnconfirmedTitle, { exact: true })
        .waitFor();
    },
    allowConsole: /ERR_FAILED/,
  },
  {
    // A permanent self-exclusion: no end date anywhere (F7a).
    name: "responsible-gaming-excluded",
    path: "/responsible-gaming",
    before: async (page) => {
      await loginViaApi(page);
      await onBreak(page, undefined, { permanent: true });
    },
    prepare: headingShows((t) => t.rg.depositLimit),
  },
  {
    // Prism's PUT answer: a raise held back until the API's time (AC-5).
    name: "responsible-gaming-raised",
    path: "/responsible-gaming",
    before: loginViaApi,
    prepare: saveDepositLimit("2000"),
  },
  {
    name: "responsible-gaming-save-unconfirmed",
    path: "/responsible-gaming",
    before: async (page) => {
      await loginViaApi(page);
      await page.route("**/api/me/limits", (route) =>
        route.request().method() === "PUT"
          ? route.abort("failed")
          : route.continue(),
      );
    },
    prepare: async (page, _device, lang) => {
      const t = MESSAGES[lang];
      const card = page.getByRole("region", { name: t.rg.depositLimit });
      await card.getByLabel(t.rg.newLimit).fill("2000");
      await card.getByRole("button", { name: t.rg.saveLimit }).click();
      await card.getByRole("alert").waitFor();
    },
    allowConsole: /ERR_FAILED/,
  },
  {
    // The break's question, asked once (AC-6).
    name: "responsible-gaming-confirm-break",
    path: "/responsible-gaming",
    before: loginViaApi,
    prepare: askFor(
      (t) => t.rg.takeBreak,
      (t) => t.rg.break24h,
      (t) => t.rg.startBreak,
    ),
  },
  {
    name: "responsible-gaming-confirm-permanent",
    path: "/responsible-gaming",
    before: loginViaApi,
    prepare: askFor(
      (t) => t.rg.selfExclusion,
      (t) => t.rg.excludePermanent,
      (t) => t.rg.selfExclude,
    ),
  },
  {
    // A permanent self-exclusion started: signed out, no end (AC-6).
    name: "responsible-gaming-excluded-started",
    path: "/responsible-gaming",
    before: exclusionAnswers([
      201,
      {
        kind: "self_exclusion",
        startsAt: "2026-10-05T09:00:00Z",
        endsAt: null,
      },
    ]),
    prepare: confirmBreak(
      (t) => t.rg.selfExclusion,
      (t) => t.rg.excludePermanent,
      (t) => t.rg.selfExclude,
      (t) => t.rg.exclusionStartedTitle,
    ),
  },
  {
    name: "responsible-gaming-break-refused",
    path: "/responsible-gaming",
    before: exclusionAnswers([
      422,
      problemJson(422, "VALIDATION_FAILED", {
        title: "This break can’t be started",
      }),
    ]),
    prepare: confirmBreak(
      (t) => t.rg.takeBreak,
      (t) => t.rg.break30d,
      (t) => t.rg.startBreak,
      (t) => t.rg.breakNotStartedTitle,
    ),
    allowConsole: /422/,
  },
  {
    // Logged in again during the break: the banner, from /api/me.
    name: "responsible-gaming-break",
    path: "/responsible-gaming",
    before: async (page) => {
      await loginViaApi(page);
      await onBreak(page);
    },
    prepare: headingShows((t) => t.rg.depositLimit),
  },
  { name: "login", path: "/login" },
  { name: "login-otp", path: "/login", prepare: loginAnswering("code=202") },
  {
    name: "login-wrong-password",
    path: "/login",
    prepare: loginAnswering("code=401"),
    allowConsole: /status of 401/,
  },
  {
    name: "login-locked",
    path: "/login",
    prepare: loginAnswering("code=423"),
    allowConsole: /status of 423/,
  },
  { name: "register", path: "/register" },
  { name: "register-code", path: "/register", prepare: registerStep("code") },
  {
    name: "register-details",
    path: "/register",
    prepare: registerStep("details"),
  },
  {
    name: "register-promo-invalid",
    path: "/register",
    prepare: promoRefusedAtSignUp,
    allowConsole: /status of 422/,
  },
  { name: "register-id", path: "/register", prepare: registerStep("created") },
  {
    name: "register-phone-taken",
    path: "/register",
    prepare: phoneTaken,
    allowConsole: /status of 409/,
  },
  {
    name: "register-code-invalid",
    path: "/register",
    prepare: codeRefused,
    allowConsole: /status of 422/,
  },
  {
    name: "verify-verified",
    path: "/register",
    prepare: faydaVerdict("verified"),
  },
  {
    name: "verify-pending",
    path: "/register",
    prepare: faydaVerdict("pending"),
  },
  {
    name: "verify-needs-info",
    path: "/register",
    prepare: faydaVerdict("needs_info"),
  },
  { name: "reset-code", path: "/login", prepare: resetTo("code") },
  { name: "reset-done", path: "/login", prepare: resetTo("done") },
  {
    // The player's bonus with its wagering, a free bet, the code form, then
    // the offers (F7ca, AC-11).
    name: "promotions",
    path: "/promotions",
    before: promotionsFor(),
  },
  {
    name: "promotions-guest",
    path: "/promotions",
    before: promoImages,
  },
  {
    name: "promotions-none",
    path: "/promotions",
    before: promotionsFor(
      promoAnswer("/api/me/bonuses", 200, { active: null, freeBets: [] }),
      promoAnswer("/api/promotions", 200, []),
    ),
  },
  {
    // Retried twice, as every read is, before it says so.
    name: "promotions-bonus-failed",
    path: "/promotions",
    before: promotionsFor(
      promoAnswer(
        "/api/me/bonuses",
        503,
        problemJson(503, "SERVICE_UNAVAILABLE"),
      ),
    ),
    prepare: async (page, _device, lang) => {
      await page
        .getByText(MESSAGES[lang].promotions.bonusFailedTitle, { exact: true })
        .waitFor();
    },
    allowConsole: /503/,
  },
  {
    name: "promotions-offers-failed",
    path: "/promotions",
    before: promotionsFor(
      promoAnswer(
        "/api/promotions",
        503,
        problemJson(503, "SERVICE_UNAVAILABLE"),
      ),
    ),
    prepare: async (page, _device, lang) => {
      await page
        .getByText(MESSAGES[lang].promotions.offersFailedTitle, {
          exact: true,
        })
        .waitFor();
    },
    allowConsole: /503/,
  },
  {
    // An offer taken up with a code, and its terms open (review U2): Prism's
    // offers need none.
    name: "promotions-code-offer",
    path: "/promotions",
    before: promotionsFor(
      promoAnswer("/api/promotions", 200, [
        {
          id: "01J9A810000000000000000003",
          title: "Derby day free bet",
          summary: "A 50 ETB free bet with code DERBY50",
          terms:
            "One per player.\nThe free bet needs 3 or more picks at 1.50 or more each.",
          imageUrl: null,
          startsAt: "2026-10-10T00:00:00Z",
          endsAt: "2026-10-12T21:00:00Z",
          requiresCode: true,
        },
      ]),
    ),
    prepare: async (page, _device, lang) => {
      const t = MESSAGES[lang];
      await page
        .getByRole("list", { name: t.promotions.offersTitle })
        .getByText(t.promotions.terms, { exact: true })
        .click();
    },
  },
  {
    // Prism's answer: granted, with the API's own message (AC-12).
    name: "promotions-redeemed",
    path: "/promotions",
    before: promotionsFor(),
    prepare: redeemCode("DERBY50", () => "50 ETB free bet added"),
  },
  {
    name: "promotions-redeemed-pending",
    path: "/promotions",
    before: promotionsFor(
      promoAnswer("/api/promo-codes/redeem", 200, {
        result: "pending_deposit",
        message: null,
      }),
    ),
    prepare: redeemCode("FIRSTDEP", (t) => t.promotions.pendingDeposit),
  },
  {
    // Prism has no PROMO_* example: the route answers with the Problem.
    name: "promotions-code-invalid",
    path: "/promotions",
    before: promotionsFor(
      promoAnswer(
        "/api/promo-codes/redeem",
        422,
        problemJson(422, "PROMO_INVALID"),
      ),
    ),
    prepare: redeemCode("DERBY5O", (t) => t.promotions.codeInvalidTitle),
    allowConsole: /status of 422/,
  },
  {
    name: "promotions-code-used",
    path: "/promotions",
    before: promotionsFor(
      promoAnswer(
        "/api/promo-codes/redeem",
        409,
        problemJson(409, "PROMO_ALREADY_USED"),
      ),
    ),
    prepare: redeemCode("DERBY50", (t) => t.promotions.codeUsedTitle),
    allowConsole: /status of 409/,
  },
  {
    name: "promotions-code-unconfirmed",
    path: "/promotions",
    before: promotionsFor(redeemDrops),
    prepare: redeemCode("DERBY50", (t) => t.promotions.unconfirmedTitle),
    allowConsole: /ERR_FAILED/,
  },
];

const DEVICES = {
  phone: { width: 375, height: 812 },
  desktop: { width: 1440, height: 900 },
} as const;

const LANGS = ["en", "am"] as const;

/** Every message key, so one rendered raw (a missing translation) is caught. */
function keys(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}
const MESSAGE_KEYS = keys(en);

const SHOTS = "test-results/ui";
mkdirSync(SHOTS, { recursive: true });

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // Skeletons fade out once queries land; give the last frame a moment.
  await page.waitForTimeout(300);
}

for (const [device, viewport] of Object.entries(DEVICES)) {
  for (const lang of LANGS) {
    test.describe(`${device} · ${lang}`, () => {
      test.use({ viewport });

      // A screen that answers through `route.fetch()` can still have one in
      // flight when it is done (a deposit read, a re-read of /api/me): let
      // those go quietly instead of failing the run after the test.
      test.afterEach(async ({ page }) => {
        await page.unrouteAll({ behavior: "ignoreErrors" });
      });

      for (const screen of SCREENS) {
        test(screen.name, async ({ page }) => {
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
          });

          // Language is a persisted preference; set it before the app boots.
          await page.addInitScript((value) => {
            localStorage.setItem(
              "kelal.ui",
              JSON.stringify({ state: { lang: value }, version: 1 }),
            );
          }, lang);

          if (screen.headers) {
            const extra = screen.headers;
            await page.route(`**${screen.path}`, (route) =>
              route.continue({
                headers: { ...route.request().headers(), ...extra },
              }),
            );
          }
          if (screen.before) await screen.before(page, lang);
          await page.goto(screen.path);
          await settle(page);
          if (screen.prepare) {
            await screen.prepare(page, device as Device, lang);
            await settle(page);
          }
          // The dev server's badge would cover whatever sits in the corner.
          await page.addStyleTag({
            content: "nextjs-portal { display: none !important; }",
          });
          await page.screenshot({
            path: `${SHOTS}/${screen.name}-${lang}-${device}.png`,
            fullPage: true,
          });

          const text = await page.locator("body").innerText();
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          );

          expect(
            errors.filter((error) => !screen.allowConsole?.test(error)),
            "console errors",
          ).toEqual([]);
          expect(overflow, "horizontal scroll").toBeLessThanOrEqual(0);
          expect(
            MESSAGE_KEYS.filter((key) => text.includes(key)),
            "untranslated message keys on screen",
          ).toEqual([]);
          expect(
            text.match(/\{[a-zA-Z]+\}/g) ?? [],
            "unfilled {placeholders}",
          ).toEqual([]);
        });
      }
    });
  }
}
