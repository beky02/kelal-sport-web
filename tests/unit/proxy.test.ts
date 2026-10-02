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

  it("guards exactly the account pages", () => {
    expect(config.matcher).toEqual([
      "/my-bets/:path*",
      "/wallet",
      "/transactions",
    ]);
  });
});
