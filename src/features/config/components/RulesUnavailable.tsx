"use client";

import { CircleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { usePublicConfig } from "../hooks/use-public-config";

/**
 * Says why figures show "—" when the tenant's rule set could not be loaded,
 * and offers to try again. Renders nothing while it loads or once it has.
 */
export function RulesUnavailable({ className }: { className?: string }) {
  const t = useTranslation();
  const config = usePublicConfig();
  if (!config.isError) return null;

  return (
    <div
      role="alert"
      className={`bg-loss-bg flex items-center gap-2.5 rounded-md py-2.5 pr-2 pl-3 ${className ?? ""}`}
    >
      <CircleAlert
        size={17}
        strokeWidth={1.5}
        aria-hidden
        className="text-loss shrink-0"
      />
      <span className="min-w-0 flex-1 font-bold">
        {t.t("betSlip.rulesFailed")}
      </span>
      <button
        type="button"
        onClick={() => void config.refetch()}
        className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
      >
        {t.t("common.retry")}
      </button>
    </div>
  );
}
