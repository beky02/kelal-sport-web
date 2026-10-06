// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import nextConfig from "../../next.config";

vi.mock("server-only", () => ({}));

// Outside production with no TERMINAL_HOST_MAP, terminal.localhost is the
// terminal (lib/server/config.ts); every other host is the player site.
const { config, proxy } = await import("@/proxy");

const PLAYER = "localhost:3000";
const TERMINAL = "terminal.localhost:3000";

const visit = (
  path: string,
  cookie?: string,
  host = PLAYER,
  extra: Record<string, string> = {},
) =>
  proxy(
    new NextRequest(`http://${host}${path}`, {
      headers: { host, ...(cookie ? { cookie } : {}), ...extra },
    }),
  );

const onTerminal = (path: string, extra?: Record<string, string>) =>
  visit(path, undefined, TERMINAL, extra);

/** Where a rewrite sends the request, if it does. */
const rewrittenTo = (response: Response) =>
  response.headers.get("x-middleware-rewrite");

/** Answered as a route that doesn't exist: Next's own 404 page. */
const expectNotFound = (response: Response, host: string, label: string) => {
  expect(response.status, label).toBe(404);
  expect(rewrittenTo(response), label).toBe(`http://${host}/_not-found`);
  expect(response.headers.get("location"), label).toBeNull();
};

/** Passed on untouched. */
const expectThrough = (response: Response, label: string) => {
  expect(response.status, label).toBe(200);
  expect(rewrittenTo(response), label).toBeNull();
  expect(response.headers.get("location"), label).toBeNull();
};

describe("the proxy (C18 §4.4: it only redirects; handlers re-check)", () => {
  it("redirects a visitor without a session cookie from /wallet to /login?next=%2Fwallet", () => {
    const response = visit("/wallet");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fwallet",
    );
  });

  it("keeps the page and its query in next", () => {
    expect(visit("/my-bets/b1?tab=open").headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fmy-bets%2Fb1%3Ftab%3Dopen",
    );
    expect(visit("/transactions").headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Ftransactions",
    );
  });

  it("lets a visitor with a session cookie through, without reading it", () => {
    const response = visit("/wallet", `${SESSION_COOKIE}=whatever-is-sealed`);
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("leaves pages with a guest view alone", () => {
    for (const path of ["/", "/profile", "/responsible-gaming", "/login"]) {
      expectThrough(visit(path), path);
    }
  });

  it("guards the account pages it always guarded and no more, now it runs everywhere", () => {
    // /wallet and /transactions themselves; My bets with its tickets.
    for (const path of [
      "/wallet",
      "/transactions",
      "/my-bets",
      "/my-bets/b1",
    ]) {
      expect(visit(path).status, path).toBe(307);
    }
    // No page lives below /wallet or /transactions: Next's 404, not a login.
    for (const path of ["/wallet/x", "/transactions/x", "/wallets"]) {
      expectThrough(visit(path), path);
    }
  });
});

describe("the proxy on /t/{ticket} (AC-9, C18 §9)", () => {
  it.each([
    "/t/K7Q2-M9XP-X", // the check character is wrong
    "/t/K7Q2-M9XP", // too short
    "/t/CALL%200911000000%20TO%20CLAIM", // not a number at all
    "/t/%E0%A4%A", // a malformed escape
  ])(
    "answers %s, no ticket number, with a 404 the server renders in full",
    (path) => {
      const response = visit(path);
      expect(response.status).toBe(404);
      expect(rewrittenTo(response)).toBe("http://localhost:3000/t?missing=1");
      // Nothing from the address goes on to the page.
      expect(rewrittenTo(response)).not.toContain("0911000000");
    },
  );

  it.each([
    "/t/K7Q2-M9XP-M", // canonical
    "/t/k7q2m9xpm", // the page redirects it to the canonical address
    "/t/k7q2%20m9xp%20m",
  ])("lets %s, a ticket number, through to the page", (path) => {
    expectThrough(visit(path), path);
  });

  it("asks for no session on the public ticket check", () => {
    expect(visit("/t/K7Q2-M9XP-X").headers.get("location")).toBeNull();
  });

  it("looks only at /t/{one segment}, as before it ran everywhere", () => {
    // No page lives at /t/a/b: Next's 404, not the ticket's.
    expectThrough(visit("/t/K7Q2-M9XP-M/x"), "/t/K7Q2-M9XP-M/x");
  });
});

describe("the host split (F8a AC-3, FD1)", () => {
  it("answers /terminal and /api/terminal/x with a 404 on a player host", () => {
    for (const path of [
      "/terminal",
      "/terminal/",
      "/terminal/activate?code=1",
      "/api/terminal",
      "/api/terminal/x",
    ]) {
      expectNotFound(visit(path), PLAYER, path);
    }
    // A signed-in player is no exception.
    expectNotFound(
      visit("/terminal", `${SESSION_COOKIE}=whatever-is-sealed`),
      PLAYER,
      "with a cookie",
    );
  });

  it("shows /terminal at / on a terminal host, keeping the query", () => {
    const response = onTerminal("/?shop=ADM-008");
    expect(response.status).toBe(200);
    expect(rewrittenTo(response)).toBe(
      `http://${TERMINAL}/terminal?shop=ADM-008`,
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("answers /profile, /login, /wallet and /api/me with a 404 on a terminal host", () => {
    for (const path of [
      "/profile",
      "/login",
      "/wallet", // a 404, not the guest's redirect to /login
      "/api/me",
      "/my-bets/b1",
      "/t/K7Q2-M9XP-M",
      "/b/KX7P2Q",
      "/event/e1",
      "/api/auth/login",
      "/no-such-page",
    ]) {
      expectNotFound(onTerminal(path), TERMINAL, path);
    }
  });

  it("serves /terminal/* and /api/terminal/* on a terminal host", () => {
    for (const path of [
      "/terminal",
      "/terminal/code?x=1",
      "/api/terminal",
      "/api/terminal/activate",
    ]) {
      expectThrough(onTerminal(path), path);
    }
  });

  it("refuses the other site's paths in any spelling", () => {
    // Percent-encoded spellings of a terminal path are terminal paths.
    for (const path of ["/%74erminal", "/api/%74erminal/x", "/terminal%2Fx"]) {
      expectNotFound(visit(path), PLAYER, path);
    }
    // A terminal host passes only plain terminal paths.
    for (const path of [
      "/terminals", // another path, not under /terminal
      "/terminal-x",
      "/api/terminals",
      "/terminal/%2e%2e/wallet", // the URL parser makes this /wallet
      "/terminal/x%2F..%2F..%2Fwallet", // dot segments behind escaped slashes
      "/api/terminal/%E0%A4%A", // a malformed escape
      "/%74erminal", // the terminal, misspelled
    ]) {
      expectNotFound(onTerminal(path), TERMINAL, path);
    }
    // Single dots the URL parser removes leave a plain terminal path.
    expectThrough(onTerminal("/terminal/x/%2E/y"), "/terminal/x/%2E/y");
    // On a player host, a path that only looks like one is the player's.
    expectThrough(visit("/terminals"), "/terminals");
  });

  it("reads the host as tenants are read: a forwarded host counts only behind a trusted proxy", () => {
    // No TRUSTED_PROXY_HOPS: a client's X-Forwarded-Host picks no site.
    const forged = visit("/terminal", undefined, PLAYER, {
      "x-forwarded-host": TERMINAL,
    });
    expectNotFound(forged, PLAYER, "forged forwarded host");
    expectNotFound(
      onTerminal("/wallet", { "x-forwarded-host": PLAYER }),
      TERMINAL,
      "forged forwarded player host",
    );
  });
});

/** Every page and route handler under src/app, as a URL with sample params. */
function appRoutes(dir = join(process.cwd(), "src/app")): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return appRoutes(path);
    if (!/^(page|route)\.tsx?$/.test(name)) return [];
    const segments = relative(join(process.cwd(), "src/app"), path)
      .split(sep)
      .slice(0, -1)
      .filter((segment) => !/^\(.+\)$/.test(segment)) // route groups
      .map((segment) => (segment.startsWith("[") ? "x1" : segment));
    return [`/${segments.join("/")}`];
  });
}

/** Every file in public/, as the path it is served at. */
function publicFiles(dir = join(process.cwd(), "public")): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? publicFiles(path)
      : [
          `/${relative(join(process.cwd(), "public"), path).split(sep).join("/")}`,
        ];
  });
}

