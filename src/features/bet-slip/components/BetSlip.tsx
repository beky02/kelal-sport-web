"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n";
import { Switch } from "@/components/ui/Switch";
import { routes } from "@/config/routes";
import { ApiError } from "@/lib/api/errors";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useBetSlip } from "../hooks/use-bet-slip";
import { usePlaceBet } from "../hooks/use-place-bet";
import { useBetSlipStore } from "../stores/bet-slip.store";
import type { BetReceipt } from "../api/place-bet";
import { BetModeTabs } from "./BetModeTabs";
import { BetPlacedConfirmation } from "./BetPlacedConfirmation";
import { BetSelectionRow } from "./BetSelectionRow";
import { BetSlipHeader } from "./BetSlipHeader";
import { BookingCode, LoadBookingCode } from "./BookingCode";
import { EmptySlip } from "./EmptySlip";
import { PayoutSummary } from "./PayoutSummary";
import { PlaceBetButton } from "./PlaceBetButton";
import { SlipAlerts } from "./SlipAlerts";
import { StakeInput } from "./StakeInput";
import { TaxBreakdown } from "./TaxBreakdown";

/**
 * What a refusal from the engine means, by its Problem `code` — never by its
 * title, which is display text in whatever language the API chose.
 */
const PLACE_ERROR_BODY: Record<string, MessageKey> = {
  BET_RELATED_SELECTIONS: "betSlip.alerts.conflictBody",
  BET_MARKET_SUSPENDED: "betSlip.alerts.suspendedBody",
  BET_EVENT_STARTED: "betSlip.alerts.suspendedBody",
  VALIDATION_FAILED: "betSlip.errors.cannotPriceBody",
  RULES_UNAVAILABLE: "betSlip.rulesFailed",
};

/**
 * The bet slip.
 *
 * Same component in the desktop aside and the mobile sheet — only `onClose`
 * differs, because only the sheet can be dismissed. Every number on screen comes
 * from `useBetSlip`, and the confirmation comes from the engine's receipt.
 */
