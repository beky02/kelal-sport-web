"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Globe,
  Smartphone,
  TimerOff,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { ApiError } from "@/lib/api/errors";
import { useDeposit } from "../hooks/use-payments";
import { isFinal } from "../lib/deposit";
import {
  forgetDeposit,
  goToProvider,
  rememberDeposit,
} from "../lib/provider-redirect";
import { useDepositStore } from "../stores/deposit.store";
import type { Deposit, DepositStatus as Status } from "../types";
import {
  OutcomeSkeleton,
  PaymentOutcome,
  type OutcomeAction,
  type OutcomeTone,
} from "./PaymentOutcome";

const BADGE: Record<
  Status,
  | "deposit.statusStarting"
  | "wallet.statusPending"
  | "wallet.statusSuccess"
  | "wallet.statusFailed"
  | "deposit.statusExpired"
> = {
  initiated: "deposit.statusStarting",
  pending: "wallet.statusPending",
  completed: "wallet.statusSuccess",
  failed: "wallet.statusFailed",
  expired: "deposit.statusExpired",
};

/**
 * Where a deposit stands, as the API says it — read every 3 s while it is
 * still going (`useDeposit`), so the player never presses anything to find
 * out. What the screen offers follows the API's `next_action`: approve the
 * push on the phone, finish on the provider's page, or choose another method
 * when this site can't finish it. A final status says what it means for the
 * balance and what to do next; nothing here works out a balance.
 *
 * There is no Cancel: the contract has no way to cancel a deposit, so Back
 * to wallet leaves it running — a push approved later still arrives, and the
 * deposit is still followed (`DepositFollower`) until the API decides.
 */
export function DepositStatus({
  id,
  owner,
  methodName,
  onDone,
  onBackToSports,
  onRetry,
  onChooseAnother,
}: {
  id: string;
  /** The signed-in player, whose deposit this is. */
  owner: string;
  /** The method's name as the API gives it, by its code; null while unknown yet. */
  methodName: (code: Deposit["method"]) => string | null;
  onDone: () => void;
  onBackToSports: () => void;
  /** A new deposit with the same method and amount. */
  onRetry: (deposit: Deposit) => void;
  onChooseAnother: (deposit: Deposit) => void;
}) {
  const t = useTranslation();
  const query = useDeposit(id);
  const deposit = query.data;

  // Over: nothing more to read, nothing to come back to from the provider.
  const status = deposit?.status;
  useEffect(() => {
    if (status && isFinal(status)) {
      forgetDeposit();
      useDepositStore.getState().finished(id);
    }
  }, [status, id]);

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

  if (!deposit) {
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
            gone ? "deposit.notFoundTitle" : "deposit.checkFailedTitle",
          )}
          lines={[
            t.t(gone ? "deposit.notFoundBody" : "deposit.checkFailedBody"),
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

  const method = methodName(deposit.method);
  if (method === null) {
    // The method's name is on its way: no half-named screen, read out twice.
    return <OutcomeSkeleton />;
  }
  const amount = t.money(deposit.amount);
  const action = deposit.nextAction;
  const rows = [
    { label: t.t("wallet.method"), value: method },
    { label: t.t("wallet.amount"), value: amount },
    { label: t.t("wallet.reference"), value: deposit.id },
  ];
  const updates = t.t("deposit.updates");
  const tryAgain: OutcomeAction = {
    label: t.t("wallet.tryAgain"),
    onClick: () => onRetry(deposit),
    primary: true,
  };
  const chooseAnother: OutcomeAction = {
    label: t.t("wallet.otherMethod"),
    onClick: () => onChooseAnother(deposit),
  };

  let view: {
    tone: OutcomeTone;
    icon: ReactNode;
    title: string;
    lines: string[];
    actions: OutcomeAction[];
  };
  switch (deposit.status) {
    case "completed":
      view = {
        tone: "good",
        icon: <CircleCheck size={30} strokeWidth={1.5} aria-hidden />,
        title: t.t("deposit.completedTitle"),
        lines: [t.t("deposit.completedBody", { amount, method })],
        actions: [
          { label: t.t("wallet.done"), onClick: onDone, primary: true },
          { label: t.t("wallet.backToSports"), onClick: onBackToSports },
        ],
      };
      break;
    case "failed":
      view = {
        tone: "bad",
        icon: <CircleX size={30} strokeWidth={1.5} aria-hidden />,
        title: t.t("deposit.failedTitle"),
        lines: [
          t.t("deposit.failedBody"),
          // The API's own words on why, as their own line.
          ...(deposit.failureReason ? [deposit.failureReason] : []),
        ],
        actions: [tryAgain, chooseAnother, backToWallet],
      };
      break;
    case "expired":
      view = {
        tone: "bad",
        icon: <TimerOff size={30} strokeWidth={1.5} aria-hidden />,
        title: t.t("deposit.expiredTitle"),
        lines: [t.t("deposit.expiredBody", { method })],
        // A late approval still arrives: going back is the main way on, a
        // new deposit only by choice.
        actions: [
          { ...backToWallet, primary: true },
          { ...tryAgain, primary: false },
          chooseAnother,
        ],
      };
      break;
    default:
      // `initiated` or `pending`: what happens next is the API's next action.
      if (action?.type === "ussd_push") {
        view = {
          tone: "wait",
          icon: <Smartphone size={30} strokeWidth={1.5} aria-hidden />,
          title: t.t("deposit.phoneTitle"),
          lines: [...(action.message ? [action.message] : []), updates],
          actions: [backToWallet],
        };
      } else if (action?.type === "redirect") {
        const url = action.url;
        view = {
          tone: "wait",
          icon: <Globe size={30} strokeWidth={1.5} aria-hidden />,
          title: t.t("deposit.webTitle", { method }),
          lines: [t.t("deposit.webBody", { method }), updates],
          actions: [
            {
              label: t.t("deposit.continueTo", { method }),
              onClick: () => {
                rememberDeposit(deposit.id, owner);
                goToProvider(url);
              },
              primary: true,
            },
            backToWallet,
          ],
        };
      } else if (action?.type === "unsupported") {
        view = {
          tone: "bad",
          icon: <CircleAlert size={30} strokeWidth={1.5} aria-hidden />,
          title: t.t("deposit.unsupportedTitle"),
          lines: [t.t("deposit.unsupportedBody", { method })],
          actions: [{ ...chooseAnother, primary: true }, backToWallet],
        };
      } else {
        view = {
          tone: "wait",
          icon: <Clock size={30} strokeWidth={1.5} aria-hidden />,
          title: t.t("deposit.startingTitle"),
          lines: [updates],
          actions: [backToWallet],
        };
      }
  }

  return (
    <PaymentOutcome
      tone={view.tone}
      icon={view.icon}
      badge={t.t(BADGE[deposit.status])}
      title={view.title}
      lines={view.lines}
      rows={rows}
      actions={view.actions}
      headingRef={focusOnce}
    />
  );
}
