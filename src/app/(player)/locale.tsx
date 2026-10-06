"use client";

import { useLayoutEffect, useMemo } from "react";
import { LocaleProvider } from "@/lib/i18n/locale";
import { useUiStore } from "@/stores/ui.store";

/**
 * The player's locale: the language, clock and calendar they chose, from the
 * preferences store, for every text hook below (`lib/i18n/locale.tsx`). Only
 * the player's site mounts it; the shop terminal has its own (F8ca). It keeps
 * `<html lang>` in step too — the CSS tokens and the API client's
 * `Accept-Language` read it — before any request below it is made.
 */
export function PlayerLocale({ children }: { children: React.ReactNode }) {
  const lang = useUiStore((s) => s.lang);
  const clock = useUiStore((s) => s.clock);
  const calendar = useUiStore((s) => s.calendar);
  useLayoutEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const locale = useMemo(
    () => ({ lang, clock, calendar }),
    [lang, clock, calendar],
  );
  return <LocaleProvider value={locale}>{children}</LocaleProvider>;
}
