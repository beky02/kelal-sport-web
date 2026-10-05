// @vitest-environment node
import { describe, expect, it } from "vitest";
import { modifyRouteRegex } from "next/dist/lib/redirect-status";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { routes } from "@/config/routes";
import nextConfig from "../../next.config";

/**
 * The headers `next.config.ts` puts on a response to `path`, matched the way
 * the server matches them (`buildCustomRoute` in Next's
 * `server/lib/router-utils/filesystem.js`): every rule whose source matches,
 * in order, a later value for a key replacing an earlier one. A rule with
 * `has` or `missing` may not apply to a request, so a header it sets counts
 * as unknown.
 */
async function headersFor(path: string) {
  const sent = new Map<string, string | undefined>();
  for (const rule of (await nextConfig.headers?.()) ?? []) {
    const matches = getPathMatch(rule.source, {
      strict: true,
      removeUnnamedParams: true,
      regexModifier: (regex) => modifyRouteRegex(regex),
    });
    if (!matches(path)) continue;
    const always = !rule.has && !rule.missing;
    for (const { key, value } of rule.headers) {
      sent.set(key.toLowerCase(), always ? value : undefined);
    }
  }
  return sent;
}

const directives = (policy = "") =>
  policy.split(";").map((directive) => directive.trim());

describe("framing (C18 §7, F3b SEC6)", () => {
  it.each([
    routes.home,
    routes.responsibleGaming,
    routes.wallet,
    routes.bet("b1"),
    routes.ticket("K7Q2-M9XP-M"),
    routes.booking("KX7P2Q"),
    "/api/me/self-exclusion",
    "/no-such-page",
  ])("forbids every site, this one included, to frame %s", async (path) => {
    const sent = await headersFor(path);
    expect(directives(sent.get("content-security-policy"))).toContain(
      "frame-ancestors 'none'",
    );
    expect(sent.get("x-frame-options")).toBe("DENY");
  });
});
