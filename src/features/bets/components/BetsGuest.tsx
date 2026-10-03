"use client";

import { LogIn } from "lucide-react";
import { StateMessage } from "@/components/feedback/StateMessage";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * My bets for a guest — a session the API stopped honouring, or a logout in
 * another tab. Nothing to show; the way back is to log in.
 */
export function BetsGuest() {
  const t = useTranslation();
  const openAuth = useAuthStore((s) => s.open);
  return (
    <StateMessage
      icon={<LogIn size={24} strokeWidth={1.5} />}
      title={t.t("bets.guestTitle")}
      body={t.t("bets.guestBody")}
      action={{ label: t.t("header.login"), onClick: () => openAuth("login") }}
    />
  );
}
