"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { Segmented } from "@/components/ui/Segmented";
import { systemOptions } from "../lib/calculate";
import { useBetSlipStore } from "../stores/bet-slip.store";
import type { BetSlipMode } from "../types";
import { cn } from "@/lib/utils/cn";

/** Single · Multiple · System, plus the system size picker when it applies. */
export function BetModeTabs({
  mode,
  systemAvailable,
  systemK,
  liveCount,
}: {
  mode: BetSlipMode;
  systemAvailable: boolean;
  systemK: number;
  liveCount: number;
}) {
  const t = useTranslation();
  const setMode = useBetSlipStore((s) => s.setMode);
  const setSystemK = useBetSlipStore((s) => s.setSystemK);

  return (
    <div className="px-4 pb-2.5">
      <Segmented
        value={mode}
        onChange={setMode}
        fill="ground"
        options={[
          { value: "single", label: t.t("betSlip.single") },
          { value: "multiple", label: t.t("betSlip.multiple") },
          {
            value: "system",
            label: t.t("betSlip.system"),
            disabled: !systemAvailable,
            title: systemAvailable
              ? undefined
              : t.t("betSlip.systemNeedsThree"),
          },
        ]}
      />

      {mode === "system" && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          {systemOptions(liveCount).map((option) => (
            <button
              key={option.k}
              type="button"
              aria-pressed={option.k === systemK}
              onClick={() => setSystemK(option.k)}
              className={cn(
                "font-body flex h-[34px] cursor-pointer items-center gap-1.5 rounded-sm border bg-transparent px-2.5 text-[13px]",
                option.k === systemK ? "border-accent" : "border-divider",
              )}
            >
              <span className="font-bold">{option.label}</span>
              <span className="text-muted text-[11px]">
                {option.betCount} {t.t("betSlip.bets")}
              </span>
            </button>
          ))}
        </div>
      )}

      {!systemAvailable && (
        <div className="text-muted pt-1.5 text-[11px]">
          {t.t("betSlip.systemNeedsThree")}
        </div>
      )}
    </div>
  );
}
