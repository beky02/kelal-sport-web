"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { routes } from "@/config/routes";
import { useLongDateTimeText } from "@/lib/i18n/use-long-date-time-text";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { Exclusion } from "../types";

/**
 * The break the API started, and when it ends — its `ends_at`, never worked
 * out here. The API revoked every session as it answered, so the player is
 * signed out; nothing in the browser can bring the session or the betting
 * back before the end (AC-6). Focus comes here, so the answer is read out.
 */
export function BreakStarted({ exclusion }: { exclusion: Exclusion }) {
  const t = useTranslation();
  const endText = useLongDateTimeText();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const timeOut = exclusion.kind === "time_out";
  const body = exclusion.endsAt
    ? t.t(timeOut ? "rg.breakStartedBody" : "rg.exclusionStartedBody", {
        date: endText(exclusion.endsAt),
      })
    : t.t("rg.exclusionStartedPermanent");

  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center xl:col-span-2">
      <div className="bg-raised text-accent grid size-13 place-items-center rounded-lg">
        <ShieldCheck size={24} strokeWidth={1.5} aria-hidden />
      </div>
      <h2
        ref={heading}
        tabIndex={-1}
        className="font-display mt-2 text-lg outline-none"
      >
        {t.t(timeOut ? "rg.breakStartedTitle" : "rg.exclusionStartedTitle")}
      </h2>
      <p className="text-muted max-w-[320px] text-pretty">{body}</p>
      <Link
        href={routes.home}
        className="border-divider text-text font-body mt-1.5 inline-flex min-h-11 items-center rounded-md border bg-transparent px-4 text-[13px] font-bold"
      >
        {t.t("wallet.backToSports")}
      </Link>
    </div>
  );
}
