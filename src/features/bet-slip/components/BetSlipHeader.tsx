"use client";

import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { CountBadge } from "@/components/ui/CountBadge";
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
    <div className="flex min-h-[52px] items-center gap-2 py-1.5 pr-1.5 pl-4">
      {/* A heading, not styled text: screen-reader users navigate the slip by
          heading, and in the mobile sheet this is the first thing inside it. */}
      <h2 className="text-lg leading-none">{t.t("betSlip.title")}</h2>
      <CountBadge>{count}</CountBadge>
      <span className="flex-1" />

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
