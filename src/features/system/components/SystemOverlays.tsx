"use client";

import { useRouter } from "next/navigation";
import { Clock, Lock } from "lucide-react";
import type { Interpolations, MessageKey } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n/use-translation";
import { SYSTEM } from "@/config/constants";
import { routes } from "@/config/routes";
import { useLogout } from "@/features/auth/hooks/use-session";
import { useSystemStore } from "@/stores/system.store";
import { FullScreenNotice } from "./FullScreenNotice";
import { SystemDialog } from "./SystemDialog";
import { useRealityCheck } from "../hooks/use-reality-check";

/** "1 h 30 min", "2 h", "45 min": the time played, as the reality check says it. */
function played(minutes: number): { key: MessageKey; values: Interpolations } {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return { key: "system.realityPlayedMinutes", values: { minutes: rest } };
  }
  if (rest === 0)
    return { key: "system.realityPlayedHours", values: { hours } };
  return {
    key: "system.realityPlayedHoursMinutes",
    values: { hours, minutes: rest },
  };
}

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
  const logout = useLogout();

  const reality = useRealityCheck();
  const playedFor = played(reality.playedMinutes);

  // A break needs its length, and the question asked once in full sentences:
  // both are on the responsible-gaming page (F7a).
  const toLimits = () => {
    reality.answer();
    router.push(routes.responsibleGaming);
  };

  return (
    <>
      <SystemDialog
        open={overlay === "reality"}
        icon={<Clock size={22} strokeWidth={1.6} />}
        title={t.t("system.realityTitle")}
        // Time only: the session's staked, won and net come from the API once
        // the contract has them (contract request 012, F7e) — never added up
        // here.
        body={t.t(playedFor.key, playedFor.values)}
        actions={[
          {
            label: t.t("system.realityKeepPlaying"),
            kind: "primary",
            onClick: reality.answer,
          },
          {
            label: t.t("system.realityTakeBreak"),
            kind: "secondary",
            onClick: toLimits,
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
              // The session is already gone at the API; this clears what is
              // left of it here, so the screens agree.
              logout.mutate();
              dismiss();
            },
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
