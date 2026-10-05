"use client";

import { Lock } from "lucide-react";
import { StateMessage } from "@/components/feedback/StateMessage";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Where a deposit would start during a break: deposits are paused until it
 * ends, and nothing here can end it. Read from `/api/me`, so a reload shows it
 * again. Withdrawing stays open (RG-02).
 */
export function DepositPaused({
  until,
  onBack,
}: {
  /** When the break ends, already formatted; null for one with no end. */
  until: string | null;
  onBack: () => void;
}) {
  const t = useTranslation();
  return (
    // Focus comes here: it may replace the confirm step the player just
    // pressed, and a screen reader reads where focus lands.
    <StateMessage
      icon={<Lock size={24} strokeWidth={1.5} />}
      title={t.t("deposit.refused.breakTitle")}
      body={
        until
          ? t.t("deposit.refused.breakUntil", { date: until })
          : t.t("deposit.refused.break")
      }
      action={{ label: t.t("deposit.backToWallet"), onClick: onBack }}
      focusOnMount
    />
  );
}
