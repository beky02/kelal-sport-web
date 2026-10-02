/**
 * Runs once when a server starts (Next.js instrumentation hook).
 *
 * A production server with no `SESSION_SECRET` must not come up at all: the
 * first login would otherwise fail, or worse, seal tokens with a key it should
 * never have. Build time never reaches this — `next build` must not need
 * runtime secrets — so the check lives here rather than at import.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertServerSecrets } = await import("./lib/server/config");
    assertServerSecrets();
  }
}
