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
