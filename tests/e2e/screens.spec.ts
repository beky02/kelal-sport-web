import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
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
  await page
    .getByRole("button", { name: t.betSlip.howCalculated })
    .last()
    .click();
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
  await page.getByTestId("booking-code").filter({ visible: true }).waitFor();
  // On a phone the sheet scrolls inside itself: bring the code card and its
  // share buttons into view. On desktop, a full-page shot of a scrolled page
  // paints the sticky header mid-page, so go back to the top.
  if (device === "phone") {
    await page
      .getByRole("button", { name: t.betSlip.copyCode })
      .filter({ visible: true })
      .scrollIntoViewIfNeeded();
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
  }
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

/** `/b/7KQ2M9X`, loaded into the slip — the sheet opens on a phone. */
async function loadBooking(page: Page, _device: Device, lang: Lang) {
  await page
    .getByRole("button", { name: MESSAGES[lang].booking.loadIntoSlip })
    .click();
  await page.getByTestId("booking-notice").filter({ visible: true }).waitFor();
}

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
  before?: (page: Page) => Promise<void>;
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
  { name: "my-bets", path: "/my-bets", before: loginViaApi },
  { name: "transactions", path: "/transactions", before: loginViaApi },
  { name: "wallet", path: "/wallet", before: loginViaApi },
  { name: "profile", path: "/profile", before: loginViaApi },
  { name: "profile-guest", path: "/profile" },
  { name: "responsible-gaming", path: "/responsible-gaming" },
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
          if (screen.before) await screen.before(page);
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
