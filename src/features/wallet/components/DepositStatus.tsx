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
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { useDeposit } from "../hooks/use-payments";
import { isFinal } from "../lib/deposit";
import {
  forgetDeposit,
  goToProvider,
  rememberDeposit,
} from "../lib/provider-redirect";
import type { Deposit, DepositStatus as Status } from "../types";

type Tone = "wait" | "good" | "bad";

const TONE: Record<Tone, { tile: string; badge: string }> = {
  wait: { tile: "text-muted", badge: "border-divider text-muted" },
  good: { tile: "text-accent", badge: "border-accent text-accent" },
  bad: { tile: "text-loss", badge: "border-loss text-loss" },
};

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

interface Action {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

/**
 * Where a deposit stands, as the API says it — read every 3 s while it is
 * still going (`useDeposit`), so the player never presses anything to find
 * out. What the screen offers follows the API's `next_action`: approve the
 * push on the phone, finish on the provider's page, or choose another method
 * when this site can't finish it. A final status says what it means for the
 * balance and what to do next; nothing here works out a balance.
 *
 * There is no Cancel: the contract has no way to cancel a deposit, so Back
 * to wallet leaves it running — a push approved later still arrives.
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
  /** The method's name as the API gives it, by its code. */
  methodName: (code: Deposit["method"]) => string;
  onDone: () => void;
  onBackToSports: () => void;
  /** A new deposit with the same method and amount. */
  onRetry: (deposit: Deposit) => void;
  onChooseAnother: (deposit: Deposit) => void;
}) {
  const t = useTranslation();
  const query = useDeposit(id);
  const deposit = query.data;

  // Over: nothing to come back to after a trip to the provider.
  const status = deposit?.status;
  useEffect(() => {
    if (status && isFinal(status)) forgetDeposit();
  }, [status]);

  // Focus lands on the outcome once it is there, so it is what is read out.
  const focused = useRef(false);
  const focusOnce = (node: HTMLHeadingElement | null) => {
    if (node && !focused.current) {
      focused.current = true;
      node.focus();
    }
  };

  const backToWallet: Action = {
    label: t.t("deposit.backToWallet"),
    onClick: onDone,
  };

  if (!deposit) {
    if (query.isError) {
      const gone =
        query.error instanceof ApiError &&
        (query.error.status === 404 || query.error.status === 401);
      return (
        <Outcome
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
                    label: t.t("common.retry"),
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
    return (
      <div className="flex flex-col items-center gap-3 px-5 pt-10 pb-7">
        <Skeleton className="size-[68px] rounded-lg" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  const method = methodName(deposit.method);
  const amount = t.money(deposit.amount);
  const action = deposit.nextAction;
  const rows = [
    { label: t.t("wallet.method"), value: method },
    { label: t.t("wallet.amount"), value: amount },
    { label: t.t("wallet.reference"), value: deposit.id },
  ];
  const updates = t.t("deposit.updates");
  const tryAgain: Action = {
    label: t.t("wallet.tryAgain"),
    onClick: () => onRetry(deposit),
    primary: true,
  };
  const chooseAnother: Action = {
    label: t.t("wallet.otherMethod"),
    onClick: () => onChooseAnother(deposit),
  };

  let view: {
    tone: Tone;
    icon: ReactNode;
    title: string;
    lines: string[];
    actions: Action[];
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
        actions: [
          tryAgain,
          chooseAnother,
          { label: t.t("wallet.done"), onClick: onDone },
        ],
      };
      break;
    case "expired":
      view = {
        tone: "bad",
        icon: <TimerOff size={30} strokeWidth={1.5} aria-hidden />,
        title: t.t("deposit.expiredTitle"),
        lines: [t.t("deposit.expiredBody", { method })],
        actions: [
          tryAgain,
          chooseAnother,
          { label: t.t("wallet.done"), onClick: onDone },
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
    <Outcome
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

/** The outcome's layout: what, in words; the deposit's rows; what next. */
function Outcome({
  tone,
  icon,
  badge,
  title,
  lines,
  rows,
  actions,
  headingRef,
}: {
  tone: Tone;
  icon: ReactNode;
  badge: string | null;
  title: string;
  lines: string[];
  rows: { label: string; value: string }[];
  actions: Action[];
  headingRef: (node: HTMLHeadingElement | null) => void;
}) {
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
            TONE[tone].tile,
          )}
        >
          {icon}
        </div>
        {badge && (
          <span
            className={cn(
              "rounded-full border px-2.5 py-[3px] text-xs font-bold",
              TONE[tone].badge,
            )}
          >
            {badge}
          </span>
        )}
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 text-2xl text-balance outline-none"
        >
          {title}
        </h2>
        {lines.map((line) => (
          <p key={line} className="text-muted max-w-[320px] text-pretty">
            {line}
          </p>
        ))}
      </div>

      {rows.length > 0 && (
        <dl className="bg-surface numeric mx-4 rounded-md px-3.5 py-1">
          {rows.map((row) => (
            <div
              key={row.label}
              className="border-divider flex justify-between gap-3 border-b py-2.5 last:border-b-0"
            >
              <dt className="text-muted shrink-0">{row.label}</dt>
              <dd className="min-w-0 text-right font-semibold break-all">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-col gap-2 p-4 pb-6">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={cn(
              "font-body cursor-pointer rounded-md px-3 font-bold",
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
