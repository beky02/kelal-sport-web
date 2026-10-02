"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { BetSlip } from "@/features/bet-slip/components/BetSlip";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { MyBetsView } from "@/features/bets/components/MyBetsView";
import { useBets } from "@/features/bets/hooks/use-bets";
import { useUiStore, type AsidePanel as Panel } from "@/stores/ui.store";
import { cn } from "@/lib/utils/cn";

/**
 * The sportsbook's right-hand column: the slip, or what is already running.
 *
 * Two tabs rather than two places, because the question "what have I got on?"
 * comes up while building the next bet — sending someone to another page to
 * answer it would cost them the slip they were in the middle of.
 */
export function AsidePanel() {
  const t = useTranslation();
  const panel = useUiStore((s) => s.asidePanel);
  const setPanel = useUiStore((s) => s.setAsidePanel);

  const selectionCount = useBetSlipStore((s) => s.selections.length);
  const { isGuest } = useSession();
  const openAuth = useAuthStore((s) => s.open);
  // A guest has no bets to count, so this stays idle until they sign in.
  const { data: bets } = useBets("open");
  const openBets = isGuest ? 0 : (bets?.counts.open ?? 0);

  const tabs: Array<{ value: Panel; label: string; count: number }> = [
    { value: "slip", label: t.t("betSlip.title"), count: selectionCount },
    { value: "bets", label: t.t("betSlip.myBets"), count: openBets },
  ];

  const select = (next: Panel) => {
    // Nothing to show a guest under My bets — ask them to log in instead.
    if (next === "bets" && isGuest) return openAuth("login");
    setPanel(next);
  };

  return (
    <>
      <div className="bg-raised grid grid-cols-2 gap-1 p-1.5">
        {tabs.map((tab) => {
          const active = tab.value === panel;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() => select(tab.value)}
              className={cn(
                "font-body flex h-[34px] cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[13px] font-bold",
                active ? "bg-surface text-text" : "text-muted hover:text-text",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-[5px] text-[10px] font-extrabold",
                  active ? "bg-accent text-on-accent" : "bg-ground text-muted",
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {panel === "slip" ? <BetSlip /> : <MyBetsView compact />}
    </>
  );
}
