"use client";

import { Monitor, Smartphone } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { MessageKey } from "@/lib/i18n";
import { useLongDateTimeText } from "@/lib/i18n/use-long-date-time-text";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  useDeviceSessions,
  useRevokeDeviceSession,
} from "../hooks/use-account";
import type { DeviceSession } from "../types";
import { SaveProblem } from "./SaveProblem";
import { SettingsSection } from "./SettingsRow";

const PLATFORM: Record<DeviceSession["platform"], MessageKey> = {
  android: "profile.platformAndroid",
  ios: "profile.platformIos",
  web: "profile.platformWeb",
};

/** This device first, then the others by when they were last used, newest first. */
const byUse = (a: DeviceSession, b: DeviceSession) =>
  Number(b.current) - Number(a.current) ||
  Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt);

/**
 * The devices signed in to the account (REG-10, AC-9), from
 * `/api/me/sessions`. This one is marked and has no Sign out — Log out, below,
 * is how it leaves. Each other device can be signed out; it leaves the list
 * only once the API has said so and the list is read again.
 */
export function DevicesSection() {
  const t = useTranslation();
  const devices = useDeviceSessions(true);

  return (
    <>
      <SettingsSection>{t.t("profile.devices")}</SettingsSection>
      <p className="text-muted px-4 pb-2 text-xs">
        {t.t("profile.devicesBody")}
      </p>
      {devices.data ? (
        <ul
          aria-label={t.t("profile.devices")}
          className="border-divider border-t"
        >
          {[...devices.data].sort(byUse).map((device) => (
            <DeviceRow key={device.id} device={device} />
          ))}
        </ul>
      ) : devices.isError ? (
        <div className="border-divider flex min-h-14 items-center gap-3 border-t border-b px-4">
          <span className="flex-1 text-xs">{t.t("profile.devicesFailed")}</span>
          <button
            type="button"
            onClick={() => void devices.refetch()}
            className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
          >
            {t.t("common.retry")}
          </button>
        </div>
      ) : (
        <div className="border-divider border-t">
          {[0, 1].map((row) => (
            <div
              key={row}
              className="border-divider flex min-h-16 items-center gap-3 border-b px-4"
            >
              <Skeleton className="size-5 rounded-md" />
              <span className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function DeviceRow({ device }: { device: DeviceSession }) {
  const t = useTranslation();
  const when = useLongDateTimeText();
  const revoke = useRevokeDeviceSession();

  const name = device.userAgent ?? t.t(PLATFORM[device.platform]);
  const Icon = device.platform === "web" ? Monitor : Smartphone;
  const lastActive = device.ip
    ? t.t("profile.lastActiveFrom", {
        time: when(device.lastUsedAt),
        ip: device.ip,
      })
    : t.t("profile.lastActive", { time: when(device.lastUsedAt) });
  return (
    <li className="border-divider border-b">
      <div className="flex min-h-16 items-center gap-3 px-4 py-2">
        <Icon
          size={20}
          strokeWidth={1.5}
          aria-hidden
          className="text-accent shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold break-words">{name}</span>
          <span className="text-muted block text-xs">
            {revoke.isPending ? t.t("profile.signingOut") : lastActive}
          </span>
        </span>
        {device.current ? (
          <span className="border-accent text-accent shrink-0 rounded-full border px-2.5 py-[3px] text-xs font-bold">
            {t.t("profile.thisDevice")}
          </span>
        ) : (
          <button
            type="button"
            aria-label={t.t("profile.signOutDeviceAria", { device: name })}
            aria-busy={revoke.isPending || undefined}
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(device.id)}
            className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold disabled:cursor-wait disabled:opacity-60"
          >
            {t.t("profile.signOutDevice")}
          </button>
        )}
      </div>
      <SaveProblem
        title="profile.signOutFailed"
        error={revoke.isPending ? null : revoke.error}
        onRetry={() => revoke.mutate(device.id)}
      />
    </li>
  );
}
