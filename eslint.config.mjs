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

/**
 * A money-named value as an expression: `stake`, `bet.stake`, `bet?.stake`,
 * `bet["stake"]`, `stake as string`, `stake!` or a template wrapping one.
 */
const moneyValue = [
  `Identifier[name=${MONEY_NAME}]`,
  `MemberExpression[property.name=${MONEY_NAME}]`,
  `MemberExpression[property.value=${MONEY_NAME}]`,
];
const wrapped = (inner) => [
  ...inner,
  ...inner.map((v) => `ChainExpression:has(> ${v})`),
  ...inner.map((v) => `TSAsExpression:has(> ${v})`),
  ...inner.map((v) => `TSNonNullExpression:has(> ${v})`),
  ...inner.map((v) => `TemplateLiteral:has(> ${v})`),
];
const moneySelectors = wrapped(moneyValue).flatMap((value) => [
  `CallExpression[callee.name=/^(Number|parseInt)$/] > ${value}.arguments`,
  `UnaryExpression[operator='+'] > ${value}.argument`,
]);

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
      ...moneySelectors.map((selector) => ({
        selector,
        message: moneyMessage,
      })),
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
