import { Lock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { OddsMovement } from "@/features/markets/types";

export type OddsButtonSize = "sm" | "md";

export interface OddsButtonViewProps {
  /** Formatted price. Null renders the suspended state. */
  odds: string | null;
  selected: boolean;
  movement: OddsMovement | null;
  /** Shown on the left in lined markets, e.g. `Over` beside `1.72`. */
  label?: string;
  size?: OddsButtonSize;
  ariaLabel: string;
  onClick?: () => void;
}

/**
 * One price, and nothing else.
 *
 * Pure and store-free so every state can be rendered side by side in a test or
 * a story. It has no idea what a bet slip is; the connected `OddsButton` wires
 * it up.
 *
 *   default · selected · odds up · odds down · suspended
 */
export function OddsButtonView({
  odds,
  selected,
  movement,
  label,
  size = "md",
  ariaLabel,
  onClick,
}: OddsButtonViewProps) {
  const suspended = odds === null;

  return (
    <button
      type="button"
      onClick={suspended ? undefined : onClick}
      disabled={suspended}
      aria-pressed={suspended ? undefined : selected}
      aria-label={ariaLabel}
      className={cn(
        "font-body numeric relative flex w-full cursor-pointer items-center rounded-sm leading-none font-bold",
        size === "sm" ? "h-9 text-[13px]" : "h-11 text-sm",
        // A lock alone is centred, label or not (F8ca review U4).
        label && !suspended
          ? "justify-between gap-1.5 px-2.5"
          : "justify-center",

        suspended
          ? "border-divider text-muted cursor-not-allowed border border-dashed bg-transparent opacity-55"
          : selected
            ? "bg-accent border-accent text-on-accent border"
            : movement === "up"
              ? "bg-win-bg border-line text-win border"
              : movement === "down"
                ? "bg-loss-bg border-line text-loss border"
                : "bg-odd border-line text-text border",
      )}
    >
      {suspended ? (
        <Lock size={13} strokeWidth={1.5} aria-hidden />
      ) : (
        <>
          {label && (
            <span
              className={cn(
                "truncate text-xs font-medium",
                selected ? "text-on-accent" : "text-muted",
              )}
            >
              {label}
            </span>
          )}
          <span>{odds}</span>
          {movement && (
            <span
              aria-hidden
              className={cn(
                "absolute top-[3px] right-1 text-[8px] leading-none",
                selected
                  ? "text-on-accent"
                  : movement === "up"
                    ? "text-win"
                    : "text-loss",
              )}
            >
              {movement === "up" ? "▲" : "▼"}
            </span>
          )}
        </>
      )}
    </button>
  );
}
