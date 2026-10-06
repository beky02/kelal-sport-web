import { expect, test, type Page } from "@playwright/test";
import en from "../../src/lib/i18n/messages/en.json";
import am from "../../src/lib/i18n/messages/am.json";

/**
 * The host split (F8a AC-3, FD1) against the dev server: one build, two
 * sites. `terminal.localhost` is the terminal's host — the default outside
 * production while `TERMINAL_HOST_MAP` is blank, as `.env.example` leaves it —
 * and Chrome sends any `*.localhost` to this machine, so the browser reaches
 * both. Node can't resolve
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

    test("shows the terminal's activation at / on the terminal host, in both languages, and nothing of the player's (AC-3, F8b)", async ({
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
      await expect(heading).toContainText(am.terminal.activate.title);
      await expect(heading).toContainText(en.terminal.activate.title);
      // Nothing of the player's site: no header, navigation or links — only
      // the activation form's one field and one button (F8b). Counted in the
      // page's own DOM: role queries would also find the dev server's tools
      // button, inside its shadow root.
      const controls = await page.evaluate(() => ({
        player: document.querySelectorAll("header, nav, a").length,
        form: document.querySelectorAll("button, input").length,
      }));
      expect(controls, "header, navigation or controls").toEqual({
        player: 0,
        form: 2,
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

test.describe("an oversized login, now the proxy holds route-handler bodies (F8a decision 9)", () => {
  const headers = {
    "Content-Type": "application/json",
    "X-Requested-With": "KelalSport",
  };
  const body = JSON.stringify({
    phone: "9".repeat(1024 * 1024),
    password: "x",
  });

  test("is refused with 413 when it says its length", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      data: body,
      headers,
    });
    expect(response.status()).toBe(413);
  });

  test("is refused, and goes nowhere, when it is sent chunked", async ({
    baseURL,
  }) => {
    // No Content-Length: Next cuts it at 32 KiB for the proxy, so the handler
    // sees a cut body and refuses it as not JSON (09-security, known limits).
    const send = (text: string) => {
      const bytes = new TextEncoder().encode(text);
      const chunked = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let at = 0; at < bytes.length; at += 16 * 1024) {
            controller.enqueue(bytes.subarray(at, at + 16 * 1024));
          }
          controller.close();
        },
      });
      return fetch(new URL("/api/auth/login", baseURL), {
        method: "POST",
        headers,
        body: chunked,
        duplex: "half",
      } as RequestInit & { duplex: "half" });
    };
    // A chunked login of the usual size goes through (Prism's player)…
    const usual = await send(
      JSON.stringify({ phone: "911234567", password: "correct horse battery" }),
    );
    expect(usual.status).toBe(200);
    // …a megabyte doesn't.
    const response = await send(body);
    expect([413, 422]).toContain(response.status);
    expect((await response.json()).code).toBe("VALIDATION_FAILED");
  });
});
