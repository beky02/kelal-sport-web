import { expect, test } from "@playwright/test";

/**
 * The public ticket check `/t/{ticket}` against the dev server and Prism (AC-4,
 * AC-9): what Telegram's preview bot reads, the page and its form without
 * JavaScript, and every state. Prism answers every number with its one
 * example — `K7Q2-M9XP-M`, won — so a page for another number shows that one.
 */
const TELEGRAM = "TelegramBot (like TwitterBot)";

const head = (html: string) => html.split("</head>")[0];

test("serves /t/K7Q2-M9XP-M with Open Graph tags in the head for Telegram's preview bot (AC-9)", async ({
  request,
}) => {
  const response = await request.get("/t/K7Q2-M9XP-M", {
    headers: { "User-Agent": TELEGRAM },
  });
  expect(response.status()).toBe(200);
  const html = head(await response.text());
  expect(html).toMatch(/<meta property="og:title" content="[^"]*K7Q2-M9XP-M"/);
  expect(html).toMatch(/<meta property="og:description" content="[^"]+"/);
  expect(html).toMatch(
    /<meta property="og:url" content="[^"]*\/t\/K7Q2-M9XP-M"/,
  );
  expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
  // The preview carries no money.
  expect(html).not.toContain("289.17");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("renders /t/R7K2-M9XP-K's status with JavaScript disabled (AC-4)", async ({
    page,
  }) => {
    const response = await page.goto("/t/R7K2-M9XP-K");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /^Ticket [0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]$/,
    );
    await expect(page.getByTestId("ticket-status")).toHaveText("Won");
    await expect(page.getByText("Arsenal v Chelsea")).toBeVisible();
    await expect(page.getByText("ETB 289.17")).toBeVisible();
  });

  test("checks a typed number from the plain form without JavaScript (AC-4)", async ({
    page,
  }) => {
    await page.goto("/t");
    await page.getByLabel("Ticket number").fill("r7k2 m9xp k");
    await page.getByRole("button", { name: "Check", exact: true }).click();

    await expect(page).toHaveURL(/\/t\/R7K2-M9XP-K$/);
    await expect(page.getByTestId("ticket-status")).toHaveText("Won");
  });

  test("says what a ticket number looks like when the form gets something else", async ({
    page,
  }) => {
    await page.goto("/t");
    await page.getByLabel("Ticket number").fill("K7Q2-M9XP-X");
    await page.getByRole("button", { name: "Check", exact: true }).click();

    await expect(page).toHaveURL(/\/t\?ticket=/);
    await expect(page.getByRole("alert")).toContainText(
      "A ticket number has 9 letters and numbers",
    );
    // What was typed is not repeated: a crafted link could carry anything.
    await expect(page.getByText("K7Q2-M9XP-X")).toHaveCount(0);
  });
});

test("answers 404 for an unknown number, in the ticket's words (AC-9)", async ({
  page,
}) => {
  await page.route("**/t/K7Q2-M9XP-M", (route) =>
    route.continue({
      headers: { ...route.request().headers(), prefer: "code=404" },
    }),
  );
  const response = await page.goto("/t/K7Q2-M9XP-M");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "No ticket with this number" }),
  ).toBeVisible();
  await expect(
    page.getByText("Check number K7Q2-M9XP-M and try again."),
  ).toBeVisible();
  // The way on: check another number.
  await expect(page.getByLabel("Ticket number")).toBeVisible();
  // A 404 can't join screens.spec (its console always has the document's
  // 404), so its screenshot is taken here for review, at the desktop width,
  // settled and without the dev server's badge, as screens.spec takes them.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.screenshot({
    path: "test-results/ui/ticket-not-found-en-desktop.png",
    fullPage: true,
  });
});

test("answers 404 for a number whose check character is wrong, without looking it up", async ({
  page,
}) => {
  // Prism would answer any number it was asked about with its example: a
  // 404 here means nothing was asked.
  const response = await page.goto("/t/K7Q2-M9XP-X");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Check the number and try again.")).toBeVisible();
  await expect(page.getByText("K7Q2-M9XP-X")).toHaveCount(0);
});

test("never repeats text from the address that isn't a ticket number", async ({
  page,
}) => {
  const response = await page.goto(
    "/t/CALL%200911000000%20TO%20CLAIM%20YOUR%20WIN",
  );
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Check the number and try again.")).toBeVisible();
  await expect(page.getByText(/0911000000/)).toHaveCount(0);
});

test("redirects a typed number to its canonical path (AC-9)", async ({
  page,
}) => {
  await page.goto("/t/k7q2m9xpm");
  await expect(page).toHaveURL(/\/t\/K7Q2-M9XP-M$/);

  await page.goto("/t/k7q2%20m9xp%20m");
  await expect(page).toHaveURL(/\/t\/K7Q2-M9XP-M$/);

  await page.goto("/t?ticket=k7q2-m9xp-m");
  await expect(page).toHaveURL(/\/t\/K7Q2-M9XP-M$/);
});
