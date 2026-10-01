"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";

/** Four bars and four labels: where the user is, and how much is left. */
export function AuthStepper({ current }: { current: number }) {
  const t = useTranslation();

  const labels = [
    t.t("auth.stepPhone"),
    t.t("auth.stepCode"),
    t.t("auth.stepPassword"),
    t.t("auth.stepId"),
  ];

  return (
    <div className="grid grid-cols-4 gap-1 px-4 pt-3.5">
      {labels.map((label, index) => (
        <div key={label} className="flex flex-col gap-1.5">
          <span
            aria-hidden
            className={cn(
              "h-1 rounded-sm",
              index <= current ? "bg-accent" : "bg-divider",
            )}
          />
          <span
            className={cn(
              "text-[11px]",
              index === current
                ? "text-text font-bold"
                : index < current
                  ? "text-text font-medium"
                  : "text-muted font-medium",
            )}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
