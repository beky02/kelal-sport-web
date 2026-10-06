"use client";

import { useMemo, useState } from "react";
import { Ticket } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { BetSelectionRow } from "@/features/bet-slip/components/BetSelectionRow";
import { BetSlipHeader } from "@/features/bet-slip/components/BetSlipHeader";
import { EmptySlip } from "@/features/bet-slip/components/EmptySlip";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The kiosk's slip (F8ca), from the player's slip parts: its header with
 * Clear all, its empty state, and a row per pick (match, market, pick, the
 * odds when tapped; two picks of one match marked). No stake, figure or
 * button to bet yet: F8cb prices it with the shop's rule set, F8cc turns it
 * into a code for the counter. The store is the player's slip store.
 */
export function KioskSlip({ onClose }: { onClose?: () => void }) {
  const selections = useBetSlipStore((s) => s.selections);
  // Two picks of one match can't share a multiple (the slip's default mode).
  const conflicts = useMemo(() => {
    const seen = new Map<string, number>();
    for (const s of selections) {
      seen.set(s.eventId, (seen.get(s.eventId) ?? 0) + 1);
    }
    return new Set([...seen].filter(([, n]) => n > 1).map(([id]) => id));
  }, [selections]);

  return (
    <div className="flex flex-col pb-3">
      <BetSlipHeader count={selections.length} onClose={onClose} />
      {selections.length === 0 ? (
        <EmptySlip />
      ) : (
        <div className="bg-surface mx-3 overflow-hidden rounded-lg">
          {selections.map((selection, index) => (
            <BetSelectionRow
              key={selection.outcomeId}
              selection={selection}
              first={index === 0}
              conflict={conflicts.has(selection.eventId)}
              pending={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Below `xl`, where the slip has no column of its own: a bar that counts the
 * picks and opens it as a sheet, as on the player's site (`MobileBetSlip`).
 */
export function KioskMobileSlip() {
  const t = useTranslation();
  const count = useBetSlipStore((s) => s.selections.length);
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* As the player's: shown once there is something in the slip. */}
      {count > 0 && !open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t.t("nav.slipAria", { n: count })}
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
        <KioskSlip onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
