// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hostSplitViolations } from "../../scripts/check-host-split.mjs";

/**
 * The build-output check behind F8a AC-4, on manifests shaped like the ones
 * `next build` writes to `.next/server/app/**\/*_client-reference-manifest.js`
 * (`entryJSFiles` paths are `static/chunks/…`; a client module's `chunks` are
 * `/_next/static/chunks/…`).
 */
const P = "[project]/src/app/(player)";
const T = "[project]/src/app/(terminal)";
const NEXT = "[project]/node_modules/next/dist/client/components";

const framework = {
  [`${NEXT}/layout-router.js`]: {
    chunks: ["/_next/static/chunks/framework.js"],
  },
};

const playerHome = {
  route: "/(player)/page",
  entryJSFiles: {
    [`${P}/layout`]: [
      "static/chunks/framework.js",
      "static/chunks/providers.js",
    ],
    [`${P}/page`]: ["static/chunks/framework.js", "static/chunks/home.js"],
  },
  clientModules: {
    ...framework,
    [`${P}/providers.tsx`]: { chunks: ["/_next/static/chunks/providers.js"] },
    "[project]/src/features/sportsbook/components/SportsbookView.tsx": {
      chunks: ["/_next/static/chunks/home.js"],
    },
  },
};

const terminalPage = {
  route: "/(terminal)/terminal/page",
  entryJSFiles: {
    [`${T}/layout`]: ["static/chunks/framework.js"],
    [`${T}/terminal/page`]: ["static/chunks/framework.js"],
  },
  clientModules: { ...framework },
};

describe("the host split in the build output (F8a AC-4)", () => {
  it("passes routes that keep apart", () => {
    expect(hostSplitViolations([playerHome, terminalPage])).toEqual([]);
  });

  it("finds a terminal route that loads the player layout's code", () => {
    const leaky = {
      ...terminalPage,
      entryJSFiles: {
        ...terminalPage.entryJSFiles,
        [`${T}/layout`]: [
          "static/chunks/framework.js",
          "static/chunks/providers.js",
        ],
      },
    };
    expect(hostSplitViolations([playerHome, leaky])).toEqual([
      expect.stringMatching(
        /\/\(terminal\)\/terminal\/page loads the player layout's chunk static\/chunks\/providers\.js/,
      ),
    ]);
  });

  it("finds a terminal route that references a module of (player)", () => {
    const leaky = {
      ...terminalPage,
      clientModules: {
        ...terminalPage.clientModules,
        [`${P}/providers.tsx`]: {
          chunks: ["/_next/static/chunks/providers.js"],
        },
      },
    };
    const found = hostSplitViolations([playerHome, leaky]);
    expect(found).toContainEqual(
      expect.stringMatching(
        /references \[project\]\/src\/app\/\(player\)\/providers\.tsx/,
      ),
    );
  });

  it("finds a player route that references (terminal)", () => {
    const terminalWithCode = {
      ...terminalPage,
      clientModules: {
        ...terminalPage.clientModules,
        [`${T}/terminal/Kiosk.tsx`]: {
          chunks: ["/_next/static/chunks/kiosk.js"],
        },
      },
    };
    const leaky = {
      ...playerHome,
      entryJSFiles: {
        ...playerHome.entryJSFiles,
        [`${P}/page`]: ["static/chunks/home.js", "static/chunks/kiosk.js"],
      },
    };
    expect(hostSplitViolations([leaky, terminalWithCode])).toEqual([
      expect.stringMatching(
        /\/\(player\)\/page loads the terminal's chunk static\/chunks\/kiosk\.js/,
      ),
    ]);
  });

  it("finds a route under both root layouts", () => {
    const both = {
      ...playerHome,
      entryJSFiles: {
        ...playerHome.entryJSFiles,
        ...terminalPage.entryJSFiles,
      },
    };
    expect(hostSplitViolations([both, terminalPage])).toContainEqual(
      expect.stringMatching(/loads both root layouts/),
    );
  });

  it("fails when there is nothing to check", () => {
    expect(hostSplitViolations([playerHome])).toContainEqual(
      expect.stringMatching(/no route under \(terminal\)/),
    );
    expect(hostSplitViolations([terminalPage])).toContainEqual(
      expect.stringMatching(/no route under \(player\)/),
    );
    const noProviders = {
      ...playerHome,
      clientModules: { ...framework },
    };
    expect(hostSplitViolations([noProviders, terminalPage])).toContainEqual(
      expect.stringMatching(/no client module of the player's layout/),
    );
  });
});
