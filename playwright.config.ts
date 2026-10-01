import { defineConfig } from "@playwright/test";

/**
 * The UI check: every screen at phone and desktop width, in English and
 * Amharic, against whatever API the dev server points at (Prism locally).
 *
 * Uses the installed Google Chrome, so nothing is downloaded. Reuses a running
 * `next dev` — Next.js refuses a second one in the same folder.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/playwright",
  fullyParallel: true,
  reporter: [["list"]],
  timeout: 60_000,
  use: { baseURL, channel: "chrome", trace: "off" },
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
