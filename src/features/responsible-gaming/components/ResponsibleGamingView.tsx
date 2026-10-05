"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Loader2, Phone, Send, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils/cn";
import { routes } from "@/config/routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { SystemDialog } from "@/features/system/components/SystemDialog";
import { useSelfExclude } from "../hooks/use-responsible-gaming";
import { exclusionOutcome, isProblem } from "../lib/break";
import type { ExclusionKind, SelfExclusionRequest } from "../types";
import { BreakStarted } from "./BreakStarted";
import { ChoiceTiles } from "./ChoiceTiles";
import { LimitsSection } from "./LimitsSection";

type BreakLength = "24h" | "7d" | "30d";
type ExclusionLength = "6m" | "1y" | "5y" | "permanent";

/**
 * The limits, breaks and exclusions — all of them the account's, none of them
 * this browser's.
 *
 * The limits are read from `/v1/me/limits` and changed through it, and the
 * API decides when a change applies (AC-1, AC-5). Nothing here is buried
 * behind a confirmation the user can click through by habit: a break or an
 * exclusion asks once, in full sentences, and says plainly that it cannot be
 * undone early. The API revokes every session as it starts one, so the player
 * leaves signed out, shown when it ends (AC-6); whether one is in force is
 * `/api/me`'s to say, so the banner, the locked slip and the paused deposits
 * come back after any reload.
 */
