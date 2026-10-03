"use client";

import { CircleCheck, CircleX, Clock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import type { PaymentMethod, PaymentResult } from "../types";

const STATUS_BADGE: Record<PaymentResult["status"], string> = {
  pending: "border-divider text-muted",
  success: "border-accent text-accent",
  failed: "border-loss text-loss",
};

/**
 * How a withdrawal went (the mock, until F6c moves it to `/v1/withdrawals`).
 *
 * Three outcomes with genuinely different next steps: keep waiting, carry on, or
 * pick another method. Deposits have their own screen (`DepositStatus`).
 */
export function PaymentResultStep({
  method,
  result,
  onDone,
  onBackToSports,
  onRetry,
  onChooseAnother,
  onCancel,
}: {
  method: PaymentMethod;
  result: PaymentResult;
  onDone: () => void;
  onBackToSports: () => void;
  onRetry: () => void;
  onChooseAnother: () => void;
  onCancel: () => void;
}) {
  const t = useTranslation();

  const view = {
    pending: {
      icon: <Clock size={30} strokeWidth={1.5} aria-hidden />,
      tint: "text-muted",
      title: t.t("wallet.pendingTitle"),
      body: t.t("wallet.pendingBody", { method: method.name }),
      actions: [
        // No "check status" button: the screen polls, so a button would only
        // invite the user to do the work it is already doing.
        {
          label: t.t("wallet.cancelPayment"),
          onClick: onCancel,
          primary: false,
        },
      ],
    },
    success: {
      icon: <CircleCheck size={30} strokeWidth={1.5} aria-hidden />,
      tint: "text-accent",
      title: t.t("wallet.successTitleWithdraw"),
      body: t.t("wallet.successBodyWithdraw", {
        amount: t.money(result.amount),
        method: method.name,
      }),
      actions: [
        { label: t.t("wallet.done"), onClick: onDone, primary: true },
        {
          label: t.t("wallet.backToSports"),
          onClick: onBackToSports,
          primary: false,
        },
      ],
    },
    failed: {
      icon: <CircleX size={30} strokeWidth={1.5} aria-hidden />,
      tint: "text-loss",
      title: t.t("wallet.failedTitle"),
      body: t.t("wallet.failedBody", { method: method.name }),
      actions: [
        { label: t.t("wallet.tryAgain"), onClick: onRetry, primary: true },
        {
          label: t.t("wallet.otherMethod"),
          onClick: onChooseAnother,
          primary: false,
        },
      ],
    },
  }[result.status];

  // No "new balance": a balance is only ever the API's, read again by the
  // wallet once a payment settles — never one worked out here.
  const rows =
    result.status === "success"
      ? [
          { label: t.t("wallet.amount"), value: t.money(result.amount) },
          { label: t.t("wallet.reference"), value: result.reference },
        ]
      : [
          { label: t.t("wallet.method"), value: method.name },
          { label: t.t("wallet.amount"), value: t.money(result.amount) },
          { label: t.t("wallet.reference"), value: result.reference },
        ];

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-2.5 px-5 pt-10 pb-7 text-center"
      >
        <div
          className={cn(
            "bg-surface grid size-[68px] place-items-center rounded-lg",
            view.tint,
          )}
        >
          {view.icon}
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-[3px] text-[10px] font-bold tracking-[0.06em] uppercase",
            STATUS_BADGE[result.status],
          )}
        >
          {t.t(
            result.status === "success"
              ? "wallet.statusSuccess"
              : result.status === "failed"
                ? "wallet.statusFailed"
                : "wallet.statusPending",
          )}
        </span>
        <h2 className="mt-1 text-2xl">{view.title}</h2>
        <p className="text-muted max-w-[300px] text-pretty">{view.body}</p>
      </div>

      <div className="bg-surface numeric mx-4 rounded-md px-3.5 py-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="border-divider flex justify-between gap-3 border-b py-2.5"
          >
            <span className="text-muted">{row.label}</span>
            <span className="font-semibold">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 p-4 pb-6">
        {view.actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={cn(
              "font-body cursor-pointer rounded-md font-bold",
              action.primary
                ? "bg-accent text-on-accent h-[52px] text-[15px]"
                : "bg-raised text-text h-12 text-sm",
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}
