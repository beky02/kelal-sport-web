import { expect, test } from "@playwright/test";
import en from "../../src/lib/i18n/messages/en.json";

/**
 * The session against the dev server and Prism (F4a). Prism answers login with
 * the contract's example tokens, so these are the strings that must never reach
 * the browser.
 */
const TOKEN_MARKERS = [
  "eyJhbGciOi",
  "rt_2b7Y4Z5N6P0R1S",
  "access_token",
  "refresh_token",
];

const CREDENTIALS = { phone: "911234567", password: "correct horse battery" };

/** The dialog's own form — a guest's header has a "Log in" button of its own. */
async function logInThroughTheDialog(page: import("@playwright/test").Page) {
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel(en.auth.phone, { exact: true })
    .fill(CREDENTIALS.phone);
  await dialog
    .getByLabel(en.auth.password, { exact: true })
    .fill(CREDENTIALS.password);
  await dialog
    .getByRole("button", { name: en.auth.logIn, exact: true })
    .click();
}

test("logs in through the dialog and leaves no token in the browser (AC-3)", async ({
  page,
  context,
}) => {
  const bodies: string[] = [];
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname.startsWith("/api/")) {
      bodies.push(await response.text().catch(() => ""));
    }
  });

  await page.goto("/login");
  await logInThroughTheDialog(page);
  // Signed in: the header shows the balance instead of Log in / Register.
  await expect(page.getByRole("link", { name: /balance/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: en.header.login, exact: true }),
  ).toHaveCount(0);

  const session = (await context.cookies()).find(
    (cookie) => cookie.name === "kelal.session",
  );
  expect(session).toBeDefined();
  expect(session!.httpOnly).toBe(true);
  expect(session!.sameSite).toBe("Lax");
  for (const marker of TOKEN_MARKERS) {
    expect(session!.value, "sealed cookie").not.toContain(marker);
  }

  const inBrowser = await page.evaluate(() => ({
    cookie: document.cookie,
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(inBrowser.cookie, "httpOnly: script sees no session").not.toContain(
    "kelal.session",
  );
  expect(bodies.length).toBeGreaterThan(0);
  for (const marker of TOKEN_MARKERS) {
    expect(inBrowser.cookie, "document.cookie").not.toContain(marker);
    expect(inBrowser.local, "localStorage").not.toContain(marker);
    expect(inBrowser.session, "sessionStorage").not.toContain(marker);
    for (const body of bodies) {
      expect(body, "a response body to the browser").not.toContain(marker);
    }
  }
});

test("a wrong password is refused in the API's own terms, not as an outage", async ({
  page,
}) => {
  // Prism's 401 (`Prefer`, next dev only). Inside Next.js a 401 to a POST once
  // surfaced as "fetch failed"; this is the regression check.
  await page.route("**/api/auth/login", (route) =>
    route.continue({
      headers: { ...route.request().headers(), prefer: "code=401" },
    }),
  );
  await page.goto("/login");
  const answered = page.waitForResponse("**/api/auth/login");
  await logInThroughTheDialog(page);
  const response = await answered;
  expect(response.status()).toBe(401);
  expect((await response.json()).code).toBe("AUTH_INVALID_CREDENTIALS");
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    en.auth.errors.AUTH_INVALID_CREDENTIALS,
  );
});

test("refuses a cross-origin POST, and one without the CSRF header (AC-4)", async ({
  request,
}) => {
  const foreign = await request.post("/api/auth/login", {
    data: CREDENTIALS,
    headers: {
      Origin: "https://evil.example",
      "X-Requested-With": "KelalSport",
    },
  });
  expect(foreign.status()).toBe(403);
  expect((await foreign.json()).code).toBe("PERMISSION_DENIED");

  const noHeader = await request.post("/api/auth/login", { data: CREDENTIALS });
  expect(noHeader.status()).toBe(403);

  const form = await request.post("/api/auth/login", {
    form: CREDENTIALS,
    headers: { "X-Requested-With": "KelalSport" },
  });
  expect(form.status()).toBe(415);
});

test("says guest without a cookie, and never caches who is signed in (AC-8)", async ({
  request,
}) => {
  const response = await request.get("/api/me");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ player: null });
  expect(response.headers()["cache-control"]).toBe("no-store");
});

test("sends a visitor without a session from the wallet to log in, and back afterwards", async ({
  page,
}) => {
  await page.goto("/wallet");
  await expect(page).toHaveURL(/\/login\?next=%2Fwallet$/);

  await logInThroughTheDialog(page);
  await expect(page).toHaveURL(/\/wallet$/);
  await expect(
    page.getByRole("heading", { name: en.wallet.title }),
  ).toBeVisible();
});

test("logging out clears the session and the account pages close again (AC-8)", async ({
  page,
}) => {
  await page.goto("/login");
  await logInThroughTheDialog(page);
  await expect(page.getByRole("link", { name: /balance/i })).toBeVisible();

  await page.goto("/profile");
  await page.getByRole("button", { name: en.profile.logOut }).click();
  await page.waitForURL("/");
  await expect(
    page.getByRole("button", { name: en.header.login, exact: true }).first(),
  ).toBeVisible();

  await page.goto("/wallet");
  await expect(page).toHaveURL(/\/login\?next=%2Fwallet$/);
  const me = await page.request.get("/api/me");
  expect(await me.json()).toEqual({ player: null });
});
