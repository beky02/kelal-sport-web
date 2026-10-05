"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";

/** How an outcome reads at a glance: still going, done, or not done. */
export type OutcomeTone = "wait" | "good" | "bad";

const TONE: Record<OutcomeTone, { tile: string; badge: string }> = {
  wait: { tile: "text-muted", badge: "border-divider text-muted" },
  good: { tile: "text-accent", badge: "border-accent text-accent" },
  bad: { tile: "text-loss", badge: "border-loss text-loss" },
};

export interface OutcomeAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
  /**
   * On its way: it says so and does nothing more until answered, but stays
   * in the tab order, so a keyboard keeps its place when the answer lands.
   */
  busy?: boolean;
}

/**
 * Where a deposit or a withdrawal stands: anything to say about the last
 * thing the player asked (`notice`) — over the status it points to — then
 * what, in words — a badge that reads without `uppercase` or `tracking-*`, a
 * title focus lands on, the lines under it — the payment's rows, and what to
 * do next. `role="status"`, so each change is read out.
 */
export function PaymentOutcome({
  tone,
  icon,
  badge,
  title,
  lines,
  rows,
  notice,
  actions,
  headingRef,
}: {
  tone: OutcomeTone;
  icon: ReactNode;
  badge: string | null;
  title: string;
  lines: string[];
  rows: { label: string; value: string }[];
  notice?: ReactNode;
  actions: OutcomeAction[];
  headingRef: (node: HTMLHeadingElement | null) => void;
}) {
  return (
    <>
      {notice && <div className="mx-4 mt-4">{notice}</div>}

      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-2.5 px-5 pt-10 pb-7 text-center"
      >
        <div
          className={cn(
            "bg-surface grid size-[68px] place-items-center rounded-lg",
            TONE[tone].tile,
          )}
        >
          {icon}
        </div>
        {badge && (
          <span
            className={cn(
              "rounded-full border px-2.5 py-[3px] text-xs font-bold",
              TONE[tone].badge,
            )}
          >
            {badge}
          </span>
        )}
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 text-2xl text-balance outline-none"
        >
          {title}
        </h2>
        {lines.map((line) => (
          <p key={line} className="text-muted max-w-[320px] text-pretty">
            {line}
          </p>
        ))}
      </div>

      {rows.length > 0 && (
        <dl className="bg-surface numeric mx-4 rounded-md px-3.5 py-1">
          {rows.map((row) => (
            <div
              key={row.label}
              className="border-divider flex justify-between gap-3 border-b py-2.5 last:border-b-0"
            >
              <dt className="text-muted shrink-0">{row.label}</dt>
              <dd className="min-w-0 text-right font-semibold break-all">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-col gap-2 p-4 pb-6">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            aria-disabled={action.busy || undefined}
            aria-busy={action.busy || undefined}
            onClick={action.busy ? undefined : action.onClick}
            className={cn(
              "font-body flex items-center justify-center gap-2 rounded-md px-3 font-bold",
              action.primary
                ? "bg-accent text-on-accent h-[52px] text-[15px]"
                : "bg-raised text-text h-12 text-sm",
              action.busy ? "cursor-wait opacity-60" : "cursor-pointer",
            )}
          >
            {action.busy && (
              <Loader2 size={18} className="animate-spin" aria-hidden />
            )}
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}

/** The outcome's place while it loads: the same shape, so nothing jumps. */
export function OutcomeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 px-5 pt-10 pb-7">
      <Skeleton className="size-[68px] rounded-lg" />
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64" />
    </div>
  );
}
