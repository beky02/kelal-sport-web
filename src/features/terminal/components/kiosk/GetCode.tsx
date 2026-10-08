"use client";

import { Loader2, QrCode } from "lucide-react";
import {
  AlertList,
  type SlipAlert,
} from "@/features/bet-slip/components/AlertList";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useCountdown } from "@/features/auth/hooks/use-countdown";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { useGetCode } from "../../hooks/use-slip-code";
import { minutesLeft } from "../../lib/slip-code";
import { useKioskStore } from "../../stores/kiosk.store";
import type { SlipCodeRequest } from "../../types";

/**
 * Get code (F8cc), at the foot of the kiosk's slip in Book bet's place (the
 * user's answer at the gate): the slip on screen turned into a slip code for
 * the counter. Off while the slip can't be one (`request` null: Book bet's
 * rule), while one is on its way, and while the terminal waits out its limit
 * — which it says, counting down in minutes (decision 6). Under it, why the
 * last Get code of this slip failed, with the fix where there is one: the
 * server's stake as a tap. A pick it refused is marked in the slip itself.
 */
export function GetCode(props: {
  request: SlipCodeRequest | null;
  code: ReturnType<typeof useGetCode>;
}) {
  const until = useKioskStore((s) => s.codesPausedUntil);
  // A new wait counts from its own start (the countdown reads its deadline
  // when it mounts).
  return <GetCodeButton key={until ?? "none"} until={until} {...props} />;
}

function GetCodeButton({
  until,
  request,
  code,
}: {
  until: number | null;
  request: SlipCodeRequest | null;
  code: ReturnType<typeof useGetCode>;
}) {
  const t = useTranslation();
  const setStake = useBetSlipStore((s) => s.setStake);
  const { remaining, elapsed } = useCountdown(until);
  const waiting = until !== null && !elapsed;
  const off = !request || code.sending || waiting;

  const alerts: SlipAlert[] = [];
  if (waiting) {
    alerts.push({
      id: "paused",
      tone: "warn",
      title: t.t("terminal.code.paused", {
        minutes: minutesLeft(remaining),
      }),
    });
  } else {
    const refusal = code.refusalFor(request);
    if (refusal?.kind === "paused") {
      // A wait the API gave no length for: said, without holding Get code.
      if (refusal.retryAfter === null || refusal.retryAfter <= 0) {
        alerts.push({
          id: "paused",
          tone: "warn",
          title: t.t("terminal.code.pausedLater"),
        });
      }
    } else if (refusal?.kind === "stake") {
      alerts.push({
        id: "stake",
        tone: "error",
        title: t.t(refusal.key, { amount: t.money(refusal.amount) }),
        action: {
          label: t.t("betSlip.setMax", { amount: t.number(refusal.amount) }),
          onClick: () => setStake(refusal.amount),
        },
      });
    } else if (refusal?.kind === "status" || refusal?.kind === "message") {
      alerts.push({ id: "refused", tone: "error", title: t.t(refusal.key) });
    }
  }

  return (
    <>
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => {
            if (!off && request) code.getCode(request);
          }}
          aria-disabled={off}
          aria-busy={code.sending}
          className="bg-accent text-on-accent font-body flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold aria-disabled:cursor-not-allowed aria-disabled:opacity-45"
        >
          {code.sending ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <QrCode size={16} aria-hidden />
          )}
          {t.t("terminal.code.get")}
        </button>
      </div>
      {alerts.length > 0 && (
        <div className="pt-2">
          <AlertList alerts={alerts} />
        </div>
      )}
    </>
  );
}
