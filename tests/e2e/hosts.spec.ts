import { expect, test, type Page } from "@playwright/test";
import en from "../../src/lib/i18n/messages/en.json";
import am from "../../src/lib/i18n/messages/am.json";

/**
 * The host split (F8a AC-3, FD1) against the dev server: one build, two
 * sites. Outside production `terminal.localhost` is the terminal's host
 * (`TERMINAL_HOST_MAP` unset) and Chrome sends any `*.localhost` to this
 * machine, so the browser reaches both. Node can't resolve
 * `terminal.localhost`, so the terminal is visited through the page, not
 * `request`.
 */
const terminalUrl = (baseURL: string | undefined, path: string) => {
  const url = new URL(path, baseURL);
  url.hostname = `terminal.${url.hostname}`;
  return url.href;
};

/** What Next's own 404 page says: the other site's routes don't exist here. */
const NOT_FOUND = "This page could not be found.";

async function expectNotFound(page: Page, url: string) {
  const response = await page.goto(url);
  expect(response?.status(), url).toBe(404);
  await expect(page.getByText(NOT_FOUND), url).toBeVisible();
}

test("answers /terminal and /api/terminal/x with a 404 on the player host (AC-3)", async ({
  page,
  baseURL,
}) => {
  for (const path of ["/terminal", "/api/terminal/x"]) {
    await expectNotFound(page, new URL(path, baseURL).href);
  }
  // The player site itself is unchanged.
  const home = await page.goto(new URL("/", baseURL).href);
  expect(home?.status()).toBe(200);
});

test("answers /profile, /login, /wallet and /api/me with a 404 on the terminal host (AC-3)", async ({
  page,
  baseURL,
}) => {
  for (const path of ["/profile", "/login", "/wallet", "/api/me"]) {
    await expectNotFound(page, terminalUrl(baseURL, path));
  }
});

for (const [device, viewport] of Object.entries({
  phone: { width: 375, height: 812 },
  desktop: { width: 1440, height: 900 },
})) {
  test.describe(device, () => {
    test.use({ viewport });

    test("shows the terminal placeholder at / on the terminal host, in both languages (AC-3)", async ({
      page,
      baseURL,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      const response = await page.goto(terminalUrl(baseURL, "/"));
      expect(response?.status()).toBe(200);
      // The address stays `/`: the proxy shows /terminal there, no redirect.
      expect(new URL(page.url()).pathname).toBe("/");

      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toContainText(am.terminal.placeholder.title);
      await expect(heading).toContainText(en.terminal.placeholder.title);
      await expect(page.getByText(am.terminal.placeholder.body)).toBeVisible();
      await expect(page.getByText(en.terminal.placeholder.body)).toBeVisible();
      // Nothing of the player's site: no header, no slip, no login. Counted
      // in the page's own DOM: role queries would also find the dev server's
      // tools button, inside its shadow root.
      const controls = await page.evaluate(
        () => document.querySelectorAll("header, nav, button, a, input").length,
      );
      expect(controls, "header, navigation or controls").toBe(0);

      await page.addStyleTag({
        content: "nextjs-portal { display: none !important; }",
      });
      await page.screenshot({
        path: `test-results/ui/terminal-placeholder-${device}.png`,
        fullPage: true,
      });

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, "horizontal scroll").toBeLessThanOrEqual(0);
      expect(errors, "console errors").toEqual([]);
    });
  });
}

test("still refuses a 1 MB login with 413 now the proxy runs on route handlers (F8a decision 9)", async ({
  request,
}) => {
  const response = await request.post("/api/auth/login", {
    data: JSON.stringify({ phone: "9".repeat(1024 * 1024), password: "x" }),
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "KelalSport",
    },
  });
  expect(response.status()).toBe(413);
});
