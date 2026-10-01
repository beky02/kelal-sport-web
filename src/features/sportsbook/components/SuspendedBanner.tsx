"use client";

import { Lock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Replaces a row's prices while trading is paused.
 *
 * Says why and that it is temporary, instead of leaving five dead buttons — the
 * user's next question is always "is it broken or is it me?".
 */
export function SuspendedBanner() {
  const t = useTranslation();

  return (
    <div
      role="status"
      className="border-divider text-muted mx-2 my-2.5 flex items-center justify-center gap-2 rounded-sm border border-dashed py-2 text-xs md:col-start-2 xl:col-end-5"
    >
      <Lock size={13} strokeWidth={1.5} aria-hidden />
      <span className="text-text font-bold">{t.t("board.suspended")}</span>
      <span className="hidden sm:inline">{t.t("board.suspendedHint")}</span>
    </div>
  );
}
