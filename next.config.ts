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
  experimental: {
    // The proxy runs on every route handler (F8a), and Next holds each request
    // body in memory for it — 10 MB by default. Above the largest body a
    // handler accepts (16 KiB, bets and bookings), so none is cut. A bigger one
    // with a Content-Length is still a 413; a chunked one reaches the handler
    // cut and is refused as not JSON (09-security, known limits).
    proxyClientMaxBodySize: "32kb",
  },
  async headers() {
    return [{ source: "/:path*", headers: noFraming }];
  },
};

export default nextConfig;
