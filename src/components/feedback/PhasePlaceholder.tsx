"use client";

import Link from "next/link";
import { Construction } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Card } from "@/components/ui/Card";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { routes } from "@/config/routes";

/**
 * A route the navigation points at but a later phase will build.
 *
 * Here so that Deposit, My bets and Log in lead somewhere that explains itself
 * instead of a 404. Delete this component when the last placeholder route is
 * implemented — if it still exists, something is unfinished.
 */
export function PhasePlaceholder({ title }: { title: string }) {
  const t = useTranslation();

  return (
    <SportsbookShell>
      <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <div className="bg-raised text-muted grid size-13 place-items-center rounded-lg">
          <Construction size={24} strokeWidth={1.5} aria-hidden />
        </div>
        <h2 className="mt-2 text-xl">{title}</h2>
        <p className="font-display text-muted text-base">
          {t.t("common.comingTitle")}
        </p>
        <p className="text-muted max-w-[380px]">{t.t("common.comingBody")}</p>
        <Link
          href={routes.home}
          className="text-accent mt-2 text-[13px] font-bold"
        >
          {t.t("common.backToSportsbook")}
        </Link>
      </Card>
    </SportsbookShell>
  );
}
