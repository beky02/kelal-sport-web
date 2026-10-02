"use client";

import { BadgeCheck, CircleAlert, CircleX, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n";
import { SubmitButton } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import type { KycResultView } from "../../types";

const LOOK: Record<
  KycResultView["status"],
  { icon: LucideIcon; badge: MessageKey; title: MessageKey; tone: string }
> = {
  verified: {
    icon: BadgeCheck,
    badge: "auth.verified",
    title: "auth.kycVerifiedTitle",
    tone: "text-win",
  },
  pending: {
    icon: Clock,
    badge: "auth.pending",
    title: "auth.pendingTitle",
    tone: "text-accent",
  },
  needs_info: {
    icon: CircleAlert,
    badge: "auth.needsInfo",
    title: "auth.needsInfoTitle",
    tone: "text-warn",
  },
  rejected: {
    icon: CircleX,
    badge: "auth.rejected",
    title: "auth.rejectedTitle",
    tone: "text-loss",
  },
};

/**
 * Fayda's verdict (C02 §8), in the player's words.
 *
 * Nothing here promises a withdrawal: whether one is allowed is the API's
 * `can_withdraw`, which the wallet reads. `needs_info` says why — the name or
 * the date of birth did not match — and offers another go or later.
 */
export function KycResultStep({
  result,
  doneLabel,
  onDone,
  onRetry,
  onLater,
}: {
  result: KycResultView;
  doneLabel: string;
  onDone: () => void;
  onRetry: () => void;
  onLater: () => void;
}) {
  const t = useTranslation();
  const look = LOOK[result.status];
  const Icon = look.icon;

  const body =
    result.status === "verified"
      ? t.t("auth.kycVerifiedBody")
      : result.status === "pending"
        ? t.t("auth.pendingBody")
        : result.status === "needs_info"
          ? t.t(`auth.kycReason.${result.reasonCode ?? "OTHER"}`)
          : t.t("auth.rejectedBody");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2.5 px-2 py-6 text-center">
        <div
          className={cn(
            "bg-surface grid size-16 place-items-center rounded-lg",
            look.tone,
          )}
        >
          <Icon size={28} strokeWidth={1.5} aria-hidden />
        </div>
        <span className="bg-surface text-muted label-caps rounded-md px-2 py-[3px]">
          {t.t(look.badge)}
        </span>
        <h2 className="mt-1 text-[22px]">{t.t(look.title)}</h2>
        <p className="text-muted max-w-[280px] text-pretty">{body}</p>
      </div>

      {result.status === "needs_info" ? (
        <>
          <SubmitButton onClick={onRetry}>{t.t("auth.tryAgain")}</SubmitButton>
          <button
            type="button"
            onClick={onLater}
            className="bg-raised text-text font-body h-12 cursor-pointer rounded-md text-sm font-bold"
          >
            {t.t("auth.doThisLater")}
          </button>
        </>
      ) : (
        <SubmitButton onClick={onDone}>{doneLabel}</SubmitButton>
      )}
    </div>
  );
}
