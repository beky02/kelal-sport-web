// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

/** FD4: money and odds are never parsed into floats outside `lib/money.ts`. */
describe("money lint rule", () => {
  it("flags parseFloat(stake), Number(odds) and +stake outside lib/money", async () => {
    const eslint = new ESLint({ cwd: process.cwd(), ignore: false });
    const [result] = await eslint.lintFiles([
      "tests/lint/fixtures/parse-stake.ts",
    ]);
    const lines = result.messages
      .filter((m) => m.ruleId === "no-restricted-syntax")
      .map((m) => m.line);
    expect(lines).toEqual([5, 6, 7]);
  }, 30_000);
});
