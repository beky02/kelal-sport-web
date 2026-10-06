"use client";

import { createContext, useContext } from "react";
import type { CalendarSystem, ClockConvention, Lang } from "@/types/common";

/**
 * What a screen's words, times and dates are shown in: the language, the
 * clock and the calendar (D7).
 */
export interface Locale {
  lang: Lang;
  clock: ClockConvention;
  calendar: CalendarSystem;
}

/** Release 1's defaults (D7): Gregorian dates, 24-hour East Africa Time. */
export const DEFAULT_LOCALE: Locale = {
  lang: "en",
  clock: "eat",
  calendar: "gregorian",
};

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/**
 * Where the shared text hooks (`useTranslation`, `useRichTranslation`,
 * `useDateTimeText`, `useLongDateTimeText`) read the locale. Each site feeds
 * it from its own state: the player's from its stored preferences
 * (`(player)/locale.tsx`), the shop terminal's from the kiosk's language
 * (F8ca). So the hooks, and every component built on them, belong to neither
 * site, and the terminal can use them without loading the player's store
 * (FD1). The value must be memoised: every text on screen re-renders when it
 * changes.
 */
export const LocaleProvider = LocaleContext.Provider;

/** The nearest provider's locale; without one, `DEFAULT_LOCALE`. */
export const useLocale = (): Locale => useContext(LocaleContext);
