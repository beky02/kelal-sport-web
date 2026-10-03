"use client";

import { LogIn } from "lucide-react";
import { StateMessage } from "@/components/feedback/StateMessage";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The wallet, or its history, for a guest — a session the API stopped
 * honouring, or a logout in another tab. Nothing is read; the way back is to
 * log in.
 */
export function WalletGuest({ history = false }: { history?: boolean }) {
  const t = useTranslation();
  const openAuth = useAuthStore((s) => s.open);
  return (
    <StateMessage
      icon={<LogIn size={24} strokeWidth={1.5} />}
      title={t.t(history ? "history.guestTitle" : "wallet.guestTitle")}
      body={t.t(history ? "history.guestBody" : "wallet.guestBody")}
      action={{ label: t.t("header.login"), onClick: () => openAuth("login") }}
    />
  );
}
