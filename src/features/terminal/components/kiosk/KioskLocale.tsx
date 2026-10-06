"use client";

import { useLayoutEffect, useMemo } from "react";
import { LocaleProvider, type Locale } from "@/lib/i18n/locale";
import { useKioskStore } from "../../stores/kiosk.store";
import type { TerminalConfigView } from "../../types";

/** What `<html lang>` says when no kiosk is on screen: the layout's own. */
const LAYOUT_LANG = "am";

/**
 * The kiosk's locale (F8ca): the customer's language — chosen, else the
 * tenant's default — with Release 1's Gregorian dates and East Africa Time
 * (D7), for every text hook below. `<html lang>` follows, so the Amharic
 * tokens (line height, no uppercasing) switch with it.
 *
 * The tenant's default goes into the kiosk store in a layout effect, before
 * the reads below it start (in passive effects), so their `Accept-Language`
 * is the kiosk's from the first one.
 */
export function KioskLocale({
  config,
  children,
}: {
  config: TerminalConfigView | null;
  children: React.ReactNode;
}) {
  const chosen = useKioskStore((s) => s.chosen);
  const fallback = useKioskStore((s) => s.fallback);
  const setFallback = useKioskStore((s) => s.setFallback);

  const defaultLanguage = config?.defaultLanguage ?? fallback;
  // A choice the tenant no longer offers gives way to its default.
  const lang =
    chosen && (config?.languages.includes(chosen) ?? true)
      ? chosen
      : defaultLanguage;

  useLayoutEffect(() => {
    if (config) setFallback(config.defaultLanguage);
  }, [config, setFallback]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    return () => {
      root.lang = LAYOUT_LANG;
    };
  }, [lang]);

  const locale = useMemo<Locale>(
    () => ({ lang, clock: "eat", calendar: "gregorian" }),
    [lang],
  );
  return <LocaleProvider value={locale}>{children}</LocaleProvider>;
}
