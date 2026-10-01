"use client";

import { Ticket } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Sheet } from "@/components/ui/Sheet";
import { useUiStore } from "@/stores/ui.store";
import { useBetSlipStore } from "../stores/bet-slip.store";
import { BetSlip } from "./BetSlip";

/**
 * The slip below the desktop: a sheet, opened from a button at the foot of the
 * screen.
 *
 * Not a third column shrunk down. The board keeps the full width, and the slip
 * only takes the screen when the user asks for it. On a phone the button is the
 * tab bar's centre tab; on a tablet, which has no tab bar, it is the floating
 * bar below — hidden until there is something in the slip.
 */
export function MobileBetSlip() {
  const t = useTranslation();
  const count = useBetSlipStore((s) => s.selections.length);
  const open = useUiStore((s) => s.mobileSlipOpen);
  const setOpen = useUiStore((s) => s.setMobileSlipOpen);

  return (
    <>
      {count > 0 && !open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:flex xl:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-accent text-on-accent font-body pointer-events-auto flex h-12 cursor-pointer items-center gap-2.5 rounded-full px-5 text-sm font-bold shadow-[0_8px_24px_rgb(0_0_0/0.35)]"
          >
            <Ticket size={17} strokeWidth={1.5} aria-hidden />
            {t.t("betSlip.title")}
            <span className="bg-on-accent/20 grid size-[22px] place-items-center rounded-full text-xs font-extrabold">
              {count}
            </span>
          </button>
        </div>
      )}

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t.t("betSlip.title")}
        className="xl:hidden"
      >
        <BetSlip onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
