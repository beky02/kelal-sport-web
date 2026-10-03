"use client";

import { useId, useRef, useState } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { PhoneInput, SubmitButton } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { toE164 } from "@/features/auth/lib/phone";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import {
  useAddPayoutAccount,
  usePayoutAccounts,
  useRemovePayoutAccount,
} from "../hooks/use-withdrawals";
import type { PaymentMethod, PayoutAccount } from "../types";
import { PaymentNotice } from "./PaymentNotice";

/**
 * What the player chose to be paid to: one of their saved accounts — with
 * the number as the API masks it, to show on the next steps — or a number
 * as typed.
 */
export type AccountChoice =
  | { kind: "saved"; id: string; label: string }
  | { kind: "new"; digits: string };

/** The API's own words for a refusal, when it answered at all. */
const apiTitle = (error: unknown): string | null =>
  error instanceof ApiError && error.status >= 400 ? error.message : null;

/**
 * Where a withdrawal goes (`/v1/me/payout-accounts`): the player's saved
 * accounts for this method, each one removable once they say so — or another
 * mobile number, which Save keeps as an account straight away, and which a
 * withdrawal to it saves anyway (the contract's `account`).
 *
 * Accounts are a radio group of native radios, so arrow keys move between
 * them; Remove sits beside each, never inside the choice. With nothing saved
 * for this method the number is the only way on, so its field is open. A
 * list that couldn't load says so and offers Try again, and a new number
 * still works.
 */
