import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * FD4: money and odds are decimal strings; they are never parsed into floats.
 * Arithmetic on them is slipcalc's (D1) or `lib/money.ts`'s, and only the
 * display formatters turn them into numbers.
 */
const MONEY_NAME =
  "/stake|odds|amount|payout|balance|price|tax|bonus|gross|santim/i";
const moneyMessage =
  "Money and odds are decimal strings (FD4): use lib/money.ts or slipcalc, and format with t.money / t.odds.";

const noFloatMoney = {
  files: ["**/*.{ts,tsx,mts}"],
  ignores: [
    "src/lib/money.ts",
    "src/lib/i18n/format.ts",
    "contracts/golden/**",
  ],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.name='parseFloat']",
        message: moneyMessage,
      },
      ...[
        `CallExpression[callee.name='Number'] > Identifier.arguments[name=${MONEY_NAME}]`,
        `CallExpression[callee.name='Number'] > MemberExpression.arguments[property.name=${MONEY_NAME}]`,
        `UnaryExpression[operator='+'] > Identifier.argument[name=${MONEY_NAME}]`,
        `UnaryExpression[operator='+'] > MemberExpression.argument[property.name=${MONEY_NAME}]`,
      ].map((selector) => ({ selector, message: moneyMessage })),
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noFloatMoney,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deliberately broken: `tests/unit/money-lint.test.ts` lints it on purpose.
    "tests/lint/fixtures/**",
  ]),
]);

export default eslintConfig;
