"use client";

import { useRouter } from "next/navigation";
import { CircleAlert, Clock, Lock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { SYSTEM } from "@/config/constants";
import { routes } from "@/config/routes";
import { useSessionStore } from "@/stores/session.store";
import { useStartBreak } from "@/features/responsible-gaming/hooks/use-responsible-gaming";
import { useSystemStore } from "@/stores/system.store";
import { FullScreenNotice } from "./FullScreenNotice";
import { SystemDialog } from "./SystemDialog";
import { useSessionActivity } from "../hooks/use-session-activity";

/**
 * Renders whichever interruption is currently active.
 *
 * Mounted once in the shell rather than per page, so a reality check or an
 * expired session arrives wherever the user happens to be and the page behind it
 * — including the bet slip — is left exactly as it was.
 */
export function SystemOverlays() {
  const t = useTranslation();
  const router = useRouter();

  const overlay = useSystemStore((s) => s.overlay);
  const dismiss = useSystemStore((s) => s.dismiss);
  const startBreak = useStartBreak();
  const setGuest = useSessionStore((s) => s.setGuest);

  const activity = useSessionActivity(overlay === "reality");

  const toLimits = () => {
    dismiss();
    router.push(routes.responsibleGaming);
  };

  return (
    <>
      <SystemDialog
        open={overlay === "reality"}
        icon={<Clock size={22} strokeWidth={1.6} />}
        title={t.t("system.realityTitle")}
        body={t.t("system.realityBody", {
          duration: SYSTEM.realityCheck.after,
        })}
        stats={
          activity.data
            ? [
                {
                  label: t.t("system.realityStaked"),
                  value: t.money(activity.data.staked),
                },
                {
                  label: t.t("system.realityWon"),
                  value: t.money(activity.data.won),
                },
                {
                  label: t.t("system.realityNet"),
                  // Written as a signed figure: "− ETB 230.00" reads as a loss
                  // where "-230" reads as a number.
                  value: `${activity.data.net < 0 ? "− " : ""}${t.money(Math.abs(activity.data.net))}`,
                },
              ]
            : undefined
        }
        actions={[
          {
            label: t.t("system.realityKeepPlaying"),
            kind: "primary",
            onClick: dismiss,
          },
          {
            label: t.t("system.realityTakeBreak"),
            kind: "secondary",
            onClick: () => {
              startBreak.mutate({
                kind: "cool-off",
                until: SYSTEM.coolOff.until,
              });
              toLimits();
            },
          },
          {
            label: t.t("system.realityMyLimits"),
            kind: "quiet",
            onClick: toLimits,
          },
        ]}
      />

      <SystemDialog
        open={overlay === "session"}
        icon={<Lock size={22} strokeWidth={1.6} />}
        title={t.t("system.sessionTitle")}
        body={t.t("system.sessionBody")}
        actions={[
          {
            label: t.t("system.sessionLogIn"),
            kind: "primary",
            onClick: () => {
              dismiss();
              router.push(routes.login);
            },
          },
          {
            label: t.t("system.sessionKeepBrowsing"),
            kind: "quiet",
            onClick: () => {
              setGuest(true);
              dismiss();
            },
          },
        ]}
      />

      <SystemDialog
        open={overlay === "limit"}
        tone="loss"
        icon={<CircleAlert size={22} strokeWidth={1.6} />}
        title={t.t("system.limitTitle")}
        body={t.t("system.limitBody", {
          amount: t.money(SYSTEM.depositLimit.dailyLimit),
          resetTime: SYSTEM.depositLimit.resetTime,
        })}
        actions={[
          { label: t.t("system.limitOk"), kind: "primary", onClick: dismiss },
          {
            label: t.t("system.viewLimits"),
            kind: "secondary",
            onClick: toLimits,
          },
        ]}
      />

      <FullScreenNotice
        open={overlay === "age"}
        badge={t.t("system.ageBadge")}
        title={t.t("system.ageTitle")}
        body={t.t("system.ageBody")}
        notes={[t.t("system.ageNote1"), t.t("system.ageNote2")]}
        actions={[
          { label: t.t("system.ageYes"), kind: "primary", onClick: dismiss },
          { label: t.t("system.ageNo"), kind: "quiet", onClick: dismiss },
        ]}
      />

      <FullScreenNotice
        open={overlay === "maintenance"}
        badge={t.t("system.maintenanceBadge")}
        badgeTone="neutral"
        title={t.t("system.maintenanceTitle", {
          time: SYSTEM.maintenance.backAt,
        })}
        body={t.t("system.maintenanceBody")}
        notes={[
          t.t("system.maintenanceNote1", {
            start: SYSTEM.maintenance.startedAt,
            duration: SYSTEM.maintenance.duration,
          }),
          t.t("system.maintenanceNote2"),
        ]}
        actions={[
          {
            label: t.t("system.maintenanceTelegram"),
            kind: "primary",
            onClick: () => {},
          },
        ]}
      />
    </>
  );
}
