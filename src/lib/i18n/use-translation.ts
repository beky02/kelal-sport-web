"use client";

import { useMemo } from "react";
import { pickLocale, type Lang, type Localized } from "@/types/common";
import { formatMoney, formatNumber, formatOdds, formatPercent } from "./format";
import { useLocale } from "./locale";
import { translate, type Interpolations, type MessageKey } from ".";

export interface Translator {
  lang: Lang;
  /** A message from the catalogue, with `{placeholders}` filled. */
  t: (key: MessageKey, values?: Interpolations) => string;
  /** A `Localized` value that came from the API. */
  pick: (value: Localized) => string;
  /**
   * A decimal-string amount (or a number, where a screen is not on the
   * contract yet: responsible gaming, until F7).
   */
  money: (amount: string | number) => string;
  number: (value: string | number) => string;
  odds: (value: string | number) => string;
  percent: (rate: string | number) => string;
}

/**
 * The one way components read text.
 *
 * The language is the nearest `LocaleProvider`'s, which each site feeds from
 * its own state (the player's stored preference, the kiosk's choice), so this
 * is a thin memo over it — one source of truth for which script is on screen.
 */
export function useTranslation(): Translator {
  const { lang } = useLocale();

  return useMemo(
    () => ({
      lang,
      t: (key, values) => translate(lang, key, values),
      pick: (value) => pickLocale(value, lang),
      money: (amount) => formatMoney(amount, lang),
      number: formatNumber,
      odds: formatOdds,
      percent: formatPercent,
    }),
    [lang],
  );
}
