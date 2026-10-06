import type { NextConfig } from "next";

/**
 * No page may be shown in a frame, by another site or by this one (C18 §7,
 * F3b SEC6): a page on top could steer a signed-in player's clicks, and since
 * F7a a few clicks on /responsible-gaming start a permanent self-exclusion.
 * Current browsers obey `frame-ancestors`; `X-Frame-Options` is for the
 * WebViews that predate it. The full policy with nonces, still to come in
 * SEC6, must keep `frame-ancestors 'none'`.
 */
const noFraming = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  images: {
    // Nothing uses next/image (flags are plain SVGs), and /_next/image skips
    // the proxy: with no local pattern the optimiser fetches no app path for
    // anyone, on either host (F8a security review).
    localPatterns: [],
  },
  experimental: {
    // The proxy runs on every route handler (F8a), and Next reads each request
    // body for it before the handler runs, keeping up to this much in memory —
    // 10 MB by default. Above the largest body a handler accepts (BODY_CAPS in
    // lib/server/body.ts: 16 KiB, bets and bookings), so none is cut. A bigger one is still refused (413 with a
    // Content-Length; a chunked one arrives cut and fails as not JSON), but only
    // once it has all arrived: the edge must cap bodies (09-security).
    proxyClientMaxBodySize: "32kb",
  },
  async headers() {
    return [{ source: "/:path*", headers: noFraming }];
  },
};

export default nextConfig;
