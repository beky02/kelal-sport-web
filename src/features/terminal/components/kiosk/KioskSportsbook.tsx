"use client";

import { useId, useState } from "react";
import { Ticket } from "lucide-react";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import type { Lang } from "@/types/common";
import type { TerminalInfo } from "../../types";
import { KioskBoard } from "./KioskBoard";
import { KioskDayStrip } from "./KioskDayStrip";
import { KioskSlip } from "./KioskSlip";
import { KioskSportTabs } from "./KioskSportTabs";
import { KioskTopBar } from "./KioskTopBar";

/**
 * The kiosk's sportsbook (F8ca): the shop's bar on top; the sports, the days
 * and the board; and the slip beside it from `lg` up. Narrower, the slip is a
 * view of its own, opened from a bar that counts the picks — a kiosk screen is
 * wide, but nothing breaks on a narrow one.
 */
export function KioskSportsbook({
  terminal,
  languages,
}: {
  terminal: TerminalInfo;
  languages: readonly Lang[];
}) {
  const t = useTranslation();
  const slipTitle = useId();
  const [slipOpen, setSlipOpen] = useState(false);
  const count = useBetSlipStore((s) => s.selections.length);

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <KioskTopBar terminal={terminal} languages={languages} />
      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_400px]">
        <main
          className={cn(
            "min-w-0 flex-1 flex-col gap-4 px-4 pt-4 pb-28 lg:flex lg:pb-8",
            slipOpen ? "hidden" : "flex",
          )}
        >
          <h1 className="font-display text-2xl">
            {t.t("terminal.kiosk.matches")}
          </h1>
          <KioskSportTabs />
          <KioskDayStrip />
          <KioskBoard />
        </main>
        <aside
          aria-labelledby={slipTitle}
          className={cn(
            "bg-surface border-divider min-w-0 flex-1 flex-col lg:sticky lg:top-0 lg:flex lg:h-dvh lg:border-l",
            slipOpen ? "flex" : "hidden",
          )}
        >
          <KioskSlip titleId={slipTitle} onBack={() => setSlipOpen(false)} />
        </aside>
      </div>
      {!slipOpen && (
        <div className="bg-surface border-divider fixed inset-x-0 bottom-0 border-t p-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSlipOpen(true)}
            aria-label={t.t("nav.slipAria", { n: count })}
            className="bg-accent text-on-accent flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-md px-5 text-lg font-extrabold"
          >
            <Ticket className="size-5" aria-hidden />
            <span>{t.t("betSlip.title")}</span>
            <span className="bg-on-accent text-accent numeric grid min-w-8 place-items-center rounded-full px-2 text-base">
              {count}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
