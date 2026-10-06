import { expect, test, type Page } from "@playwright/test";
import am from "../../src/lib/i18n/messages/am.json";
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

// An /api/me read still being rewritten when a test ends would fail the run
// outside any test, as screens.spec.ts and terminal.spec.ts already guard.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

/**
 * An account saved in English. Logging in takes the account's language (F7b),
 * and Prism's player is saved in Amharic: the tests about the session itself
 * read English throughout.
 */
async function accountReadsEnglish(page: Page) {
  await page.route("**/api/me", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const json = await response.json();
    if (json.player) json.player.language = "en";
    await route.fulfill({ response, json });
  });
}

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

  await accountReadsEnglish(page);
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
  await accountReadsEnglish(page);
  await page.goto("/wallet");
  await expect(page).toHaveURL(/\/login\?next=%2Fwallet$/);

  await logInThroughTheDialog(page);
  await expect(page).toHaveURL(/\/wallet$/);
  await expect(
    page.getByRole("heading", { name: en.wallet.title }),
  ).toBeVisible();
});

test("logging in on another device takes the language saved on the account (F7b AC-8)", async ({
  page,
}) => {
  // This browser reads English; Prism's player saved Amharic on the account.
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await logInThroughTheDialog(page);

  // Signed in, the page reads the account's language…
  await expect(page.locator("html")).toHaveAttribute("lang", "am");
  // …and keeps it: a reload, and Profile, read Amharic with nothing unsaved.
  await page.goto("/profile");
  await expect(
    page.getByRole("button", { name: am.profile.logOut }),
  ).toBeVisible();
  await expect(page.getByText(am.profile.languageNotSaved)).toHaveCount(0);
});

test("logging out clears the session and the account pages close again (AC-8)", async ({
  page,
}) => {
  await accountReadsEnglish(page);
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

test("registers with the SMS code, is signed in, and verifies with Fayda against Prism (AC-1)", async ({
  page,
  context,
}) => {
  const bodies: string[] = [];
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname.startsWith("/api/")) {
      bodies.push(await response.text().catch(() => ""));
    }
  });

  await page.goto("/register");
  const dialog = page.getByRole("dialog");

  // The caret starts in the number, as on log in — not on the close button.
  await expect(dialog.getByLabel(en.auth.phone, { exact: true })).toBeFocused();
  await dialog.getByLabel(en.auth.phone, { exact: true }).fill("911234567");

  // Terms opens in a new tab and leaves its box alone; the flow stays.
  const popup = page.waitForEvent("popup");
  await dialog.getByRole("link", { name: /^Terms/ }).click();
  await (await popup).close();
  await expect(dialog.getByRole("checkbox").nth(1)).not.toBeChecked();
  await expect(dialog.getByLabel(en.auth.phone, { exact: true })).toHaveValue(
    "911234567",
  );

  // Both consents (age, then terms).
  await dialog.getByRole("checkbox").nth(0).check();
  await dialog.getByRole("checkbox").nth(1).check();
  await dialog
    .getByRole("button", { name: en.auth.continue, exact: true })
    .click();

  // The code is held here and checked with the details.
  await dialog.getByLabel(en.auth.otpLabel).fill("482913");
  await dialog
    .getByRole("button", { name: en.auth.continue, exact: true })
    .click();

  await dialog.getByLabel(en.auth.fullName).fill("Abebe Kebede");
  await dialog.getByLabel(en.auth.dateOfBirth).fill("12/04/1998");
  await dialog
    .getByLabel(en.auth.password, { exact: true })
    .fill("correct horse battery");
  await dialog
    .getByLabel(en.auth.confirmPassword)
    .fill("correct horse battery");
  const created = page.waitForResponse("**/api/auth/register");
  await dialog.getByRole("button", { name: en.auth.createAccount }).click();
  expect((await created).status()).toBe(201);

  // Signed in: the sealed, httpOnly cookie, and /api/me says who.
  await expect(dialog.getByLabel(en.auth.fin)).toBeVisible();
  const session = (await context.cookies()).find(
    (cookie) => cookie.name === "kelal.session",
  );
  expect(session?.httpOnly).toBe(true);
  const me = await page.request.get("/api/me");
  expect((await me.json()).player).not.toBeNull();

  // The ID: Fayda texts its own code; Prism's first verdict is `verified`.
  await dialog.getByLabel(en.auth.fin).fill("482109375516");
  await dialog.getByRole("checkbox").first().check();
  await dialog.getByRole("button", { name: en.auth.verifyWithFayda }).click();
  await dialog.getByLabel(en.auth.otpLabel).fill("123456");
  await dialog
    .getByRole("button", { name: en.auth.verify, exact: true })
    .click();
  await expect(dialog.getByText(en.auth.kycVerifiedTitle)).toBeVisible();

  const inBrowser = await page.evaluate(() => ({
    cookie: document.cookie,
    local: JSON.stringify(localStorage),
  }));
  for (const marker of TOKEN_MARKERS) {
    expect(inBrowser.cookie, "document.cookie").not.toContain(marker);
    expect(inBrowser.local, "localStorage").not.toContain(marker);
    for (const body of bodies) {
      expect(body, "a response body to the browser").not.toContain(marker);
    }
  }
});
