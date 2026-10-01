import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import en from "../../src/lib/i18n/messages/en.json";

/**
 * Screens worth looking at. Fixture IDs are the contract's examples, which is
 * what Prism serves.
 */
const SCREENS: Array<{ name: string; path: string }> = [
  { name: "home", path: "/" },
  { name: "home-upcoming", path: "/?filter=upcoming" },
  { name: "event", path: "/event/fx_arsenal_chelsea" },
  { name: "competition", path: "/competition/t_epl" },
  { name: "my-bets", path: "/my-bets" },
  { name: "transactions", path: "/transactions" },
  { name: "wallet", path: "/wallet" },
  { name: "profile", path: "/profile" },
  { name: "responsible-gaming", path: "/responsible-gaming" },
  { name: "login", path: "/login" },
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

          await page.goto(screen.path);
          await settle(page);
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

          expect(errors, "console errors").toEqual([]);
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
