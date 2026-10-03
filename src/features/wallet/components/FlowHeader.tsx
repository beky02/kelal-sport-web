"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { WALLET_FLOW, type FlowStep } from "../types";

/**
 * Back, what we're doing, and how far through it we are. Back stays in the
 * tab order but does nothing while `locked` (a deposit on its way).
 */
export function FlowHeader({
  title,
  step,
  onBack,
  backLabel,
  locked = false,
}: {
  title: string;
  step: FlowStep;
  onBack: () => void;
  backLabel: string;
  locked?: boolean;
}) {
  const index = WALLET_FLOW.indexOf(step);

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
        <div className="grid grid-cols-3 gap-1 px-4 pt-3">
          {WALLET_FLOW.map((flowStep, i) => (
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
