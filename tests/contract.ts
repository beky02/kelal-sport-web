/**
 * The contract's own response examples, read from `contracts/openapi.yaml`.
 *
 * Prism serves these same examples in development, so a test built on them
 * checks exactly what the screens show against the mock — and fails the day
 * the contract changes shape under a mapper.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { paths } from "@/lib/api/schema";

// Vitest runs from the project root; jsdom rewrites `import.meta.url`.
const spec = parse(
  readFileSync(resolve(process.cwd(), "contracts/openapi.yaml"), "utf8"),
) as {
  paths: Record<
    string,
    Record<
      string,
      {
        responses: Record<
          string,
          { content?: Record<string, { example?: unknown }> }
        >;
      }
    >
  >;
};

type Path = keyof paths;

/** The `200` example of `GET path`, typed as the contract says it is. */
export function example<P extends Path>(
  path: P,
): paths[P] extends {
  get: {
    responses: { 200: { content: { "application/json": infer T } } };
  };
}
  ? T
  : never {
  const response = spec.paths[path]?.get?.responses?.["200"];
  const value = response?.content?.["application/json"]?.example;
  if (value === undefined) throw new Error(`No 200 example for GET ${path}`);
  // A fresh copy each time, so a test can change one without touching another.
  return structuredClone(value) as never;
}
