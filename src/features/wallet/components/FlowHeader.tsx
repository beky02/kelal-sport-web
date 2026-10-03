"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { WALLET_FLOW, type FlowStep } from "../types";

/**
 * Back, what we're doing, and how far through it we are — one bar per step
 * of this flow (`steps`). Back stays in the tab order but does nothing while
 * `locked` (a payment on its way).
 */
export function FlowHeader({
  title,
  step,
  steps = WALLET_FLOW,
  onBack,
  backLabel,
  locked = false,
}: {
  title: string;
  step: FlowStep;
  steps?: readonly FlowStep[];
  onBack: () => void;
  backLabel: string;
  locked?: boolean;
}) {
  const index = steps.indexOf(step);

  return (
    <>
      <div className="border-divider grid min-h-12 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b px-1">
        <button
          type="button"
          aria-label={backLabel}
          aria-disabled={locked || undefined}
          onClick={locked ? undefined : onBack}
          className={cn(
            "text-text grid size-11 place-items-center rounded-md bg-transparent",
            locked ? "cursor-wait opacity-40" : "cursor-pointer",
          )}
        >
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
        </button>
        <div className="font-display text-center text-[15px]">{title}</div>
        <span />
      </div>

      {index >= 0 && (
        <div
          className={cn(
            "grid gap-1 px-4 pt-3",
            steps.length === 4 ? "grid-cols-4" : "grid-cols-3",
          )}
        >
          {steps.map((flowStep, i) => (
            <span
              key={flowStep}
              aria-hidden
              className={cn("h-[3px]", i <= index ? "bg-accent" : "bg-divider")}
            />
          ))}
        </div>
      )}
    </>
  );
}
