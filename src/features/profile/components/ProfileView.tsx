"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Phone, Send, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { LICENCE } from "@/config/constants";
import { routes } from "@/config/routes";
import { useLogout, useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUiStore } from "@/stores/ui.store";
import type {
  CalendarSystem,
  ClockConvention,
  Lang,
  Theme,
} from "@/types/common";
import { cn } from "@/lib/utils/cn";
import { InfoRow, SettingsRow, SettingsSection } from "./SettingsRow";

/** The first letters of the first two names: `Abebe Kebede` → `AK`. */
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** A `YYYY-MM-DD` as a person reads it, in the Gregorian calendar (D7). */
const formatBirthDate = (date: string, lang: "en" | "am") =>
  new Intl.DateTimeFormat(lang === "am" ? "am-ET" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

/**
 * Account and settings.
 *
 * The home for the preferences that have nowhere else to live — the Ethiopian
 * clock and calendar, and data saver — alongside language and theme, which are also in the
 * header because they are needed mid-task.
 *
 * Nothing here is a profile "edit" form: name, phone and date of birth come
 * from the account (`/api/me`) and are shown, not typed over.
 */
export function ProfileView() {
  const t = useTranslation();
  const router = useRouter();

  const lang = useUiStore((s) => s.lang);
  const setLang = useUiStore((s) => s.setLang);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const clock = useUiStore((s) => s.clock);
  const setClock = useUiStore((s) => s.setClock);
  const calendar = useUiStore((s) => s.calendar);
  const setCalendar = useUiStore((s) => s.setCalendar);
  const dataSaver = useUiStore((s) => s.dataSaver);
  const setDataSaver = useUiStore((s) => s.setDataSaver);

  const { isLoading, isGuest, player, kycVerified } = useSession();
  const logout = useLogout();
  const openAuth = useAuthStore((s) => s.open);

  // Local until there is a notifications endpoint; offers stay off by default.
  const [notifications, setNotifications] = useState([
    true,
    true,
    true,
    true,
    false,
  ]);
  const toggleNotification = (index: number) =>
    setNotifications((current) =>
      current.map((on, i) => (i === index ? !on : on)),
    );

  const notificationRows = [
    {
      label: t.t("profile.notifTelegram"),
      note: t.t("profile.notifTelegramBody"),
    },
    { label: t.t("profile.notifSettled") },
    { label: t.t("profile.notifPayments") },
    { label: t.t("profile.notifSession") },
    { label: t.t("profile.notifOffers"), note: t.t("profile.notifOffersBody") },
  ];

  const kycLabel = kycVerified
    ? "profile.kycVerified"
    : player?.kycStatus === "pending"
      ? "profile.kycPending"
      : "profile.kycNone";

  return (
    <div className="flex w-full flex-col">
      {isLoading ? (
        <div className="flex items-center gap-3.5 px-4 pt-4.5 pb-1">
          <Skeleton className="size-14 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ) : isGuest || !player ? (
        <div className="flex flex-col gap-3 px-4 pt-4.5 pb-1">
          <h2 className="text-[22px]">{t.t("profile.menu")}</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="bg-raised text-text font-body h-12 cursor-pointer rounded-md text-sm font-bold"
            >
              {t.t("header.login")}
            </button>
            <button
              type="button"
              onClick={() => openAuth("phone")}
              className="bg-accent text-on-accent font-body h-12 cursor-pointer rounded-md text-sm font-bold"
            >
              {t.t("header.register")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3.5 px-4 pt-4.5 pb-1">
            <div className="bg-surface font-display grid size-14 shrink-0 place-items-center rounded-lg text-lg">
              {initials(player.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg leading-[1.15]">
                {player.fullName}
              </div>
              <div className="text-muted numeric text-xs">{player.phone}</div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-[3px] text-[10px] font-bold tracking-[0.06em] uppercase",
                kycVerified
                  ? "border-accent text-accent"
                  : "border-muted text-muted",
              )}
            >
              {t.t(kycLabel)}
            </span>
          </div>

          {!kycVerified && (
            <div className="border-accent mx-4 mt-3 flex items-center gap-2.5 rounded-md border px-3 py-2.5">
              <span className="flex-1 text-xs">{t.t("profile.kycNeed")}</span>
              <button
                type="button"
                onClick={() => openAuth("kyc")}
                className="bg-accent text-on-accent font-body h-10 cursor-pointer rounded-md px-3.5 text-[13px] font-bold"
              >
                {t.t("profile.verify")}
              </button>
            </div>
          )}
        </>
      )}

      <Link
        href={routes.responsibleGaming}
        className="bg-surface text-text mx-4 mt-4 flex min-h-15 items-center gap-3 rounded-lg p-2.5 px-3 no-underline"
      >
        <ShieldCheck
          size={22}
          strokeWidth={1.5}
          aria-hidden
          className="text-accent shrink-0"
        />
        <span className="flex-1">
          <span className="block text-sm font-semibold">
            {t.t("profile.rgTitle")}
          </span>
          <span className="text-muted block text-[11px]">
            {t.t("profile.rgBody")}
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={1.5} aria-hidden />
      </Link>

      {player && (
        <>
          <SettingsSection>{t.t("profile.personal")}</SettingsSection>
          <div className="border-divider border-t">
            <InfoRow label={t.t("profile.fullName")} value={player.fullName} />
            <InfoRow label={t.t("profile.phone")} value={player.phone} />
            {player.dateOfBirth && (
              <InfoRow
                label={t.t("profile.dateOfBirth")}
                value={formatBirthDate(player.dateOfBirth, t.lang)}
              />
            )}
          </div>
        </>
      )}

      <SettingsSection>{t.t("profile.preferences")}</SettingsSection>
      <div className="border-divider border-t">
        <SettingsRow label={t.t("profile.language")}>
          <Segmented<Lang>
            value={lang}
            onChange={setLang}
            options={[
              { value: "en", label: "English" },
              { value: "am", label: "አማርኛ" },
            ]}
          />
        </SettingsRow>

        <SettingsRow label={t.t("profile.theme")}>
          <Segmented<Theme>
            value={theme}
            onChange={setTheme}
            options={[
              { value: "dark", label: t.t("profile.dark") },
              { value: "light", label: t.t("profile.light") },
            ]}
          />
        </SettingsRow>

        {/* The example is the point of this row: "Ethiopian clock" means nothing
            until you see what it does to a kickoff time. */}
        <SettingsRow
          label={t.t("profile.timeFormat")}
          note={t.t(
            clock === "eth"
              ? "profile.timeExampleEth"
              : "profile.timeExampleEat",
          )}
        >
          <Segmented<ClockConvention>
            value={clock}
            onChange={setClock}
            size="sm"
            fill="ground"
            options={[
              { value: "eat", label: "EAT 24h" },
              { value: "eth", label: t.t("profile.ethiopianClock") },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label={t.t("profile.calendar")}
          note={t.t(
            calendar === "ethiopian"
              ? "profile.calendarExampleEthiopian"
              : "profile.calendarExampleGregorian",
          )}
        >
          <Segmented<CalendarSystem>
            value={calendar}
            onChange={setCalendar}
            size="sm"
            fill="ground"
            options={[
              { value: "gregorian", label: t.t("profile.gregorian") },
              { value: "ethiopian", label: t.t("profile.ethiopianCalendar") },
            ]}
          />
        </SettingsRow>

        <Switch
          checked={dataSaver}
          onChange={setDataSaver}
          label={t.t("profile.dataSaver")}
          note={t.t("profile.dataSaverBody")}
          className="border-divider min-h-14 border-b px-4"
        />
      </div>

      {player && (
        <>
          <SettingsSection>{t.t("profile.notifications")}</SettingsSection>
          <div className="border-divider border-t">
            {notificationRows.map((row, index) => (
              <Switch
                key={row.label}
                checked={notifications[index]}
                onChange={() => toggleNotification(index)}
                label={row.label}
                note={row.note}
                size="lg"
                className="border-divider min-h-14 border-b px-4"
              />
            ))}
          </div>
        </>
      )}

      <SettingsSection>{t.t("profile.support")}</SettingsSection>
      <div className="border-divider border-t">
        <Link
          href={routes.telegram}
          className="border-divider text-text flex min-h-14 items-center gap-3 border-b px-4 no-underline"
        >
          <Send
            size={20}
            strokeWidth={1.5}
            aria-hidden
            className="text-accent shrink-0"
          />
          <span className="flex-1">
            <span className="block font-semibold">
              {t.t("profile.telegramChat")}
            </span>
            <span className="text-muted block text-[11px]">
              {t.t("profile.telegramHandle")}
            </span>
          </span>
        </Link>
        <a
          href="tel:0000"
          className="border-divider text-text flex min-h-14 items-center gap-3 border-b px-4 no-underline"
        >
          <Phone
            size={20}
            strokeWidth={1.5}
            aria-hidden
            className="text-accent shrink-0"
          />
          <span className="flex-1">
            <span className="block font-semibold">
              {t.t("profile.callSupport")}
            </span>
            <span className="text-muted block text-[11px]">
              {t.t("profile.supportHours")}
            </span>
          </span>
        </a>
      </div>

      <div className="flex flex-wrap gap-x-[18px] gap-y-2 px-4 pt-4.5 text-xs">
        <Link href={routes.terms} className="text-accent">
          {t.t("footer.terms")}
        </Link>
        <Link href={routes.privacy} className="text-accent">
          {t.t("footer.privacy")}
        </Link>
        <span className="text-muted">{t.t("profile.licence")}</span>
      </div>

      {player && (
        <div className="px-4 pt-4.5">
          <button
            type="button"
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => router.push(routes.home),
              })
            }
            className="bg-raised text-text font-body h-12 w-full cursor-pointer rounded-md text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.t("profile.logOut")}
          </button>
        </div>
      )}

      <div className="border-divider text-muted mt-6 flex items-center gap-3 border-t px-4 pt-4.5 pb-6 text-[11px]">
        <span className="border-text text-text shrink-0 border-[1.5px] px-1.5 py-px font-bold">
          {LICENCE.minimumAge}+
        </span>
        <span>{t.t("profile.footer")}</span>
      </div>
    </div>
  );
}
