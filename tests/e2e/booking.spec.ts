import { expect, test } from "@playwright/test";

/**
 * The `/b/{code}` deep link against the dev server and Prism (AC-8r): what
 * Telegram's preview bot reads, and every state of the page.
 */
const TELEGRAM = "TelegramBot (like TwitterBot)";

const head = (html: string) => html.split("</head>")[0];

test("serves /b/7KQ2M9X with Open Graph tags in the head for Telegram's preview bot", async ({
  request,
}) => {
  const response = await request.get("/b/7KQ2M9X", {
    headers: { "User-Agent": TELEGRAM },
  });
  expect(response.status()).toBe(200);
  const html = head(await response.text());
  expect(html).toMatch(/<meta property="og:title" content="[^"]*7KQ2M9X"/);
  expect(html).toMatch(/<meta property="og:description" content="[^"]+"/);
  expect(html).toMatch(/<meta property="og:url" content="[^"]*\/b\/7KQ2M9X"/);
  expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
});

test("shows the expired page for a 410", async ({ page }) => {
  await page.route("**/b/7KQ2M9X", (route) =>
    route.continue({
      headers: { ...route.request().headers(), prefer: "code=410" },
    }),
  );
  await page.goto("/b/7KQ2M9X");
  await expect(
    page.getByRole("heading", { name: "This code has expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to the sportsbook" }),
  ).toHaveAttribute("href", "/");
});

test("answers 404 for an unknown code, in the booking's words", async ({
  page,
}) => {
  await page.route("**/b/7KQ2M9X", (route) =>
    route.continue({
      headers: { ...route.request().headers(), prefer: "code=404" },
    }),
  );
  const response = await page.goto("/b/7KQ2M9X");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "No booking with this code" }),
  ).toBeVisible();
  await expect(
    page.getByText("Check code 7KQ2M9X and try again."),
  ).toBeVisible();
  // A 404 can't join screens.spec (its console always has the document's 404),
  // so its screenshot is taken here for review.
  await page.screenshot({
    path: "test-results/ui/booking-not-found-en-desktop.png",
    fullPage: true,
  });
});

test("never repeats text from the address that isn't a code", async ({
  page,
}) => {
  const response = await page.goto(
    "/b/CALL%200911000000%20TO%20CLAIM%20YOUR%20WIN",
  );
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Check the code and try again.")).toBeVisible();
  await expect(page.getByText(/0911000000/)).toHaveCount(0);
});

test("redirects a lowercase code to the canonical path", async ({ page }) => {
  await page.goto("/b/7kq2m9x");
  await expect(page).toHaveURL(/\/b\/7KQ2M9X$/);
});
