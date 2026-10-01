import en from "./messages/en.json";
import am from "./messages/am.json";
import type { Lang } from "@/types/common";

export const catalogues = { en, am } as const;

export const LANGS: readonly Lang[] = ["en", "am"];

/** Short label for the language switch. */
export const LANG_LABEL: Record<Lang, string> = { en: "EN", am: "አማ" };

type Catalogue = typeof en;

/** Dot-separated paths into the message tree, e.g. `betSlip.alerts.deposit`. */
export type MessageKey = Paths<Catalogue>;

type Paths<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
    }[keyof T & string];

export type Interpolations = Record<string, string | number>;

function lookup(catalogue: unknown, key: string): string | undefined {
  let node: unknown = catalogue;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Resolves a message and fills `{placeholders}`.
 *
 * Falls back to English rather than rendering a key, then to the key itself so a
 * missing string is visible in development instead of an empty element.
 */
export function translate(
  lang: Lang,
  key: MessageKey,
  values?: Interpolations,
): string {
  const template = lookup(catalogues[lang], key) ?? lookup(en, key) ?? key;
  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
