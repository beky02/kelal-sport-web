// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { config, proxy } from "@/proxy";

const visit = (path: string, cookie?: string) =>
  proxy(
    new NextRequest(`http://localhost:3000${path}`, {
      headers: cookie ? { cookie } : {},
    }),
  );

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
      expect(visit(path).headers.get("location"), path).toBeNull();
    }
  });

  it("guards exactly the account pages, and looks at ticket addresses", () => {
    expect(config.matcher).toEqual([
      "/my-bets/:path*",
      "/wallet",
      "/transactions",
      "/t/:ticket",
    ]);
  });
});

describe("the proxy on /t/{ticket} (AC-9, C18 §9)", () => {
  /** Where a rewrite sends the request, if it does. */
  const rewrittenTo = (response: Response) =>
    response.headers.get("x-middleware-rewrite");

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
    const response = visit(path);
    expect(response.status).toBe(200);
    expect(rewrittenTo(response)).toBeNull();
    expect(response.headers.get("location")).toBeNull();
  });

  it("asks for no session on the public ticket check", () => {
    expect(visit("/t/K7Q2-M9XP-X").headers.get("location")).toBeNull();
  });
});
