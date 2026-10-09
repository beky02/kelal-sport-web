"use client";

import { useId, useState, type RefObject } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";
import { routes } from "@/config/routes";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useRedeemPromoCode } from "../hooks/use-promotions";

/** The contract's `maxLength` for a code. */
const CODE_MAX = 32;

const SECONDARY =
  "bg-surface text-text font-body inline-flex min-h-11 cursor-pointer items-center rounded-md px-3.5 text-xs font-bold no-underline";

/**
 * Redeem a promo code (AC-12). One intent, one key: Redeem sends what was
 * typed; while a code has no answer, Try again — or Redeem with that same
 * code — sends it again with its key, so it is never used twice. What comes
 * back is said in words: the API's own message on success, or what it
 * refused and the fix (change the code, verify an ID). Nothing is added in
 * the browser; the bonus and the wallet are read again.
 */
export function PromoCodeForm({
  owner,
  fieldRef,
}: {
  /** The signed-in player the code is for. */
  owner: string;
  /** The field, for an offer's Enter code. */
  fieldRef: RefObject<HTMLInputElement | null>;
}) {
  const t = useTranslation();
  const field = useId();
  const help = useId();
  const openAuth = useAuthStore((s) => s.open);
  const refusal = useId();
  const unconfirmed = useId();
  const { open, sending, unanswered, answer, redeem, dismiss } =
    useRedeemPromoCode(owner);
  // A code on its way, unanswered or refused is still there when the player
  // comes back.
  const [value, setValue] = useState(
    () => open ?? (answer?.kind === "refused" ? answer.code : ""),
  );
  const refused = answer?.kind === "refused" ? answer.notice : null;

  // Granted or waiting for a deposit, here or while the player was away: the
  // field is ready for another code.
  const [seen, setSeen] = useState(answer);
  if (answer !== seen) {
    setSeen(answer);
    if (answer?.kind === "answered") setValue("");
  }

  /** Sends a code. Refused with a code to fix: the field, to fix it. */
  const send = (code: string) =>
    redeem(code, {
      onRefused: (notice) => {
        if (notice.fix === "edit") fieldRef.current?.focus();
      },
    });

  return (
    <form
      className="px-4 pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!sending) send(value);
      }}
    >
      <label htmlFor={field} className="label-caps text-muted block">
        {t.t("promotions.codeLabel")}
      </label>
      <p id={help} className="text-muted pt-0.5 text-xs">
        {t.t("promotions.codeHelp")}
      </p>
      <div className="mt-2 flex gap-2">
        <input
          ref={fieldRef}
          id={field}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (answer) dismiss();
          }}
          maxLength={CODE_MAX}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          // A refusal to fix is said again whenever the field is reached.
          aria-describedby={
            refused?.fix === "edit" ? `${help} ${refusal}` : help
          }
          aria-invalid={refused?.fix === "edit" || undefined}
          // Monospace with a slashed zero: O and 0 must look different in a
          // code (review U1).
          className="bg-ground border-border text-text aria-invalid:border-loss h-12 min-w-0 flex-1 rounded-md border px-3 font-mono text-base font-semibold slashed-zero"
        />
        <button
          type="submit"
          aria-busy={sending || undefined}
          aria-disabled={sending || undefined}
          className="bg-accent text-on-accent font-body h-12 shrink-0 cursor-pointer rounded-md px-4 text-sm font-bold aria-disabled:cursor-wait aria-disabled:opacity-60"
        >
          {t.t(sending ? "promotions.redeeming" : "promotions.redeem")}
        </button>
      </div>

      {unanswered !== null && !sending && (
        <div
          role="alert"
          className="bg-warn-bg mt-3 flex flex-col gap-2 rounded-lg p-3.5"
        >
          <p
            id={unconfirmed}
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <CircleAlert
              size={18}
              strokeWidth={1.5}
              aria-hidden
              className="text-warn shrink-0"
            />
            {t.t("promotions.unconfirmedTitle")}
          </p>
          <p className="text-muted text-xs">
            {t.t("promotions.unconfirmedBody")}
          </p>
          <div>
            <button
              type="button"
              aria-describedby={unconfirmed}
              onClick={() => {
                // This button goes while the try is out: focus waits in the
                // field rather than falling to the page.
                fieldRef.current?.focus();
                setValue(unanswered);
                send(unanswered);
              }}
              className={SECONDARY}
            >
              {t.t("common.retry")}
            </button>
          </div>
        </div>
      )}

      {refused && (
        <div
          id={refusal}
          role="alert"
          className="bg-loss-bg mt-3 flex flex-col gap-1.5 rounded-lg p-3.5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CircleAlert
              size={18}
              strokeWidth={1.5}
              aria-hidden
              className="text-loss shrink-0"
            />
            {t.t(refused.title)}
          </p>
          {refused.body && (
            <p className="text-muted text-xs">{t.t(refused.body)}</p>
          )}
          {refused.detail && (
            <p className="text-muted text-xs">{refused.detail}</p>
          )}
          {refused.fix === "verify" && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => openAuth("verify")}
                className={SECONDARY}
              >
                {t.t("profile.verify")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Always there, so the answer is read out when it lands. */}
      <div role="status">
        {answer?.kind === "answered" && (
          <div className="bg-win-bg mt-3 flex flex-col gap-2 rounded-lg p-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CircleCheck
                size={18}
                strokeWidth={1.5}
                aria-hidden
                className="text-win shrink-0"
              />
              {answer.result.message ??
                t.t(
                  answer.result.result === "pending_deposit"
                    ? "promotions.pendingDeposit"
                    : "promotions.granted",
                )}
            </p>
            {answer.result.result === "pending_deposit" && (
              <div>
                <Link
                  href={routes.walletAction("deposit")}
                  className={SECONDARY}
                >
                  {t.t("header.deposit")}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
