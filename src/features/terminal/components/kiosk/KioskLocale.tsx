"use client";

import { useLayoutEffect, useMemo } from "react";
import { LocaleProvider, type Locale } from "@/lib/i18n/locale";
import { kioskLanguage, useKioskStore } from "../../stores/kiosk.store";
import type { TerminalConfigView } from "../../types";

/**
 * The kiosk's locale (F8ca): its language (`kioskLanguage`: the customer's
 * choice while offered, else English, else the tenant's default) with
 * Release 1's Gregorian dates and East Africa Time (D7), for every text hook
 * below — and for the kiosk's reads, which ask in it (`useLocale().lang`).
 * `<html lang>` follows, so the Amharic tokens (line height, no uppercasing)
 * switch with it, and goes back to what it was when the kiosk leaves the
 * screen.
 */
export function KioskLocale({
  config,
  children,
}: {
  config: TerminalConfigView | null;
  children: React.ReactNode;
}) {
  const chosen = useKioskStore((s) => s.chosen);
  const lang = kioskLanguage(chosen, config);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const before = root.lang;
    root.lang = lang;
    return () => {
      root.lang = before;
    };
  }, [lang]);

  const locale = useMemo<Locale>(
    () => ({ lang, clock: "eat", calendar: "gregorian" }),
    [lang],
  );
  return <LocaleProvider value={locale}>{children}</LocaleProvider>;
}