export function ResponsibleGamingView() {
  const t = useTranslation();
  const session = useSession();
  const openAuth = useAuthStore((s) => s.open);
  const selfExclusion = useSelfExclude();

  const [sessionReminder, setSessionReminder] = useState(true);
  const [interval, setInterval] = useState("60");

  const [breakLength, setBreakLength] = useState<BreakLength>("24h");
  const [exclusion, setExclusion] = useState<ExclusionLength>("6m");
  const [asking, setAsking] = useState<ExclusionKind | null>(null);

  const breakLabel: Record<BreakLength, string> = {
    "24h": t.t("rg.break24h"),
    "7d": t.t("rg.break7d"),
    "30d": t.t("rg.break30d"),
  };
  const exclusionLabel: Record<ExclusionLength, string> = {
    "6m": t.t("rg.exclude6m"),
    "1y": t.t("rg.exclude1y"),
    "5y": t.t("rg.exclude5y"),
    permanent: t.t("rg.excludePermanent"),
  };

  const confirm = () => {
    if (asking === null) return;
    const request: SelfExclusionRequest =
      asking === "self_exclusion"
        ? { kind: "self_exclusion", duration: exclusion }
        : { kind: "time_out", duration: breakLength };
    setAsking(null);
    selfExclusion.start(request);
  };

  const started = selfExclusion.started;

  return (
    <div className="grid w-full items-start xl:grid-cols-2">
      <div className="flex flex-col gap-1.5 px-4 pt-4.5 xl:col-span-2">
        <div className="flex items-center gap-2.5">
          <ShieldCheck
            size={26}
            strokeWidth={1.5}
            aria-hidden
            className="text-accent shrink-0"
          />
          <h2 className="text-[22px]">{t.t("rg.title")}</h2>
        </div>
        <p className="text-muted text-pretty">{t.t("rg.intro")}</p>
      </div>

      {started ? (
        // The API started it and revoked the session: this is what is left
        // to say, whoever is signed in now.
        <BreakStarted exclusion={started} />
      ) : session.isLoading ? (
        <div className="flex flex-col gap-3 p-4 xl:col-span-2">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      ) : session.isGuest ? (
        <div className="mx-4 mt-4 flex flex-col items-start gap-2 xl:col-span-2">
          <h3 className="font-display text-base">{t.t("rg.guestTitle")}</h3>
          <p className="text-muted text-sm text-pretty">
            {t.t("rg.guestBody")}
          </p>
          <button
            type="button"
            onClick={() => openAuth("login")}
            className="bg-accent text-on-accent font-body mt-1 h-11 cursor-pointer rounded-md px-5 text-sm font-bold"
          >
            {t.t("auth.logIn")}
          </button>
        </div>
      ) : (
        <>
          <LimitsSection />

          <Card className="mx-4 mt-4.5 flex flex-col gap-3 p-3.5">
            <div>
              <h3 className="font-display text-base">{t.t("rg.takeBreak")}</h3>
              <p className="text-muted text-xs text-pretty">
                {t.t("rg.takeBreakBody")}
              </p>
            </div>
            <ChoiceTiles<BreakLength>
              label={t.t("rg.takeBreak")}
              value={breakLength}
              onChange={setBreakLength}
              options={[
                { value: "24h", label: breakLabel["24h"] },
                { value: "7d", label: breakLabel["7d"] },
                { value: "30d", label: breakLabel["30d"] },
              ]}
            />
            <AskButton
              label={t.t("rg.startBreak")}
              onClick={() => setAsking("time_out")}
              pending={selfExclusion.isPending}
              busy={selfExclusion.request?.kind === "time_out"}
            />
            {selfExclusion.request?.kind === "time_out" && (
              <ExclusionProblem
                error={selfExclusion.error}
                pending={selfExclusion.isPending}
                onRetry={() => selfExclusion.start(selfExclusion.request!)}
              />
            )}
          </Card>

          <Card className="mx-4 mt-4.5 flex flex-col gap-3 p-3.5">
            <div>
              <h3 className="font-display text-base">
                {t.t("rg.selfExclusion")}
              </h3>
              <p className="text-muted text-xs text-pretty">
                {t.t("rg.selfExclusionBody")}
              </p>
            </div>
            <ChoiceTiles<ExclusionLength>
              label={t.t("rg.selfExclusion")}
              value={exclusion}
              onChange={setExclusion}
              options={[
                { value: "6m", label: exclusionLabel["6m"] },
                { value: "1y", label: exclusionLabel["1y"] },
                { value: "5y", label: exclusionLabel["5y"] },
                { value: "permanent", label: exclusionLabel.permanent },
              ]}
            />
            <AskButton
              label={t.t("rg.selfExclude")}
              onClick={() => setAsking("self_exclusion")}
              pending={selfExclusion.isPending}
              busy={selfExclusion.request?.kind === "self_exclusion"}
            />
            {selfExclusion.request?.kind === "self_exclusion" && (
              <ExclusionProblem
                error={selfExclusion.error}
                pending={selfExclusion.isPending}
                onRetry={() => selfExclusion.start(selfExclusion.request!)}
              />
            )}
          </Card>

          {/* The reality check's interval: F7b moves it to the account. */}
          <Card className="mx-4 mt-4.5 flex flex-col gap-3 p-3.5">
            <Switch
              checked={sessionReminder}
              onChange={setSessionReminder}
              size="lg"
              label={
                <span className="font-display text-base">
                  {t.t("rg.sessionReminder")}
                </span>
              }
              note={t.t("rg.sessionReminderBody")}
            />
            {sessionReminder && (
              <Segmented
                value={interval}
                onChange={setInterval}
                options={["30", "60", "90", "120"].map((n) => ({
                  value: n,
                  label: t.t("rg.minutes", { n }),
                }))}
              />
            )}
          </Card>
        </>
      )}

      <div className="mx-4 mt-5.5 mb-7 flex flex-col xl:col-span-2">
        <div className="font-display mb-1.5 text-base">
          {t.t("rg.needToTalk")}
        </div>

        <a
          href="tel:0000"
          className="border-divider text-text flex min-h-14 items-center gap-3 border-t no-underline"
        >
          <Phone
            size={20}
            strokeWidth={1.5}
            aria-hidden
            className="text-accent shrink-0"
          />
          <span className="flex-1">
            <span className="block font-semibold">{t.t("rg.helpline")}</span>
            <span className="text-muted block text-[11px]">
              {t.t("rg.helplineValue")}
            </span>
          </span>
        </a>

        <Link
          href={routes.telegram}
          className="border-divider text-text flex min-h-14 items-center gap-3 border-t font-semibold no-underline"
        >
          <Send
            size={20}
            strokeWidth={1.5}
            aria-hidden
            className="text-accent shrink-0"
          />
          <span className="flex-1">{t.t("rg.telegramSupport")}</span>
        </Link>

        <Link
          href={routes.help}
          className="border-divider text-text flex min-h-14 items-center gap-3 border-y font-semibold no-underline"
        >
          <BookOpen
            size={20}
            strokeWidth={1.5}
            aria-hidden
            className="text-accent shrink-0"
          />
          <span className="flex-1">{t.t("rg.resources")}</span>
        </Link>
      </div>

      <SystemDialog
        open={asking !== null}
        icon={<ShieldCheck size={22} strokeWidth={1.6} />}
        title={
          asking === "self_exclusion"
            ? exclusion === "permanent"
              ? t.t("rg.excludeConfirmTitlePermanent")
              : t.t("rg.excludeConfirmTitle", {
                  period: exclusionLabel[exclusion],
                })
            : t.t("rg.breakConfirmTitle", { period: breakLabel[breakLength] })
        }
        body={t.t(
          asking === "self_exclusion"
            ? exclusion === "permanent"
              ? "rg.excludeConfirmBodyPermanent"
              : "rg.excludeConfirmBody"
            : "rg.breakConfirmBody",
        )}
        // A question that can't be undone opens on its safe answer: a stray
        // Enter goes back, it never confirms.
        initialFocus="quiet"
        actions={[
          { label: t.t("rg.confirm"), kind: "primary", onClick: confirm },
          {
            label: t.t("rg.goBack"),
            kind: "quiet",
            onClick: () => setAsking(null),
          },
        ]}
      />
    </div>
  );
}

