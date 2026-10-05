import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page } from "@playwright/test";

/**
 * Framing, against the dev server (C18 §7, F3b SEC6). A permanent
 * self-exclusion is a few clicks on /responsible-gaming (F7a), so no page may
 * show it in a frame where a page on top could steer those clicks:
 * `frame-ancestors 'none'` for current browsers, `X-Frame-Options: DENY` for
 * the WebViews that predate it.
 */

test("answers a page, a route handler, the proxy's redirect and a 404 with frame-ancestors 'none' and X-Frame-Options: DENY", async ({
  request,
}) => {
  for (const path of [
    "/",
    "/responsible-gaming",
    "/api/me",
    "/wallet",
    "/no-such-page",
  ]) {
    const headers = (await request.get(path, { maxRedirects: 0 })).headers();
    expect(headers["content-security-policy"], path).toBe(
      "frame-ancestors 'none'",
    );
    expect(headers["x-frame-options"], path).toBe("DENY");
  }
});

const framing = (target: string) => `<iframe src="${target}"></iframe>`;

/**
 * Opens `parent`, a page that frames `target`: the server answers the frame,
 * and Chrome refuses to show the answer because of its headers.
 */
async function expectFrameRefused(page: Page, parent: string, target: string) {
  const answered = page.waitForResponse(
    (response) => response.url() === target,
  );
  const refused = page.waitForEvent("requestfailed", {
    predicate: (request) => request.url() === target,
    timeout: 10_000,
  });
  await page.goto(parent);
  expect((await answered).status()).toBe(200);
  expect((await refused).failure()?.errorText).toBe(
    "net::ERR_BLOCKED_BY_RESPONSE",
  );
}

test("a page on another site cannot show /responsible-gaming in a frame", async ({
  page,
  baseURL,
}) => {
  const target = new URL("/responsible-gaming", baseURL).href;
  // A real server on 127.0.0.1, another site than localhost. A page Playwright
  // fulfils would not do: Chrome's Local Network Access stops it framing
  // localhost whatever the headers, so the test would pass without them.
  const attacker = createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end(framing(target));
  });
  await new Promise<void>((resolve) =>
    attacker.listen(0, "127.0.0.1", resolve),
  );
  try {
    const { port } = attacker.address() as AddressInfo;
    await expectFrameRefused(page, `http://127.0.0.1:${port}/`, target);
  } finally {
    attacker.close();
    attacker.closeAllConnections();
  }
});

test("a page on this site cannot show /responsible-gaming in a frame either", async ({
  page,
  baseURL,
}) => {
  const target = new URL("/responsible-gaming", baseURL).href;
  const parent = new URL("/framing", baseURL).href;
  await page.route(parent, (route) =>
    route.fulfill({ contentType: "text/html", body: framing(target) }),
  );
  await expectFrameRefused(page, parent, target);
});
