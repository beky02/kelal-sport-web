"use client";

import { useMemo } from "react";
import { useUiStore } from "@/stores/ui.store";
import { pickLocale, type Lang, type Localized } from "@/types/common";
import { formatMoney, formatNumber, formatOdds, formatPercent } from "./format";
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
 * Language lives in the UI store, so this is a thin memo over it rather than a
 * second context — one source of truth for which script is on screen.
 */
export function useTranslation(): Translator {
  const lang = useUiStore((s) => s.lang);

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
