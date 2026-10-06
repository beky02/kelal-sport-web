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

/** The kiosk's heading (F8ca), in the tenant's default language: Amharic. */
const kiosk = (page: Page) =>
  page.getByRole("heading", { level: 1, name: am.terminal.kiosk.matches });

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
      await expect(page.getByRole("status")).toContainText(en.terminal.loading);
      await expect(page.getByRole("status")).toContainText(am.terminal.loading);
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
      await expect(page.getByText("Adama Kebele 04")).toBeVisible();

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
        expect(await controls(page)).toBe(0);
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
      expect(await controls(page)).toBe(0);
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
      await expect(page.getByText("Adama Kebele 04")).toBeVisible();
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

    test("unavailable: a tenant without shop betting shows no sportsbook (F8ca AC-4)", async ({
      page,
      baseURL,
    }) => {
      await activate(page, baseURL);
      await page.route(CONFIG, (route) =>
        route.fulfill({
          json: {
            retail: false,
            languages: ["am", "en"],
            defaultLanguage: "am",
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
      await expect(page.getByText("Adama Kebele 04")).toBeVisible();
      expect(await page.getByRole("complementary").count()).toBe(0);
      expect(await page.getByRole("navigation").count()).toBe(0);
      await shoot(page, "unavailable", device, errors);
    });
  });
}

/** A price's accessible name: "Arsenal – Chelsea: Draw 3.40", maybe "…, odds rising". */
const PRICE = /: .+ \d+\.\d{2}(,|$)/;

/** Every visible button's height under the kiosk's own elements, in px. */
const buttonHeights = (page: Page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "header button, main button, aside button, body > div button",
      ),
    ]
      .filter((button) => (button as HTMLElement).offsetParent !== null)
      .map((button) => ({
        name: button.getAttribute("aria-label") ?? button.textContent ?? "",
        height: button.getBoundingClientRect().height,
      })),
  );

/**
 * The kiosk (F8ca) against the dev server's catalogue — Prism's three matches,
 * or the simulated board when `NEXT_PUBLIC_REALTIME=simulate`, whose prices
 * move — so prices are found by their label's shape, as the player's screens
 * find them, in each language at each width.
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

      /** Activated, in this describe's language, at the board. */
      async function open(page: Page, baseURL: string | undefined) {
        await activate(page, baseURL);
        if (lang === "en") {
          await page.getByRole("button", { name: "English" }).click();
        }
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: t.terminal.kiosk.matches,
          }),
        ).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.lang)).toBe(
          lang,
        );
      }

      /** The first open price of the `n`th match on the board. */
      const price = (page: Page, n: number) =>
        page
          .locator("main li")
          .nth(n)
          .getByRole("button", { name: PRICE, disabled: false })
          .first();

      test("kiosk-board: the sports, the days and the matches with their prices (AC-1, AC-3)", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await expect(
          page.getByRole("navigation", { name: t.nav.sports }),
        ).toBeVisible();
        await expect(
          page.getByRole("group", { name: t.terminal.kiosk.days }),
        ).toBeVisible();
        await expect(price(page, 0)).toBeVisible();
        expect(
          await page.getByRole("heading", { level: 2 }).count(),
        ).toBeGreaterThan(0);
        expect(
          await page.getByRole("button", { name: PRICE }).count(),
        ).toBeGreaterThanOrEqual(3);
        await shoot(page, `kiosk-board-${lang}`, device, errors);
      });

      test("kiosk-picks: picks in the slip, and every price, tab and button at least 48 px high (AC-2)", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await price(page, 0).click();
        await price(page, 1).click();

        const heights = await buttonHeights(page);
        expect(heights.length).toBeGreaterThan(10);
        expect(heights.filter((button) => button.height < 48)).toEqual([]);

        if (device === "phone") {
          await page
            .getByRole("button", { name: t.nav.slipAria.replace("{n}", "2") })
            .click();
        }
        const slip = page.getByRole("complementary", { name: t.betSlip.title });
        await expect(slip).toBeVisible();
        await expect(slip.getByRole("listitem")).toHaveCount(2);
        const slipHeights = await buttonHeights(page);
        expect(slipHeights.filter((button) => button.height < 48)).toEqual([]);
        await shoot(page, `kiosk-picks-${lang}`, device, errors);
      });

      test("kiosk-loading: the board's rows to come", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await page.route(BOARD, () => undefined);
        await page
          .getByRole("group", { name: t.terminal.kiosk.days })
          .getByRole("button")
          .nth(1)
          .click();
        await expect(page.locator("[aria-busy=true]")).toBeVisible();
        await shoot(page, `kiosk-loading-${lang}`, device, errors);
      });

      test("kiosk-empty: no matches on a day, and the way back (AC-1)", async ({
        page,
        baseURL,
      }) => {
        await open(page, baseURL);
        await page.route(BOARD, (route) => route.fulfill({ json: [] }));
        await page
          .getByRole("group", { name: t.terminal.kiosk.days })
          .getByRole("button")
          .nth(2)
          .click();
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
        await page.route(BOARD, (route) =>
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
        await page
          .getByRole("group", { name: t.terminal.kiosk.days })
          .getByRole("button")
          .nth(1)
          .click();
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
