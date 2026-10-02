"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { ODDS_POLICIES, type OddsPolicy } from "../types";

/**
 * "When odds change": the odds policy the bet is placed with — ask me, take a
 * better price, or take any price (C08 §7). It starts at the tenant's
 * `default_odds_policy`, and the slip asks about exactly the moves the engine
 * would refuse under it.
 *
 * A native select rather than pills: three Amharic labels do not fit side by
 * side in the slip, and a phone shows its own picker.
 */
export function OddsPolicySetting({
  value,
  onChange,
}: {
  value: OddsPolicy;
  onChange: (policy: OddsPolicy) => void;
}) {
  const t = useTranslation();
  const id = useId();
  const label: Record<OddsPolicy, string> = {
    none: t.t("betSlip.oddsPolicy.none"),
    higher: t.t("betSlip.oddsPolicy.higher"),
    any: t.t("betSlip.oddsPolicy.any"),
  };

  return (
    <div className="flex min-h-12 items-center justify-between gap-3">
      <label htmlFor={id} className="text-[13px]">
        {t.t("betSlip.oddsPolicy.label")}
      </label>
      <span className="relative max-w-[60%] min-w-0">
        <select
          id={id}
          value={value}
          onChange={(event) => {
            const next = ODDS_POLICIES.find((p) => p === event.target.value);
            if (next) onChange(next);
          }}
          className="bg-raised text-text font-body h-11 w-full cursor-pointer appearance-none truncate rounded-md pr-9 pl-3 text-[13px] font-semibold"
        >
          {ODDS_POLICIES.map((policy) => (
            <option key={policy} value={policy}>
              {label[policy]}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          aria-hidden
          className="text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
        />
      </span>
    </div>
  );
}
