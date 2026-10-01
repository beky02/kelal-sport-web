/** The two languages the product ships in. */
export type Lang = "en" | "am";

/** Every user-facing string from the API carries both scripts. */
export type Localized = Record<Lang, string>;

export type Theme = "dark" | "light";

/**
 * Clock convention. Ethiopia runs a 12-hour clock that starts at 06:00 EAT,
 * so 19:30 EAT reads as "1:30 evening". Users choose; both are shown labelled.
 */
export type ClockConvention = "eat" | "eth";

/** How a team is badged. `none` is the data-saver path — no images at all. */
export type Crest =
  | { kind: "flag"; src: string }
  | {
      kind: "initials";
      initials: string;
      background: string;
      foreground: string;
    }
  | { kind: "none" };

export const pickLocale = (value: Localized, lang: Lang): string =>
  value[lang] || value.en;
