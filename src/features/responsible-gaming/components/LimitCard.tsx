"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

/**
 * A spending limit, with how much of it is gone.
 *
 * The bar turns red past 90% rather than at 100%: a limit is a warning system,
 * and telling someone only once they have hit it defeats the purpose.
 */
export function LimitCard({
  title,
  aside,
  amount,
  used,
  onAmountChange,
  note,
  children,
  footer,
}: {
  title: string;
  aside?: string;
  amount: number;
  used: number;
  onAmountChange: (amount: number) => void;
  note: string;
  /** Period selector, where the limit has one. */
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = useTranslation();
  const share = amount > 0 ? Math.min(1, used / amount) : 0;
  const nearLimit = amount > 0 && used / amount > 0.9;

  return (
    <Card className="flex flex-col gap-3 p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-base">{title}</span>
        {aside && <span className="text-muted text-[11px]">{aside}</span>}
      </div>

      {children}

      <div className="bg-raised flex h-12 rounded-md">
        <span className="border-divider text-muted flex items-center border-r px-3 font-semibold">
          {t.t("header.currency")}
        </span>
        <input
          inputMode="numeric"
          aria-label={title}
          value={amount === 0 ? "" : String(amount)}
          onChange={(event) =>
            onAmountChange(Number(event.target.value.replace(/\D/g, "") || 0))
          }
          className="font-body numeric text-text min-w-0 flex-1 border-0 bg-transparent px-3 text-[17px] font-semibold outline-none"
        />
      </div>

      <div className="bg-ground h-1.5 overflow-hidden rounded-full">
        <div
          className={cn("h-full", nearLimit ? "bg-loss" : "bg-accent")}
          style={{ width: `${share * 100}%` }}
        />
      </div>

      <div className="text-muted numeric text-[11px]">
        {t.t("rg.used", { used: t.money(used), limit: t.money(amount) })}
      </div>

      <p className="text-muted text-[11px] text-pretty">{note}</p>

      {footer}
    </Card>
  );
}