/**
 * Opens the question. While a break is on its way both buttons wait — the one
 * that sent it says so — so a second question can't be asked and dropped.
 */
function AskButton({
  label,
  onClick,
  pending,
  busy,
}: {
  label: string;
  onClick: () => void;
  /** A break or self-exclusion is on its way. */
  pending: boolean;
  /** …and it is this button's. */
  busy: boolean;
}) {
  const t = useTranslation();
  const sending = pending && busy;
  return (
    <button
      type="button"
      onClick={pending ? undefined : onClick}
      aria-disabled={pending || undefined}
      aria-busy={sending || undefined}
      className={cn(
        "bg-raised text-text font-body flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold",
        sending
          ? "aria-disabled:cursor-wait"
          : "aria-disabled:cursor-not-allowed aria-disabled:opacity-45",
      )}
    >
      {sending && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {sending ? t.t("rg.startingBreak") : label}
    </button>
  );
}

/**
 * A break that didn't come back started: the API said no (nothing started),
 * or no answer came (it may have — if so, the session is gone and `/api/me`
 * turns the page to the guest's). A lost session says nothing here.
 */
function ExclusionProblem({
  error,
  pending,
  onRetry,
}: {
  error: Error | null;
  pending: boolean;
  onRetry: () => void;
}) {
  const t = useTranslation();
  if (!error || pending) return null;
  const outcome = exclusionOutcome(error);
  if (outcome === "session") return null;
  return (
    <div role="alert" className="bg-loss-bg flex flex-col gap-2 rounded-md p-3">
      <p className="text-xs font-bold">
        {t.t(
          outcome === "refused"
            ? "rg.breakNotStartedTitle"
            : "rg.breakUnconfirmedTitle",
        )}
      </p>
      <p className="text-text/80 text-xs">
        {outcome === "unanswered"
          ? t.t("rg.breakUnconfirmedBody")
          : // The API's own title — unless the answer wasn't a Problem, whose
            // only words are this app's technical ones.
            isProblem(error)
            ? error.message
            : t.t("rg.refusedBody")}
      </p>
      {outcome === "unanswered" && (
        <button
          type="button"
          onClick={onRetry}
          className="bg-raised text-text font-body min-h-11 cursor-pointer self-start rounded-lg px-3 text-xs font-bold"
        >
          {t.t("common.retry")}
        </button>
      )}
    </div>
  );
}
