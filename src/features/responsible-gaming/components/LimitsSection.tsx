"use client";

import { TriangleAlert } from "lucide-react";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useLimits } from "../hooks/use-responsible-gaming";
import { LIMIT_TYPES } from "../types";
import { LimitCard } from "./LimitCard";

/**
 * The player's four kinds of limit, read from the account — never from this
 * browser, so a limit set on one device is the one every other shows (AC-1).
 * A failed read says so with Try again; a refetch that fails later keeps the
 * limits already on screen.
 */
export function LimitsSection() {
  const t = useTranslation();
  const limits = useLimits(true);

  if (limits.isPending) {
    return (
      <>
        {LIMIT_TYPES.map((type) => (
          <Skeleton key={type} className="mx-4 mt-4.5 h-56 rounded-lg" />
        ))}
      </>
    );
  }

  if (!limits.data) {
    return (
      <div className="xl:col-span-2">
        <StateMessage
          icon={<TriangleAlert size={24} strokeWidth={1.5} />}
          title={t.t("rg.limitsFailedTitle")}
          body={t.t("rg.limitsFailedBody")}
          action={{
            label: t.t("common.retry"),
            onClick: () => void limits.refetch(),
          }}
        />
      </div>
    );
  }

  return (
    <>
      <p className="text-muted mx-4 mt-3.5 text-xs text-pretty xl:col-span-2">
        {t.t("rg.increaseNote")}
      </p>
      {LIMIT_TYPES.map((type) => (
        <div key={type} className="mx-4 mt-3.5">
          <LimitCard type={type} limits={limits.data} />
        </div>
      ))}
    </>
  );
}
