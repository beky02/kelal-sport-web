"use client";

import { BrandMark } from "@/components/layout/BrandMark";
import { Segmented } from "@/components/ui/Segmented";
import { HeaderSearch } from "@/features/search/components/HeaderSearch";
import { LANG_LABEL, LANGS } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/locale";
import type { Lang } from "@/types/common";
import { useTerminalConfig } from "../../hooks/use-kiosk";
import { useKioskStore } from "../../stores/kiosk.store";

/**
 * The kiosk's bar (F8ca): the player's application bar's frame with the brand
 * and whatever acts on its right. No shop or PC details are shown.
 */
export function KioskBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="bg-surface border-divider sticky top-0 z-30 flex h-[52px] items-center gap-2 px-3 md:h-14 md:gap-3.5 md:border-b md:px-5">
      <BrandMark href="/terminal" />
      <span className="flex-1" />
      {children}
    </header>
  );
}

/**
 * The kiosk's application bar: the player's — brand, search, the language
 * switch — without what needs a player (Log in, Register, My bets, Wallet,
 * Responsible gaming) or terminal identifying information.
 */
export function KioskHeader() {
  const { lang } = useLocale();
  const choose = useKioskStore((s) => s.choose);
  const offered = useTerminalConfig().data?.languages ?? [];
  // The player's order (EN, then አማ), whatever order the config lists them
  // in (review U2).
  const options = LANGS.filter((value) => offered.includes(value)).map(
    (value) => ({ value, label: LANG_LABEL[value] }),
  );

  return (
    <KioskBar>
      <HeaderSearch />
      {/* The tenant's own languages; with one, nothing to switch. */}
      {options.length > 1 && (
        <Segmented<Lang>
          value={lang}
          onChange={choose}
          size="sm"
          options={options}
        />
      )}
    </KioskBar>
  );
}
