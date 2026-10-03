"use client";

import { useRef, type ReactNode } from "react";
import {
  BadgeCheck,
  Ban,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Hourglass,
  Send,
  Undo2,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { ApiError } from "@/lib/api/errors";
import { usePaymentMethods } from "../hooks/use-payments";
import { useCancelWithdrawal, useWithdrawal } from "../hooks/use-withdrawals";
import { isCancellable, reviewReasonKey } from "../lib/withdrawal";
import type { Withdrawal } from "../types";
import {
  OutcomeSkeleton,
  PaymentOutcome,
  type OutcomeAction,
  type OutcomeTone,
} from "./PaymentOutcome";
import { PaymentNotice } from "./PaymentNotice";

/**
 * Where a withdrawal stands, as the API says it — read again while it moves
 * (`useWithdrawal`), so the player never presses anything to find out. Each
 * of the contract's statuses says what it means for their money and what
 * they can do next; nothing here works out a balance.
 *
 * Cancel is offered only while the withdrawal is `requested` or in `review`
 * (the contract). Its answer is the API's: the cancelled withdrawal, or —
 * too late, or no answer — the withdrawal read again, so the screen says
 * where it really stands.
 */
export function WithdrawalStatus({
  id,
  owner,
  onDone,
  onBackToSports,
  onRetry,
  onChooseAnother,
}: {
  id: string;
  /** The signed-in player, whose withdrawal this is. */
  owner: string;
  onDone: () => void;
  onBackToSports: () => void;
  /** A new withdrawal with the same method and amount: the account is chosen again. */
  onRetry: (withdrawal: Withdrawal) => void;
  onChooseAnother: (withdrawal: Withdrawal) => void;
}) {
  const t = useTranslation();
  const query = useWithdrawal(id);
  const withdrawal = query.data;
  // The method's name is the API's; read in this render, so a failed read of
  // the methods re-renders this screen too.
  const methods = usePaymentMethods(true);
  const offered = methods.data;
  const methodsSettled = !methods.isPending;
  const { state: cancelling, cancel } = useCancelWithdrawal(owner);

  // Focus lands on the outcome once it is there, so it is what is read out.
  const focused = useRef(false);
  const focusOnce = (node: HTMLHeadingElement | null) => {
    if (node && !focused.current) {
      focused.current = true;
      node.focus();
    }
  };

  const backToWallet: OutcomeAction = {
    label: t.t("deposit.backToWallet"),
    onClick: onDone,
  };

  if (!withdrawal) {
    if (query.isError) {
      const gone =
        query.error instanceof ApiError &&
        (query.error.status === 404 || query.error.status === 401);
      return (
        <PaymentOutcome
          tone="bad"
          icon={<CircleAlert size={30} strokeWidth={1.5} aria-hidden />}
          badge={null}
          title={t.t(
            gone ? "withdraw.notFoundTitle" : "withdraw.checkFailedTitle",
          )}
          lines={[
            t.t(gone ? "withdraw.notFoundBody" : "withdraw.checkFailedBody"),
          ]}
          rows={[]}
          actions={
            gone
              ? [{ ...backToWallet, primary: true }]
              : [
                  {
                    label: t.t("wallet.tryAgain"),
                    onClick: () => void query.refetch(),
                    primary: true,
                  },
                  backToWallet,
                ]
          }
          headingRef={focusOnce}
        />
      );
    }
    return <OutcomeSkeleton />;
  }

  const method =
    offered?.find((m) => m.code === withdrawal.method)?.name ??
    (methodsSettled ? t.t("deposit.provider") : null);
  // The method's name is on its way: no half-named screen, read out twice.
  if (method === null) return <OutcomeSkeleton />;

  const amount = t.money(withdrawal.amount);
  const account = withdrawal.accountMasked ?? t.t("withdraw.yourAccount");
  const rows = [
    { label: t.t("wallet.method"), value: method },
    { label: t.t("wallet.account"), value: account },
    { label: t.t("wallet.amount"), value: amount },
    { label: t.t("wallet.reference"), value: withdrawal.id },
  ];

  // Cancel, while the contract allows it — and not while a cancel is on its
  // way, had no answer (its own Try again says so) or was too late.
  const cancellable = isCancellable(withdrawal.status);
  const cancelAction: OutcomeAction[] =
    cancellable &&
    cancelling.kind !== "unanswered" &&
    cancelling.kind !== "tooLate"
      ? [
          {
            label: t.t("withdraw.cancel"),
            onClick: () => cancel(id),
            busy: cancelling.kind === "sending",
          },
        ]
      : [];

  let view: {
    tone: OutcomeTone;
    icon: ReactNode;
    title: string;
    lines: string[];
    actions: OutcomeAction[];
  };
  const icon = (Icon: typeof Clock) => (
    <Icon size={30} strokeWidth={1.5} aria-hidden />
  );
  switch (withdrawal.status) {
    case "requested":
      view = {
        tone: "wait",
        icon: icon(Clock),
        title: t.t("withdraw.requestedTitle"),
        lines: [t.t("withdraw.requestedBody", { amount, account })],
        actions: [{ ...backToWallet, primary: true }, ...cancelAction],
      };
      break;
    case "review": {
      const reason = reviewReasonKey(withdrawal.reviewReason);
      view = {
        tone: "wait",
        icon: icon(Hourglass),
        title: t.t("withdraw.reviewTitle"),
        lines: [
          t.t("withdraw.reviewBody"),
          ...(reason ? [t.t(reason)] : []),
          t.t("withdraw.reviewCancel"),
        ],
        actions: [{ ...backToWallet, primary: true }, ...cancelAction],
      };
      break;
    }
    case "approved":
      view = {
        tone: "wait",
        icon: icon(BadgeCheck),
        title: t.t("withdraw.approvedTitle"),
        lines: [t.t("withdraw.approvedBody", { account })],
        actions: [{ ...backToWallet, primary: true }],
      };
      break;
    case "processing":
      view = {
        tone: "wait",
        icon: icon(Send),
        title: t.t("withdraw.processingTitle"),
        lines: [t.t("withdraw.processingBody", { amount, account })],
        actions: [{ ...backToWallet, primary: true }],
      };
      break;
    case "paid":
      view = {
        tone: "good",
        icon: icon(CircleCheck),
        title: t.t("withdraw.paidTitle"),
        lines: [t.t("withdraw.paidBody", { amount, account })],
        actions: [
          { label: t.t("wallet.done"), onClick: onDone, primary: true },
          { label: t.t("wallet.backToSports"), onClick: onBackToSports },
        ],
      };
      break;
    case "failed":
      view = {
        tone: "bad",
        icon: icon(CircleX),
        title: t.t("withdraw.failedTitle"),
        lines: [t.t("withdraw.failedBody", { account, amount })],
        actions: [
          {
            label: t.t("wallet.tryAgain"),
            onClick: () => onRetry(withdrawal),
            primary: true,
          },
          {
            label: t.t("wallet.otherMethod"),
            onClick: () => onChooseAnother(withdrawal),
          },
          backToWallet,
        ],
      };
      break;
    case "rejected":
      view = {
        tone: "bad",
        icon: icon(Ban),
        title: t.t("withdraw.rejectedTitle"),
        lines: [
          t.t("withdraw.rejectedBody", { amount }),
          // The API's own words on why, as their own line.
          ...(withdrawal.rejectionReason ? [withdrawal.rejectionReason] : []),
        ],
        actions: [{ ...backToWallet, primary: true }],
      };
      break;
    case "cancelled":
      view = {
        tone: "wait",
        icon: icon(Undo2),
        title: t.t("withdraw.cancelledTitle"),
        lines: [t.t("withdraw.cancelledBody", { amount })],
        actions: [{ ...backToWallet, primary: true }],
      };
      break;
  }

  // What came of the cancel the player asked for. No answer is only worth
  // saying while it can still be cancelled: once the read says cancelled,
  // the screen says so itself.
  const notice =
    cancelling.kind === "tooLate" ? (
      <PaymentNotice
        tone="refused"
        title={t.t("withdraw.tooLateTitle")}
        lines={[t.t("withdraw.tooLateBody")]}
      />
    ) : cancelling.kind === "unanswered" && cancellable ? (
      <PaymentNotice
        tone="pending"
        title={t.t("withdraw.cancelUnconfirmedTitle")}
        lines={[t.t("withdraw.cancelUnconfirmedBody")]}
        actions={[{ label: t.t("wallet.tryAgain"), onClick: () => cancel(id) }]}
      />
    ) : cancelling.kind === "refused" && cancellable ? (
      <PaymentNotice
        tone="refused"
        title={t.t("withdraw.cancelFailedTitle")}
        lines={[cancelling.error.message]}
      />
    ) : null;

  return (
    <PaymentOutcome
      tone={view.tone}
      icon={view.icon}
      badge={t.t(`withdraw.status.${withdrawal.status}`)}
      title={view.title}
      lines={view.lines}
      rows={rows}
      notice={notice}
      actions={view.actions}
      headingRef={focusOnce}
    />
  );
}
