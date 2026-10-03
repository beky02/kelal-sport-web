"use client";

import { CircleAlert, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface NoticeAction {
  label: string;
  onClick: () => void;
  /** On its way: it says so and does nothing more until answered. */
  busy?: boolean;
}

/**
 * What came of the last thing the player asked, as an alert: `pending` —
 * there was no answer, and it may have gone through — or `refused`, with the
 * API's reason. The first line is ours, any further one the API's own
 * `detail` (an empty one is not shown); each action is a real button, the
 * first the main one. `focusAction`: the first button takes focus when the
 * notice appears — for one that replaces the button the player pressed, so
 * the keyboard keeps its place.
 */
export function PaymentNotice({
  tone,
  title,
  lines,
  actions = [],
  focusAction = false,
}: {
  tone: "pending" | "refused";
  title: string;
  lines: (string | null)[];
  actions?: NoticeAction[];
  focusAction?: boolean;
}) {
  const Icon = tone === "pending" ? Clock : CircleAlert;
  const shown = lines.filter((line): line is string => Boolean(line));
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2.5 rounded-md p-3",
        tone === "pending" ? "bg-raised border-accent border" : "bg-loss-bg",
      )}
    >
      <div className="flex gap-2.5">
        <Icon
          size={17}
          strokeWidth={1.5}
          aria-hidden
          className={cn(
            "mt-0.5 shrink-0",
            tone === "pending" ? "text-accent" : "text-loss",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="font-bold">{title}</div>
          {shown.map((line, i) => (
            <p
              // By place: the API's detail can repeat its title word for word.
              key={i}
              className={cn("text-muted text-xs text-pretty", i > 0 && "mt-1")}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action, i) => (
            <button
              key={action.label}
              type="button"
              autoFocus={focusAction && i === 0}
              aria-disabled={action.busy || undefined}
              aria-busy={action.busy || undefined}
              onClick={action.busy ? undefined : action.onClick}
              className={cn(
                "font-body numeric flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-bold",
                i === 0 ? "bg-accent text-on-accent" : "bg-raised text-text",
                action.busy ? "cursor-wait opacity-60" : "cursor-pointer",
              )}
            >
              {action.busy && (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              )}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
