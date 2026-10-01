"use client";

import { Ticket } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";

export function EmptySlip() {
  const t = useTranslation();

  return (
    <div className="flex flex-col items-center gap-1.5 px-6 pt-7 pb-4 text-center">
      <div className="bg-surface text-muted grid size-13 place-items-center rounded-lg">
        <Ticket size={24} strokeWidth={1.5} aria-hidden />
      </div>
      <div className="font-display mt-2 text-base">
        {t.t("betSlip.emptyTitle")}
      </div>
      <p className="text-muted max-w-[260px]">{t.t("betSlip.emptyBody")}</p>
    </div>
  );
}
