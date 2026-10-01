"use client";

import { useState } from "react";
import { BookOpen, Phone, Send, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { routes } from "@/config/routes";
import { SYSTEM } from "@/config/constants";
import {
  useResponsibleGamingStatus,
  useStartBreak,
} from "../hooks/use-responsible-gaming";
import Link from "next/link";
import { ChoiceTiles } from "./ChoiceTiles";
import { LimitCard } from "./LimitCard";
import { SystemDialog } from "@/features/system/components/SystemDialog";

type Period = "daily" | "weekly" | "monthly";
type BreakLength = "24h" | "7d" | "30d";
type ExclusionLength = "6m" | "1y" | "permanent";

/**
 * The limits, breaks and exclusions.
 *
 * Nothing here is buried behind a confirmation the user can click through by
 * habit: a break or an exclusion asks once, in full sentences, and says plainly
 * that it cannot be undone early. Taking a break switches on the same cool-off
 * the reality check uses, so the banner appears and every price locks.
 *
 * The limits are local state for now. They belong to the account and must move to
 * the backend before launch — a limit that lives in one browser is not a limit.
 */
export function ResponsibleGamingView() {
  const t = useTranslation();
  const { data: status } = useResponsibleGamingStatus();
  const startBreak = useStartBreak();

  const [period, setPeriod] = useState<Period>("daily");
  const [depositLimits, setDepositLimits] = useState<Record<Period, number>>({
    daily: 2000,
    weekly: 5000,
    monthly: 15000,
  });
  const [saved, setSaved] = useState(false);
  const [lossLimit, setLossLimit] = useState(1500);

  const [sessionReminder, setSessionReminder] = useState(true);
  const [interval, setInterval] = useState("60");

  const [breakLength, setBreakLength] = useState<BreakLength>("24h");
  const [exclusion, setExclusion] = useState<ExclusionLength>("6m");
  const [asking, setAsking] = useState<"break" | "exclusion" | null>(null);

  const usedByPeriod: Record<Period, number> = {
    daily: 500,
    weekly: 1450,
    monthly: 2450,
  };

  const breakLabel: Record<BreakLength, string> = {
    "24h": t.t("rg.break24h"),
    "7d": t.t("rg.break7d"),
    "30d": t.t("rg.break30d"),
  };
  const exclusionLabel: Record<ExclusionLength, string> = {
    "6m": t.t("rg.exclude6m"),
    "1y": t.t("rg.exclude1y"),
    permanent: t.t("rg.excludePermanent"),
  };

  const confirm = () => {
    if (asking !== null) {
      // Recorded on the account, not in this tab: the same lock the reality check
      // sets, and the same one the board reads.
      startBreak.mutate({
        kind: asking === "exclusion" ? "self-exclusion" : "cool-off",
        until:
          asking === "exclusion"
            ? exclusionLabel[exclusion]
            : SYSTEM.coolOff.until,
      });
    }
    setAsking(null);
  };

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

      {/* Read from the account, so it is still here after a reload — and it says
          which of the two is running, since they are not the same commitment. */}
      {(status?.selfExcludedUntil ?? status?.coolOffUntil) != null && (
        <div
          role="status"
          className="border-accent bg-surface mx-4 mt-3.5 rounded-md border px-3 py-2.5 font-semibold xl:col-span-2"
        >
          {status?.selfExcludedUntil
            ? t.t("rg.activeExclusion", { period: status.selfExcludedUntil })
            : t.t("rg.activeBreak", { period: status!.coolOffUntil! })}
        </div>
      )}

      <Card className="mx-4 mt-4 flex flex-col gap-2.5 p-3.5 xl:col-span-2">
        <div className="text-muted text-[11px] font-semibold tracking-[0.1em] uppercase">
          {t.t("rg.thisMonth")}
        </div>
        <div className="numeric grid grid-cols-2 gap-3">
          <div>
            <div className="text-muted text-[11px]">{t.t("rg.deposited")}</div>
            <div className="font-display text-xl leading-[1.1]">
              {t.money(2450)}
            </div>
          </div>
          <div>
            <div className="text-muted text-[11px]">{t.t("rg.netLoss")}</div>
            <div className="font-display text-loss text-xl leading-[1.1]">
              {t.money(610)}
            </div>
          </div>
        </div>
        <div className="text-muted text-[11px]">{t.t("rg.monthSummary")}</div>
      </Card>

      <div className="mx-4 mt-4.5">
        <LimitCard
          title={t.t("rg.depositLimit")}
          amount={depositLimits[period]}
          used={usedByPeriod[period]}
          onAmountChange={(amount) => {
            setDepositLimits((current) => ({ ...current, [period]: amount }));
            setSaved(false);
          }}
          note={t.t("rg.increaseNote")}
          footer={
            <button
              type="button"
              onClick={() => setSaved(true)}
              className="bg-raised text-text font-body h-11 cursor-pointer rounded-md text-sm font-bold"
            >
              {t.t(saved ? "rg.saved" : "rg.saveLimit")}
            </button>
          }
        >
          <Segmented<Period>
            value={period}
            onChange={(next) => {
              setPeriod(next);
              setSaved(false);
            }}
            options={[
              { value: "daily", label: t.t("rg.daily") },
              { value: "weekly", label: t.t("rg.weekly") },
              { value: "monthly", label: t.t("rg.monthly") },
            ]}
          />
        </LimitCard>
      </div>

      <div className="mx-4 mt-4.5">
        <LimitCard
          title={t.t("rg.lossLimit")}
          aside={t.t("rg.monthly")}
          amount={lossLimit}
          used={610}
          onAmountChange={setLossLimit}
          note={t.t("rg.lossNote")}
        />
      </div>

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

      <Card className="mx-4 mt-4.5 flex flex-col gap-3 p-3.5">
        <div>
          <div className="font-display text-base">{t.t("rg.takeBreak")}</div>
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
        <button
          type="button"
          onClick={() => setAsking("break")}
          className="bg-raised text-text font-body h-11 cursor-pointer rounded-md text-sm font-bold"
        >
          {t.t("rg.startBreak")}
        </button>
      </Card>

      <Card className="mx-4 mt-4.5 flex flex-col gap-3 p-3.5">
        <div>
          <div className="font-display text-base">
            {t.t("rg.selfExclusion")}
          </div>
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
            { value: "permanent", label: exclusionLabel.permanent },
          ]}
        />
        <button
          type="button"
          onClick={() => setAsking("exclusion")}
          className="bg-raised text-text font-body h-11 cursor-pointer rounded-md text-sm font-bold"
        >
          {t.t("rg.selfExclude")}
        </button>
      </Card>

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
          asking === "exclusion"
            ? exclusion === "permanent"
              ? t.t("rg.excludeConfirmTitlePermanent")
              : t.t("rg.excludeConfirmTitle", {
                  period: exclusionLabel[exclusion],
                })
            : t.t("rg.breakConfirmTitle", { period: breakLabel[breakLength] })
        }
        body={t.t(
          asking === "exclusion"
            ? "rg.excludeConfirmBody"
            : "rg.breakConfirmBody",
        )}
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
