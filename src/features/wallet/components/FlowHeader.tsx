"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { WALLET_FLOW, type WalletStep } from "../types";

/** Back, what we're doing, and how far through it we are. */
export function FlowHeader({
  title,
  step,
  onBack,
  backLabel,
}: {
  title: string;
  step: WalletStep;
  onBack: () => void;
  backLabel: string;
}) {
  const index = WALLET_FLOW.indexOf(step);

  return (
    <>
      <div className="border-divider grid min-h-12 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b px-1">
        <button
          type="button"
          aria-label={backLabel}
          onClick={onBack}
          className="text-text grid size-11 cursor-pointer place-items-center rounded-md bg-transparent"
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