export function BetSlip({ onClose }: { onClose?: () => void }) {
  const t = useTranslation();
  const router = useRouter();

  const openAuth = useAuthStore((s) => s.open);
  const { totals, cta, isGuest, balance, rules, rulesState, retryRules } =
    useBetSlip();
  const selections = useBetSlipStore((s) => s.selections);
  const clear = useBetSlipStore((s) => s.clear);
  const acceptAnyChange = useBetSlipStore((s) => s.acceptAnyChange);
  const setAcceptAnyChange = useBetSlipStore((s) => s.setAcceptAnyChange);
  const setStake = useBetSlipStore((s) => s.setStake);

  const [receipt, setReceipt] = useState<BetReceipt | null>(null);
  const [booked, setBooked] = useState(false);
  const place = usePlaceBet(setReceipt);

  // The engine refused the stake and said what it would take, so the alert
  // can offer to set it rather than just reporting the problem.
  const rejection = place.error instanceof ApiError ? place.error : null;
  const stakeFix =
    rejection &&
    (rejection.code === "BET_STAKE_TOO_HIGH" ||
      rejection.code === "BET_STAKE_TOO_LOW")
      ? (rejection.errors.find((e) => e.field === "stake")?.limit ?? null)
      : null;

  /**
   * Stand-in for the code the backend would issue.
   *
   * Derived from the selections so it is stable while the slip is — a code that
   * changed on every render would be unreadable, and unusable at a shop counter.
   */
  const bookingCode = useMemo(() => {
    let hash = 5381;
    for (const selection of selections) {
      for (const character of selection.outcomeId) {
        hash = (Math.imul(hash, 33) + character.charCodeAt(0)) >>> 0;
      }
    }
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += alphabet[(hash >>> (i * 5)) % alphabet.length];
    }
    return `KS${code}`;
  }, [selections]);

  const conflicts = useMemo(
    () => new Set(totals.conflictEventIds),
    [totals.conflictEventIds],
  );
  const pending = useMemo(
    () => new Set(totals.pendingOddsChanges.map((s) => s.outcomeId)),
    [totals.pendingOddsChanges],
  );

  if (receipt) {
    return (
      <div className="bg-ground flex w-full flex-col">
        <BetSlipHeader count={totals.count} onClose={onClose} />
        <BetPlacedConfirmation
          receipt={receipt}
          onKeepSelections={() => setReceipt(null)}
          onDone={() => {
            setReceipt(null);
            clear();
            onClose?.();
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-ground flex w-full flex-col">
      <BetSlipHeader count={totals.count} onClose={onClose} />

      {totals.count > 0 && (
        <BetModeTabs
          mode={totals.mode}
          systemAvailable={totals.systemAvailable}
          systemK={totals.systemK}
          liveCount={totals.liveCount}
        />
      )}

      <SlipAlerts
        totals={totals}
        rules={rules?.calc ?? null}
        rulesState={rulesState}
        onRetryRules={retryRules}
      />

      {place.isError && (
        <div
          role="alert"
          className="bg-loss-bg mx-3 mb-2.5 flex items-center gap-2.5 rounded-md p-3"
        >
          <CircleAlert
            size={17}
            strokeWidth={1.5}
            aria-hidden
            className="text-loss shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="font-bold">{t.t("betSlip.placeFailed")}</div>
            <div className="text-muted text-xs">
              {stakeFix
                ? t.t(
                    rejection?.code === "BET_STAKE_TOO_LOW"
                      ? "betSlip.errors.stakeTooLowBody"
                      : "betSlip.errors.stakeTooHighBody",
                    { amount: t.money(stakeFix) },
                  )
                : t.t(
                    PLACE_ERROR_BODY[rejection?.code ?? ""] ??
                      "betSlip.placeFailedBody",
                  )}
            </div>
          </div>
          {/* A rejection the user can act on carries the fix, rather than
              leaving them to work out what number would be accepted. */}
          {stakeFix && (
            <button
              type="button"
              onClick={() => {
                setStake(stakeFix);
                place.reset();
              }}
              className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
            >
              {t.t("betSlip.setMax", { amount: t.number(stakeFix) })}
            </button>
          )}
        </div>
      )}

      {totals.count === 0 ? (
        <EmptySlip />
      ) : (
        <>
          <div className="bg-surface mx-3 overflow-hidden rounded-lg">
            {selections.map((selection, index) => (
              <BetSelectionRow
                key={selection.outcomeId}
                selection={selection}
                first={index === 0}
                conflict={conflicts.has(selection.eventId)}
                pending={pending.has(selection.outcomeId)}
              />
            ))}
          </div>

          <StakeInput
            totals={totals}
            quickStakes={rules?.quickStakes ?? []}
            balance={balance}
          />
          {rules ? (
            <>
              <TaxBreakdown totals={totals} rules={rules.calc} />
              <PayoutSummary totals={totals} rules={rules.calc} />
            </>
          ) : (
            rulesState === "loading" && (
              <p role="status" className="text-muted mx-4 mt-3 text-[11px]">
                {t.t("betSlip.rulesLoading")}
              </p>
            )
          )}

          <div className="px-4">
            <Switch
              checked={acceptAnyChange}
              onChange={setAcceptAnyChange}
              label={t.t("betSlip.acceptAnyChange")}
            />
          </div>

          {isGuest ? (
            <>
              {/* Booking is the alternative to signing up on the spot — the slip
                  keeps its value either way. */}
              <div className="grid grid-cols-2 gap-2 px-4 pt-1">
                <button
                  type="button"
                  onClick={() => setBooked(true)}
                  className="bg-raised text-text font-body h-12 cursor-pointer rounded-md text-sm font-bold"
                >
                  {t.t("betSlip.bookBet")}
                </button>
                <button
                  type="button"
                  onClick={() => openAuth("login")}
                  className="bg-accent text-on-accent font-body h-12 cursor-pointer rounded-md text-sm font-bold"
                >
                  {t.t("betSlip.loginToBet")}
                </button>
              </div>
              {booked && <BookingCode code={bookingCode} />}
              <div className="pb-2" />
            </>
          ) : (
            <PlaceBetButton
              action={cta.action}
              disabled={cta.disabled}
              totals={totals}
              pending={place.isPending}
              onPlace={() => place.mutate()}
              onDeposit={() => router.push(routes.walletAction("deposit"))}
              // A dialog, not a navigation: the slip they just built is the
              // reason they are logging in.
              onLogin={() => openAuth("login")}
            />
          )}
        </>
      )}

      {/* Somewhere to redeem a code: a guest with an empty slip is often someone
          who was handed one. */}
      {(isGuest || totals.count === 0) && <LoadBookingCode />}
    </div>
  );
}
