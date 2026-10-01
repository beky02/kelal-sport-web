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

interface Media {
  example?: unknown;
  examples?: Record<string, { value: unknown }>;
}

interface Response {
  $ref?: string;
  content?: Record<string, Media>;
}

interface Operation {
  requestBody?: { content?: Record<string, Media> };
  responses: Record<string, Response>;
}

// Vitest runs from the project root; jsdom rewrites `import.meta.url`.
const spec = parse(
  readFileSync(resolve(process.cwd(), "contracts/openapi.yaml"), "utf8"),
) as {
  paths: Record<string, Record<string, Operation>>;
  components: { responses: Record<string, Response> };
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

function exampleIn(media: Media | undefined, name?: string): unknown {
  if (!media) return undefined;
  if (name) return media.examples?.[name]?.value;
  return media.example ?? Object.values(media.examples ?? {})[0]?.value;
}

/**
 * Any response example of an operation, following `components/responses` refs:
 * `responseExample("/v1/bookings/{code}", "get", 410)` is the `Gone` Problem.
 * `name` picks one of several named examples.
 */
export function responseExample(
  path: Path,
  method: "get" | "post" | "put" | "patch" | "delete",
  status: number,
  name?: string,
): unknown {
  let response = spec.paths[path]?.[method]?.responses?.[String(status)];
  if (response?.$ref) {
    response = spec.components.responses[response.$ref.split("/").pop()!];
  }
  const media =
    response?.content?.["application/json"] ??
    response?.content?.["application/problem+json"];
  const value = exampleIn(media, name);
  if (value === undefined) {
    throw new Error(`No ${status} example for ${method.toUpperCase()} ${path}`);
  }
  return structuredClone(value);
}

/** The request body example of an operation. */
export function requestExample(
  path: Path,
  method: "post" | "put" | "patch",
): unknown {
  const value = exampleIn(
    spec.paths[path]?.[method]?.requestBody?.content?.["application/json"],
  );
  if (value === undefined) {
    throw new Error(`No request example for ${method.toUpperCase()} ${path}`);
  }
  return structuredClone(value);
}
