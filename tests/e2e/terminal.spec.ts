import { mkdirSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import am from "../../src/lib/i18n/messages/am.json";
import en from "../../src/lib/i18n/messages/en.json";

/**
 * The shop terminal (F8b) on its own host, in Chrome, against the dev server
 * and Prism: activation, the signed status read, and every screen at phone and
 * desktop width. The terminal's own screens show Amharic and English together,
 * so each is one picture per width; the kiosk (F8ca) speaks one language at a
 * time, so each of its screens is one picture per width and language.
 *
 * Every test starts in a fresh browser: no device key, no cookie.
 */
const terminalUrl = (baseURL: string | undefined, path = "/") => {
  const url = new URL(path, baseURL);
  url.hostname = `terminal.${url.hostname}`;
  return url.href;
};

const SHOTS = "test-results/ui";
mkdirSync(SHOTS, { recursive: true });

const STATUS = "**/api/terminal/status";
const ACTIVATE = "**/api/terminal/activate";
const CONFIG = "**/api/terminal/config";
const BOARD = /\/api\/terminal\/catalogue\/board(\?|$)/;

/** Every message key, so one rendered raw (a missing translation) is caught. */
function keys(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}
const MESSAGE_KEYS = keys(en);

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

/** The activation form's message (Next's route announcer is an alert too). */
const alert = (page: Page) => page.locator("form").getByRole("alert");

/** Types a code and presses Activate. */
async function typeCode(page: Page, code: string) {
  await page.getByLabel(new RegExp(en.terminal.activate.label)).fill(code);
  await page
    .getByRole("button", { name: new RegExp(en.terminal.activate.submit) })
    .click();
}

/**
 * The kiosk (F8ca) — the player's home board — once it is up: its board's
 * heading, named after the first sport (Football, in both languages: the
 * fixtures' names).
 */
const kiosk = (page: Page) =>
  page.getByRole("heading", { level: 2, name: /^Football/ });

/** Activates this browser against Prism, and waits for the kiosk. */
async function activate(page: Page, baseURL: string | undefined) {
  await page.goto(terminalUrl(baseURL));
  await typeCode(page, "K7Q2M9XP");
  await expect(kiosk(page)).toBeVisible();
}

/** Answers `/api/terminal/status` with `body` (and `status`), as the route handler would. */
const statusAnswers =
  (body: unknown, status = 200) =>
  (route: Route) =>
    route.fulfill({
      status,
      contentType:
        status >= 400 ? "application/problem+json" : "application/json",
      json: body,
    });

/** Sends Prism's `Prefer` along with a route's requests (honoured only by `next dev`). */
const prefer = (value: string) => (route: Route) =>
  route.continue({
    headers: { ...route.request().headers(), prefer: value },
  });

/**
 * The screenshot, and what every screen must be: no sideways scroll, no raw
 * message keys or `{placeholders}`, no console errors beyond `allow`, and both
 * languages in the heading.
 */
async function shoot(
  page: Page,
  name: string,
  device: string,
  errors: string[],
  allow?: RegExp,
) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  // The Ethiopic and Barlow faces, before the picture is taken.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.screenshot({
    path: `${SHOTS}/terminal-${name}-${device}.png`,
    fullPage: true,
  });
  const text = await page.locator("body").innerText();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal scroll").toBeLessThanOrEqual(0);
  expect(text).not.toContain("Adama Kebele 04");
  expect(text).not.toContain("PC 3");
  expect(MESSAGE_KEYS.filter((key) => text.includes(key))).toEqual([]);
  expect(text.match(/\{[a-zA-Z]+\}/g) ?? []).toEqual([]);
  expect(errors.filter((error) => !allow?.test(error))).toEqual([]);
}

/** Nothing to press, type or follow on the page (the dev tools' button aside). */
const controls = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelectorAll("header a, nav, button, a, input, select")
        .length,
  );

