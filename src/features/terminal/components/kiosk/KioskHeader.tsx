"use client";

import { Segmented } from "@/components/ui/Segmented";
import { HeaderSearch } from "@/features/search/components/HeaderSearch";
import { LANG_LABEL, LANGS } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/locale";
import type { Lang } from "@/types/common";
import { useTerminalConfig } from "../../hooks/use-kiosk";
import { useKioskStore } from "../../stores/kiosk.store";
import { TerminalBar } from "../TerminalBar";

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
    <TerminalBar>
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
    </TerminalBar>
  );
}
