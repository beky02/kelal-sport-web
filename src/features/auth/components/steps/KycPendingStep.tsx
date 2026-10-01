"use client";

import { Clock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { SubmitButton } from "@/components/ui/Field";

/** Verification submitted: says how long and how the user will hear back. */
export function KycPendingStep({ onDone }: { onDone: () => void }) {
  const t = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2.5 px-2 py-6 text-center">
        <div className="bg-surface text-accent grid size-16 place-items-center rounded-lg">
          <Clock size={28} strokeWidth={1.5} aria-hidden />
        </div>
        <span className="bg-surface text-muted rounded-md px-2 py-[3px] text-[11px] font-bold tracking-[0.06em] uppercase">
          {t.t("auth.pending")}
        </span>
        <h2 className="mt-1 text-[22px]">{t.t("auth.pendingTitle")}</h2>
        <p className="text-muted max-w-[280px] text-pretty">
          {t.t("auth.pendingBody")}
        </p>
      </div>

      <SubmitButton onClick={onDone}>{t.t("auth.startBetting")}</SubmitButton>
    </div>
  );
}
