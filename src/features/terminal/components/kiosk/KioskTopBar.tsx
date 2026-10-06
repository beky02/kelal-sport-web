"use client";

import { Languages, Store } from "lucide-react";
import { LANG_NAME } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/locale";
import type { Lang } from "@/types/common";
import { useKioskStore } from "../../stores/kiosk.store";
import type { TerminalInfo } from "../../types";

/**
 * The shop's bar on the kiosk (F8ca): the shop, this PC's label, and the
 * language switch — one tap, labelled with the other language's own name so
 * a reader of either script can find it (06-language).
 */
export function KioskTopBar({
  terminal,
  languages,
}: {
  terminal: TerminalInfo;
  languages: readonly Lang[];
}) {
  const { lang } = useLocale();
  const choose = useKioskStore((s) => s.choose);
  const others = languages.filter((other) => other !== lang);

  return (
    <header className="bg-surface border-divider flex min-h-16 items-center gap-3 border-b px-4">
      <Store className="text-accent size-6 shrink-0" aria-hidden />
      <span className="min-w-0 truncate text-lg font-bold">
        {terminal.shop.name}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {terminal.label && (
          <span className="text-muted hidden text-sm sm:inline">
            {terminal.label}
          </span>
        )}
        {others.map((other) => (
          <button
            key={other}
            type="button"
            lang={other}
            onClick={() => choose(other)}
            className="bg-raised border-divider text-text flex min-h-12 cursor-pointer items-center gap-2 rounded-md border px-4 text-base font-bold hover:brightness-125"
          >
            <Languages className="size-5" aria-hidden />
            {LANG_NAME[other]}
          </button>
        ))}
      </div>
    </header>
  );
}