const runsOn = (url: string) =>
  unstable_doesMiddlewareMatch({ config, nextConfig, url });

describe("where the proxy runs (F8a: every page and route handler)", () => {
  it("runs on every page and route handler and on no public file", () => {
    const routes = appRoutes();
    expect(routes).toContain("/");
    expect(routes).toContain("/terminal");
    expect(routes).toContain("/api/me");
    for (const url of routes) expect(runsOn(url), url).toBe(true);

    const files = publicFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const url of files) expect(runsOn(url), url).toBe(false);
  });

  it("skips Next's own files, and decides by path, never by extension", () => {
    for (const url of [
      "/_next/static/chunks/main.js",
      "/_next/image?url=%2Fflags%2Fde.svg&w=64&q=75",
      "/_next/webpack-hmr",
      "/favicon.ico",
    ]) {
      expect(runsOn(url), url).toBe(false);
    }
    // A route whose last segment looks like a file is still a route.
    for (const url of ["/event/x.png", "/my-bets/b1.js", "/favicon.ico.html"]) {
      expect(runsOn(url), url).toBe(true);
    }
  });
});

/** `"32kb"` → 32768. */
function bytes(size: string | number | undefined): number {
  if (typeof size === "number") return size;
  const match = /^(\d+)(b|kb|mb)$/i.exec(size ?? "");
  if (!match) return Number.POSITIVE_INFINITY;
  const unit = { b: 1, kb: 1024, mb: 1024 * 1024 }[
    match[2].toLowerCase() as "b" | "kb" | "mb"
  ];
  return Number(match[1]) * unit;
}

/** The body caps the route handlers declare (`MAX_BODY_BYTES = n * 1024`). */
function handlerCaps(dir = join(process.cwd(), "src")): number[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return handlerCaps(path);
    if (!/\.tsx?$/.test(name)) return [];
    return [
      ...readFileSync(path, "utf8").matchAll(
        /MAX_(?:BODY_)?BYTES = (\d+) \* 1024/g,
      ),
    ].map((match) => Number(match[1]) * 1024);
  });
}

describe("the request body the proxy holds (F8a decision 9)", () => {
  it("buffers no more of a body for the proxy than the largest handler accepts, with room", () => {
    const caps = handlerCaps();
    expect(caps.length).toBeGreaterThan(0);
    const limit = bytes(nextConfig.experimental?.proxyClientMaxBodySize);
    // Never cut a body a handler accepts…
    expect(limit).toBeGreaterThan(Math.max(...caps));
    // …and never hold megabytes for one that will be refused.
    expect(limit).toBeLessThanOrEqual(64 * 1024);
  });
});