export function AccountStep({
  method,
  choice,
  onChoice,
  onContinue,
}: {
  method: PaymentMethod;
  choice: AccountChoice | null;
  onChoice: (choice: AccountChoice | null) => void;
  onContinue: () => void;
}) {
  const t = useTranslation();
  // The wallet is only shown to a signed-in player.
  const accounts = usePayoutAccounts(true);
  const add = useAddPayoutAccount();
  const remove = useRemovePayoutAccount();
  /** The account Remove is asking about. */
  const [asking, setAsking] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const titleId = useId();
  const group = useId();
  const fieldId = useId();
  const problemId = useId();
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const title = useRef<HTMLHeadingElement>(null);

  const saved = (accounts.data ?? []).filter(
    (account) => account.provider === method.code,
  );
  const onlyNumber = !accounts.isPending && saved.length === 0;
  const typing = choice?.kind === "new" || onlyNumber;
  const digits = choice?.kind === "new" ? choice.digits : "";
  const number = toE164(digits);
  const invalid = typing && touched && digits.trim() !== "" && number === null;
  // A saved account chosen earlier counts while the list says it is there.
  const savedChoice =
    choice?.kind === "saved" &&
    (!accounts.data || saved.some((account) => account.id === choice.id));
  const ready = savedChoice || (typing && number !== null);

  const choose = (account: PayoutAccount) =>
    onChoice({ kind: "saved", id: account.id, label: account.accountMasked });

  const type = (value: string) => {
    if (add.isError) add.reset();
    onChoice({ kind: "new", digits: value });
  };

  const save = () => {
    if (!number || add.isPending) return;
    add.mutate(
      { provider: method.code, account: number },
      {
        onSuccess: choose,
      },
    );
  };

  const keep = (id: string) => {
    setAsking(null);
    remove.reset();
    removeButtons.current.get(id)?.focus();
  };

  const confirmRemove = (account: PayoutAccount) => {
    if (remove.isPending) return;
    const gone = () => {
      setAsking(null);
      if (choice?.kind === "saved" && choice.id === account.id) onChoice(null);
      title.current?.focus();
    };
    remove.mutate(account.id, {
      onSuccess: gone,
      onError: (error) => {
        // Not there any more: as good as removed.
        if (error instanceof ApiError && error.status === 404) gone();
      },
    });
  };

  return (
    <div className="flex flex-col gap-3.5 px-4 pt-4.5 pb-6">
      <h3
        id={titleId}
        ref={title}
        tabIndex={-1}
        className="text-xl outline-none"
      >
        {t.t("withdraw.accountTitle", { method: method.name })}
      </h3>

      {accounts.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </div>
      ) : (
        !accounts.data && (
          <PaymentNotice
            tone="refused"
            title={t.t("withdraw.accountsFailed")}
            lines={[]}
            actions={[
              {
                label: t.t("wallet.tryAgain"),
                onClick: () => void accounts.refetch(),
              },
            ]}
          />
        )
      )}

      {saved.length > 0 && (
        <div
          role="radiogroup"
          aria-labelledby={titleId}
          className="flex flex-col gap-2"
        >
          {saved.map((account) => (
            <div key={account.id} className="flex flex-col gap-2">
              <div className="bg-surface border-divider has-checked:border-accent flex items-center gap-2 rounded-md border pr-1 pl-3">
                <label className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2">
                  <input
                    type="radio"
                    name={group}
                    checked={
                      choice?.kind === "saved" && choice.id === account.id
                    }
                    onChange={() => choose(account)}
                    className="accent-accent size-4 shrink-0"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="numeric font-semibold">
                      {account.accountMasked}
                    </span>
                    {(account.holderName || account.verified) && (
                      <span className="text-muted flex flex-wrap items-center gap-x-2 text-xs">
                        {account.holderName}
                        {account.verified && (
                          <span className="text-accent inline-flex items-center gap-1">
                            <BadgeCheck
                              size={14}
                              strokeWidth={1.5}
                              aria-hidden
                            />
                            {t.t("withdraw.verified")}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </label>
                <button
                  type="button"
                  ref={(node) => {
                    if (node) removeButtons.current.set(account.id, node);
                    else removeButtons.current.delete(account.id);
                  }}
                  aria-label={t.t("withdraw.removeLabel", {
                    account: account.accountMasked,
                  })}
                  aria-expanded={asking === account.id}
                  onClick={() => {
                    remove.reset();
                    setAsking(account.id);
                  }}
                  className="text-muted min-h-11 shrink-0 cursor-pointer rounded-md px-2 text-xs font-semibold"
                >
                  {t.t("withdraw.remove")}
                </button>
              </div>

              {asking === account.id && (
                <RemoveQuestion
                  account={account}
                  removing={remove.isPending}
                  failed={
                    remove.isError &&
                    !(
                      remove.error instanceof ApiError &&
                      remove.error.status === 404
                    )
                  }
                  onRemove={() => confirmRemove(account)}
                  onKeep={() => keep(account.id)}
                />
              )}
            </div>
          ))}

          <label className="bg-surface border-divider has-checked:border-accent flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-3">
            <input
              type="radio"
              name={group}
              checked={choice?.kind === "new"}
              onChange={() => type("")}
              className="accent-accent size-4 shrink-0"
            />
            <span className="font-semibold">
              {t.t("withdraw.anotherNumber")}
            </span>
          </label>
        </div>
      )}

      {typing && (
        <div className="flex flex-col gap-2">
          <label htmlFor={fieldId} className="text-text/70 text-xs">
            {t.t("withdraw.numberLabel", { method: method.name })}
          </label>
          <PhoneInput
            id={fieldId}
            value={digits}
            onChange={(event) => type(event.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? problemId : undefined}
          />
          {invalid && (
            <div id={problemId} role="alert" className="text-loss text-xs">
              {t.t("auth.phoneInvalid")}
            </div>
          )}
          <p className="text-muted text-xs text-pretty">
            {t.t("withdraw.numberHint")}
          </p>
          <button
            type="button"
            aria-disabled={number === null || add.isPending || undefined}
            aria-busy={add.isPending || undefined}
            onClick={number === null ? undefined : save}
            className={cn(
              "bg-raised text-text font-body flex min-h-11 items-center justify-center gap-2 self-start rounded-md px-4 text-sm font-bold",
              number === null
                ? "cursor-not-allowed opacity-60"
                : add.isPending
                  ? "cursor-wait opacity-60"
                  : "cursor-pointer",
            )}
          >
            {add.isPending && (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            )}
            {t.t("withdraw.save")}
          </button>
          {add.isError && (
            <PaymentNotice
              tone="refused"
              title={t.t("withdraw.saveFailed")}
              lines={[apiTitle(add.error)]}
            />
          )}
        </div>
      )}

      <SubmitButton className="mt-1" disabled={!ready} onClick={onContinue}>
        {t.t("wallet.continue")}
      </SubmitButton>
    </div>
  );
}

/**
 * "Remove {account}?" — asked right under the account, Keep first in focus,
 * since keeping it is the safe answer. A removal that failed says so; Remove
 * is then the way to try again.
 */
function RemoveQuestion({
  account,
  removing,
  failed,
  onRemove,
  onKeep,
}: {
  account: PayoutAccount;
  removing: boolean;
  failed: boolean;
  onRemove: () => void;
  onKeep: () => void;
}) {
  const t = useTranslation();
  const question = useId();
  return (
    <div
      role="group"
      aria-labelledby={question}
      className="bg-raised flex flex-col gap-2 rounded-md p-3"
    >
      <p id={question} className="numeric text-sm font-semibold">
        {t.t("withdraw.removeQuestion", { account: account.accountMasked })}
      </p>
      {failed && (
        <p role="alert" className="text-loss text-xs">
          {t.t("withdraw.removeFailed")}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          // Keeping it is the safe answer, so that is where focus lands.
          autoFocus
          onClick={onKeep}
          className="bg-surface text-text font-body min-h-11 cursor-pointer rounded-md px-4 text-xs font-bold"
        >
          {t.t("withdraw.keep")}
        </button>
        <button
          type="button"
          aria-disabled={removing || undefined}
          aria-busy={removing || undefined}
          onClick={removing ? undefined : onRemove}
          className={cn(
            "bg-loss-bg text-loss font-body flex min-h-11 items-center gap-2 rounded-md px-4 text-xs font-bold",
            removing ? "cursor-wait opacity-60" : "cursor-pointer",
          )}
        >
          {removing && (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          )}
          {t.t("withdraw.remove")}
        </button>
      </div>
    </div>
  );
}