for (const [device, viewport] of Object.entries({
  phone: { width: 375, height: 812 },
  desktop: { width: 1440, height: 900 },
})) {
  test.describe(`terminal · ${device}`, () => {
    test.use({ viewport });

    let errors: string[];
    test.beforeEach(({ page }) => {
      errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
    });
    test.afterEach(async ({ page }) => {
      await page.unrouteAll({ behavior: "ignoreErrors" });
    });

    test("loading: before the first status answer", async ({
      page,
      baseURL,
    }) => {
      await activate(page, baseURL);
      // A status read that never answers.
      await page.route(STATUS, () => {});
      await page.reload();
      // The kiosk's page itself, its reads held and nothing on it live: the
      // terminal's bar and the board's rows to come, no spinner.
      await expect(page.getByRole("status")).toHaveText(en.terminal.loading);
      await expect(page.getByTestId("board-skeleton")).toBeVisible();
      await expect(page.locator("[inert]")).toHaveCount(1);
      await expect(page.locator('header a[href="/"]')).toBeVisible();
      await shoot(page, "loading", device, errors);
    });

    test("activate: a new PC asks for its code, and nothing else (AC-4)", async ({
      page,
      baseURL,
    }) => {
      const response = await page.goto(terminalUrl(baseURL));
      expect(response?.status()).toBe(200);
      await expect(heading(page)).toContainText(am.terminal.activate.title);
      await expect(heading(page)).toContainText(en.terminal.activate.title);
      // One field and one button: no header, navigation or links of the player's.
      expect(
        await page.evaluate(() => ({
          inputs: document.querySelectorAll("input").length,
          buttons: document.querySelectorAll("button").length,
          other: document.querySelectorAll("header, nav, a").length,
        })),
      ).toEqual({ inputs: 1, buttons: 1, other: 0 });
      await shoot(page, "activate", device, errors);
    });

    test("activate-format: a typo is caught before it is sent (AC-4)", async ({
      page,
      baseURL,
    }) => {
      let sent = 0;
      await page.route(ACTIVATE, (route) => {
        sent += 1;
        return route.continue();
      });
      await page.goto(terminalUrl(baseURL));
      await typeCode(page, "K7Q2");
      await expect(alert(page)).toContainText(en.terminal.activate.format);
      expect(sent).toBe(0);
      await shoot(page, "activate-format", device, errors);
    });

    test("activate-wrong-code: Prism's 404 says no terminal has the code (AC-4)", async ({
      page,
      baseURL,
    }) => {
      await page.route(ACTIVATE, prefer("code=404"));
      await page.goto(terminalUrl(baseURL));
      await typeCode(page, "K7Q2M9XP");
      await expect(alert(page)).toContainText(en.terminal.activate.wrongCode);
      await expect(alert(page)).toContainText(am.terminal.activate.wrongCode);
      await shoot(page, "activate-wrong-code", device, errors, /status of 404/);
    });

    test("activate-expired: an expired code says so (AC-4)", async ({
      page,
      baseURL,
    }) => {
      // Prism's 410 is the shared BOOKING_EXPIRED example (contract request 014).
      await page.route(ACTIVATE, (route) =>
        route.fulfill({
          status: 410,
          contentType: "application/problem+json",
          json: {
            type: "https://api.example.et/errors/activation-expired",
            title: "This activation code has expired",
            status: 410,
            code: "RETAIL_ACTIVATION_EXPIRED",
          },
        }),
      );
      await page.goto(terminalUrl(baseURL));
      await typeCode(page, "K7Q2M9XP");
      await expect(alert(page)).toContainText(en.terminal.activate.expired);
      await shoot(page, "activate-expired", device, errors, /status of 410/);
    });

    test("activate-too-many: too many tries says when to try again (AC-4)", async ({
      page,
      baseURL,
    }) => {
      await page.route(ACTIVATE, (route) =>
        route.fulfill({
          status: 429,
          contentType: "application/problem+json",
          headers: { "Retry-After": "1800" },
          json: {
            type: "https://api.example.et/errors/rate-limited",
            title: "Too many requests",
            status: 429,
            code: "RATE_LIMITED",
          },
        }),
      );
      await page.goto(terminalUrl(baseURL));
      await typeCode(page, "K7Q2M9XP");
      await expect(alert(page)).toContainText(
        en.terminal.activate.tooMany.replace("{minutes}", "30"),
      );
      await shoot(page, "activate-too-many", device, errors, /status of 429/);
    });

    test("ready: activates against Prism and signs the status read with a non-extractable key (AC-2)", async ({
      page,
      context,
      baseURL,
    }) => {
      await page.goto(terminalUrl(baseURL));
      const read = page.waitForRequest(STATUS);
      await typeCode(page, "K7Q2M9XP");
      // An active terminal of an open shop is the kiosk (F8ca).
      await expect(kiosk(page)).toBeVisible();
      await expect(page.getByText("Adama Kebele 04")).toHaveCount(0);

      // The browser signed the read; the route handler added the rest and
      // Prism, which requires all three device headers, answered.
      const headers = (await read).headers();
      expect(headers["x-device-timestamp"]).toMatch(/^\d{13}$/);
      expect(headers["x-device-signature"]).toMatch(/^[A-Za-z0-9+/]{86}==$/);
      expect(headers.authorization).toBeUndefined();

      // The key in IndexedDB can sign but never be read out.
      const key = await page.evaluate(
        () =>
          new Promise<{ extractable: boolean; exported: boolean }>(
            (resolve, reject) => {
              const open = indexedDB.open("kelal-terminal");
              open.onerror = () => reject(open.error);
              open.onsuccess = () => {
                const get = open.result
                  .transaction("keys")
                  .objectStore("keys")
                  .get("device");
                get.onsuccess = async () => {
                  const pair = get.result as CryptoKeyPair;
                  const exported = await crypto.subtle
                    .exportKey("pkcs8", pair.privateKey)
                    .then(() => true)
                    .catch(() => false);
                  resolve({
                    extractable: pair.privateKey.extractable,
                    exported,
                  });
                };
              };
            },
          ),
      );
      expect(key).toEqual({ extractable: false, exported: false });

      // The token is in an httpOnly cookie: never in the page's reach.
      const cookie = (await context.cookies()).find(
        (c) => c.name === "kelal.terminal",
      );
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict" });
      expect(await page.evaluate(() => document.cookie)).not.toContain(
        "kelal.terminal",
      );

      // It boots straight back into the shop.
      await page.reload();
      await expect(kiosk(page)).toBeVisible();
    });

    test("revoked: a revoked terminal says so and offers nothing, after a reload too (AC-4)", async ({
      page,
      baseURL,
    }) => {
      await activate(page, baseURL);
      // Prism's 401 is AUTH_INVALID_CREDENTIALS: revoking "logs it out".
      await page.route(STATUS, prefer("code=401"));
      for (let boot = 0; boot < 2; boot += 1) {
        await page.reload();
        await expect(heading(page)).toContainText(
          en.terminal.blocked.revokedTitle,
        );
        await expect(heading(page)).toContainText(
          am.terminal.blocked.revokedTitle,
        );
        // The terminal's bar: the brand, home, and nothing else to press.
        expect(await controls(page)).toBe(1);
        await expect(
          page.getByRole("link", { name: /KelalSport/ }),
        ).toHaveAttribute("href", "/");
      }
      await shoot(page, "revoked", device, errors);
    });

    test("device-not-allowed: a PC the shop doesn't allow says so and offers nothing (AC-4)", async ({
      page,
      baseURL,
    }) => {
      await activate(page, baseURL);
      await page.route(
        STATUS,
        statusAnswers({ state: "blocked", reason: "device_not_allowed" }),
      );
      await page.reload();
      await expect(heading(page)).toContainText(
        en.terminal.blocked.deviceTitle,
      );
      expect(await controls(page)).toBe(1);
      await shoot(page, "device-not-allowed", device, errors);
    });

    test("closed: a closed shop's terminal says so", async ({
      page,
      baseURL,
    }) => {
      await activate(page, baseURL);
      // Prism's shop is open: the real answer, with the shop closed.
      await page.route(STATUS, async (route) => {
        // Node can't resolve `terminal.localhost`: the same request, sent to
        // localhost with the terminal's Host.
        const url = new URL(route.request().url());
        const host = url.host;
        url.hostname = "localhost";
        const response = await route.fetch({
          url: url.href,
          headers: { ...route.request().headers(), host },
        });
        const status = await response.json();
        status.terminal.shop.openNow = false;
        await route.fulfill({ response, json: status });
      });
      await page.reload();
      await expect(heading(page)).toContainText(en.terminal.closed.title);
      await expect(page.getByText("Adama Kebele 04")).toHaveCount(0);
      await shoot(page, "closed", device, errors);
    });

    test("lapsed: a terminal whose token expired asks for a new code", async ({
      page,
      baseURL,
    }) => {
      await activate(page, baseURL);
      await page.route(
        STATUS,
        statusAnswers({ state: "inactive", reason: "expired" }),
      );
      await page.reload();
      await expect(page.getByText(en.terminal.activate.lapsed)).toBeVisible();
      await expect(page.getByText(am.terminal.activate.lapsed)).toBeVisible();
      await shoot(page, "lapsed", device, errors);
    });

    test("offline: no answer yet and the server can't be reached; Try again", async ({
      page,
      baseURL,
    }) => {
      await activate(page, baseURL);
      await page.route(
        STATUS,
        statusAnswers(
          {
            type: "about:blank",
            title: "The sportsbook API could not be reached",
            status: 503,
            code: "SERVICE_UNAVAILABLE",
          },
          503,
        ),
      );
      await page.reload();
      await expect(heading(page)).toContainText(en.terminal.offline.title);
      await shoot(page, "offline", device, errors, /status of 503/);

      await page.unroute(STATUS);
      await page
        .getByRole("button", { name: new RegExp(en.terminal.offline.retry) })
        .click();
      await expect(kiosk(page)).toBeVisible();
    });

    test("kiosk-config-loading: the main page's loading while the kiosk's config is read, and nothing moves when the kiosk comes up (F8ca, review U1)", async ({
      page,
      baseURL,
    }) => {
      await activate(page, baseURL);
      let releaseConfig!: () => void;
      const configHeld = new Promise<void>(
        (resolve) => (releaseConfig = resolve),
      );
      await page.route(CONFIG, async (route) => {
        await configHeld;
        await route.continue();
      });
      // The board too, so the kiosk's own loading rows are there to compare.
      await page.route(BOARD, () => undefined);
      // Measured once the status is in and the config is asked: the frame
      // shows from the first paint, but is mounted again between the two.
      const configAsked = page.waitForRequest(CONFIG);
      await page.reload();
      await configAsked;

      await expect(page.getByRole("status")).toHaveText(en.terminal.loading);
      // The one on screen: as the kiosk comes up, React mounts its page
      // hidden before it swaps it in.
      const skeleton = page
        .getByTestId("board-skeleton")
        .filter({ visible: true });
      await expect(skeleton).toBeVisible();
      await expect(page.locator("[inert]")).toHaveCount(1);
      await shoot(page, "kiosk-config-loading", device, errors);
      const starting = await skeleton.boundingBox();

      releaseConfig();
      await expect(page.locator("[inert]")).toHaveCount(0);
      await expect(skeleton).toBeVisible();
      const up = await skeleton.boundingBox();
      expect(up, "the board's rows where they were while starting").toEqual(
        starting,
      );
    });

    test("kiosk-config-offline: the kiosk's config can't be read; Try again (F8ca)", async ({
      page,
      baseURL,
    }) => {
      await activate(page, baseURL);
      await page.route(CONFIG, (route) =>
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
      await page.reload();
      await expect(heading(page)).toContainText(en.terminal.offline.title, {
        timeout: 15_000,
      });
      await shoot(
        page,
        "kiosk-config-offline",
        device,
        errors,
        /status of 503/,
      );

      await page.unroute(CONFIG);
      await page
        .getByRole("button", { name: new RegExp(en.terminal.offline.retry) })
        .click();
      await expect(kiosk(page)).toBeVisible();
    });

    test("unavailable: a tenant without shop betting shows no sportsbook (F8ca AC-4)", async ({
      page,
      baseURL,
    }) => {
      await activate(page, baseURL);
      await page.route(CONFIG, (route) =>
        route.fulfill({
          json: {
            retail: false,
            bookingCodes: true,
            languages: ["am", "en"],
            defaultLanguage: "am",
            rules: null,
          },
        }),
      );
      await page.reload();
      await expect(heading(page)).toContainText(
        en.terminal.kiosk.unavailable.title,
      );
      await expect(heading(page)).toContainText(
        am.terminal.kiosk.unavailable.title,
      );
      expect(await page.getByRole("complementary").count()).toBe(0);
      expect(await page.getByRole("navigation").count()).toBe(0);
      await shoot(page, "unavailable", device, errors);
    });
  });
}

/** A price's accessible name: "Arsenal – Chelsea: Draw 3.40", maybe "…, odds rising". */
const PRICE = /: .+ \d+\.\d{2}(,|$)/;

/** Answers the kiosk's board as the route handler would: `body`, with `status`. */
const boardAnswers =
  (body: unknown, status = 200) =>
  (route: Route) =>
    route.fulfill({
      status,
      contentType:
        status >= 400 ? "application/problem+json" : "application/json",
      json: body,
    });

/**
 * The kiosk (F8ca): the player's home, league and match pages in the kiosk's
 * chrome, against the dev server's catalogue — Prism's, or the simulated board
 * under `NEXT_PUBLIC_REALTIME=simulate`, whose prices move — so prices are
 * found by their label's shape, as the player's screens find them. Each
 * screen in each language at each width.
 */
for (const [device, viewport] of Object.entries({
  phone: { width: 375, height: 812 },
  desktop: { width: 1440, height: 900 },
})) {
  for (const lang of ["am", "en"] as const) {
    const t = lang === "am" ? am : en;

    test.describe(`terminal kiosk · ${lang} · ${device}`, () => {
      test.use({ viewport });

      let errors: string[];
      test.beforeEach(({ page }) => {
        errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
      });
      test.afterEach(async ({ page }) => {
        await page.unrouteAll({ behavior: "ignoreErrors" });
      });

      /** Activated, in this describe's language, at the home board. */
      async function open(page: Page, baseURL: string | undefined) {
        await activate(page, baseURL);
        if (lang === "am") {
          await page.getByRole("button", { name: "አማ", exact: true }).click();
        }
        await expect
          .poll(() => page.evaluate(() => document.documentElement.lang))
          .toBe(lang);
        await expect(price(page)).toBeVisible();
      }

      /** Reloaded: the kiosk keeps no language, so this describe's is chosen again. */
      async function reload(page: Page) {
        await page.reload();
        await expect(kiosk(page)).toBeVisible();
        if (lang === "am") {
          await page.getByRole("button", { name: "አማ", exact: true }).click();
        }
      }

      /** The first open price on the page. */
      const price = (page: Page, n = 0) =>
        page
          .locator("main")
          .getByRole("button", { name: PRICE, disabled: false })
          .nth(n);

      test("kiosk-board: the player's home, without anything that needs a player (AC-1, AC-3)", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await expect(
          page.getByRole("button", { name: t.board.filters.top }),
        ).toBeVisible();
        for (const name of [
          t.header.login,
          t.header.register,
          t.nav.myBets,
          t.nav.wallet,
          t.header.responsibleGaming,
        ]) {
          await expect(page.getByRole("button", { name })).toHaveCount(0);
          await expect(page.getByRole("link", { name })).toHaveCount(0);
        }
        await expect(page.getByText(t.sidebar.favourites)).toHaveCount(0);
        await shoot(page, `kiosk-board-${lang}`, device, errors);
      });

      test("kiosk-picks: two picks in the player's slip (AC-2)", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await price(page, 0).click();
        await price(page, 3).click();
        if (device === "phone") {
          // The bar that counts the picks, before it opens the sheet (review U5).
          const bar = page.getByRole("button", {
            name: t.nav.slipAria.replace("{n}", "2"),
          });
          await expect(bar).toBeVisible();
          await shoot(page, `kiosk-picks-bar-${lang}`, device, errors);
          await bar.click();
        }
        await expect(
          page.getByRole("button", { name: t.betSlip.clearAll }).first(),
        ).toBeVisible();
        // Book bet in reach without scrolling the slip (F8cb, review U1).
        const slip =
          device === "phone"
            ? page.getByRole("dialog")
            : page.locator("aside").last();
        await expect(
          slip.getByRole("button", { name: t.betSlip.bookBet }),
        ).toBeInViewport({ ratio: 1 });
        await shoot(page, `kiosk-picks-${lang}`, device, errors);
      });

      /** The slip: its column from `xl`, its sheet (opened from the bar with `n` picks) below. */
      async function openSlip(page: Page, n: number) {
        if (device === "phone") {
          await page
            .getByRole("button", {
              name: t.nav.slipAria.replace("{n}", String(n)),
            })
            .click();
          return page.getByRole("dialog");
        }
        return page.locator("aside").last();
      }

      /** The first open price of a match other than the first price's. */
      async function otherMatchPrice(page: Page) {
        const match = (name: string | null) => name?.split(": ")[0];
        const first = match(await price(page, 0).getAttribute("aria-label"));
        const names = await page
          .locator("main")
          .getByRole("button", { name: PRICE, disabled: false })
          .evaluateAll((buttons) =>
            buttons.map((b) => b.getAttribute("aria-label")),
          );
        return price(
          page,
          names.findIndex((name) => match(name) !== first),
        );
      }

      /**
       * Types a stake in the player's stake field (the user's review: no keypad),
       * in place of the shop's minimum it starts at.
       */
      async function press(slip: ReturnType<Page["locator"]>, keys: string) {
        const field = slip.getByRole("textbox", { name: t.betSlip.totalStake });
        await field.clear();
        await field.pressSequentially(keys);
      }

      test("kiosk-slip: two picks priced with the shop's rules, the stake in the player's field (F8cb AC-3, AC-b1)", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await price(page, 0).click();
        await (await otherMatchPrice(page)).click();
        const slip = await openSlip(page, 2);
        await press(slip, "50");
        await expect(slip.getByRole("alert")).toHaveCount(0);
        await expect(
          slip.getByRole("textbox", { name: t.betSlip.totalStake }),
        ).toHaveValue("50");
        // slipcalc's figure on the shop's rules, not the dash of an unpriced slip.
        await expect(slip.getByTestId("net-payout")).not.toHaveText("—");
        await expect(
          page.getByRole("button", { name: t.betSlip.placeBet }),
        ).toHaveCount(0);
        // The payout and Book bet stay in view while the picks and the stake
        // scroll beneath them (review U1).
        await expect(slip.getByTestId("net-payout")).toBeInViewport({
          ratio: 1,
        });
        await expect(
          slip.getByRole("button", { name: t.betSlip.bookBet }),
        ).toBeInViewport({ ratio: 1 });
        await shoot(page, `kiosk-slip-${lang}`, device, errors);
      });

      test("kiosk-slip-too-low: a stake under the shop's minimum — a red field, the minimum below it, Book bet off (F8cb AC-3)", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await price(page, 0).click();
        const slip = await openSlip(page, 1);
        await press(slip, "5");
        const field = slip.getByRole("textbox", { name: t.betSlip.totalStake });
        await expect(field).toHaveAttribute("aria-invalid", "true");
        await expect(slip.getByText(/10\.00/).first()).toBeVisible();
        await expect(slip.getByRole("alert")).toHaveCount(0);
        const book = slip.getByRole("button", { name: t.betSlip.bookBet });
        await expect(book).toHaveAttribute("aria-disabled", "true");
        await expect(book).toBeInViewport({ ratio: 1 });
        await shoot(page, `kiosk-slip-too-low-${lang}`, device, errors);
      });

      test("kiosk-slip-no-rules: a tenant without a shop rule set shows the picks and no figure (F8cb AC-b2)", async ({
        page,
        baseURL,
      }) => {
        // The contract's tenant, without the shop's rules.
        await page.route(CONFIG, (route) =>
          route.fulfill({
            json: {
              retail: true,
              bookingCodes: true,
              languages: ["am", "en"],
              defaultLanguage: "am",
              rules: null,
            },
          }),
        );
        await open(page, baseURL);
        await price(page, 0).click();
        const slip = await openSlip(page, 1);
        await expect(slip.getByText(t.terminal.kiosk.noRules)).toBeVisible();
        await expect(
          slip.getByRole("textbox", { name: t.betSlip.totalStake }),
        ).toHaveCount(0);
        await expect(slip.getByTestId("net-payout")).toHaveCount(0);
        await shoot(page, `kiosk-slip-no-rules-${lang}`, device, errors);
      });

      test("kiosk-booking-code: load a code into the slip and explain a started match (AC-9)", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        // The real route, to Prism: the contract's booking 7KQ2M9X, one leg
        // still on sale (2.05 then, 2.10 now) and one whose match started.
        const answered = page.waitForResponse(
          "**/api/terminal/bookings/7KQ2M9X",
        );
        if (device === "phone") {
          await page
            .getByRole("button", { name: t.nav.slipAria.replace("{n}", "0") })
            .click();
        }
        const slip =
          device === "phone"
            ? page.getByRole("dialog")
            : page.locator("aside").last();
        await slip.getByLabel(t.betSlip.loadCode).fill("7kq2-m9x");
        await slip.getByRole("button", { name: t.betSlip.load }).click();
        expect((await answered).status()).toBe(200);

        const notice = slip.getByTestId("booking-notice");
        await expect(notice).toContainText(t.booking.reason.EVENT_STARTED);
        // The leg on sale is in the slip at the server's price, and only it.
        await expect(slip.getByText("Arsenal v Chelsea")).toBeVisible();
        const remove = slip.getByRole("button", {
          name: new RegExp(`^${t.betSlip.remove.replace("{pick}", ".+")}$`),
        });
        await expect(remove).toHaveCount(1);
        // In the pick's own row: the priced slip's total odds say 2.10 too (F8cb).
        await expect(
          remove.locator("xpath=..").getByText(/2\.10/),
        ).toBeVisible();
        await shoot(page, `kiosk-booking-code-${lang}`, device, errors);
      });

      test("kiosk-league: a league's page, from the kiosk's own address (AC-6)", async ({
        page,
        baseURL,
      }) => {
        // A league the board has (Prism's ids, or the simulated board's).
        const answered = page.waitForResponse(BOARD);
        await open(page, baseURL);
        const [section] = await (await answered).json();
        const path = `/terminal/competition/${encodeURIComponent(section.competition.id)}`;
        await page.goto(terminalUrl(baseURL, path));
        await expect(
          kiosk(page).or(page.locator("main h2").first()),
        ).toBeVisible();
        if (lang === "am") {
          await page.getByRole("button", { name: "አማ", exact: true }).click();
        }
        await expect(price(page)).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(path);
        await shoot(page, `kiosk-league-${lang}`, device, errors);
      });

      test("kiosk-match: a match's whole book, from its row's More (AC-7)", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await page
          .locator("main")
          .getByRole("link", { name: /\d/ })
          .filter({ hasText: "+" })
          .first()
          .click();
        await expect(page).toHaveURL(/\/terminal\/event\//);
        await expect(price(page)).toBeVisible();
        await shoot(page, `kiosk-match-${lang}`, device, errors);
      });

      if (device === "desktop") {
        // The player's search shows from xl up; so does the kiosk's.
        test("kiosk-search: the header's search, through the terminal (AC-8)", async ({
          page,
          baseURL,
        }) => {
          await open(page, baseURL);
          await page
            .getByRole("combobox", { name: t.header.search })
            .fill("ars");
          await expect(page.getByRole("option").first()).toBeVisible();
          await shoot(page, `kiosk-search-${lang}`, device, errors);
        });
      }

      test("kiosk-loading: the board's rows to come", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await page.route(BOARD, () => undefined);
        await reload(page);
        await expect(
          page.locator("main").getByRole("button", { name: PRICE }),
        ).toHaveCount(0);
        await shoot(page, `kiosk-loading-${lang}`, device, errors);
      });

      test("kiosk-empty: no matches, and the way back (AC-1)", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await page.route(BOARD, boardAnswers([]));
        await reload(page);
        await expect(page.getByText(t.board.empty.title)).toBeVisible();
        await expect(
          page.getByRole("button", { name: t.board.empty.action }),
        ).toBeVisible();
        await shoot(page, `kiosk-empty-${lang}`, device, errors);
      });

      test("kiosk-error: the matches couldn't load; Try again (AC-1)", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await page.route(
          BOARD,
          boardAnswers(
            {
              type: "about:blank",
              title: "The sportsbook API could not be reached",
              status: 503,
              code: "SERVICE_UNAVAILABLE",
            },
            503,
          ),
        );
        await reload(page);
        await expect(page.getByText(t.board.error.title)).toBeVisible({
          timeout: 15_000,
        });
        await expect(
          page.getByRole("button", { name: t.common.retry }),
        ).toBeVisible();
        await shoot(
          page,
          `kiosk-error-${lang}`,
          device,
          errors,
          /status of 503/,
        );
      });
    });
  }
}
