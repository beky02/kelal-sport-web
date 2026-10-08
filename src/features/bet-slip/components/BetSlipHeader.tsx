"use client";

import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import { useBetSlipStore } from "../stores/bet-slip.store";

export function BetSlipHeader({
  count,
  onClose,
}: {
  count: number;
  /** Provided only in the mobile sheet, where the slip can be dismissed. */
  onClose?: () => void;
}) {
  const t = useTranslation();
  const clear = useBetSlipStore((s) => s.clear);

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 pr-1.5 pl-4",
        (count > 0 || onClose) && "min-h-11 py-1",
      )}
    >
      {/* No visible title or count (the user's review, 2026-10-08): the panel's
          tab and the slip tabs already say both (the tabs announce each slip's count). Still a heading for screen
          readers, who navigate the slip by it; in the mobile sheet it is the
          first thing inside it. */}
      <h2 className="sr-only">{t.t("betSlip.title")}</h2>

      {count > 0 && (
        <button
          type="button"
          onClick={clear}
          className="text-muted hover:text-text font-body h-10 cursor-pointer bg-transparent px-2.5 text-[13px] font-bold"
        >
          {t.t("betSlip.clearAll")}
        </button>
      )}

      {onClose && (
        <button
          type="button"
          aria-label={t.t("betSlip.close")}
          onClick={onClose}
          className="text-text grid size-11 cursor-pointer place-items-center rounded-md bg-transparent"
        >
          <X size={18} strokeWidth={1.5} aria-hidden />
        </button>
      )}
    </div>
  );
}
