"use client";

import { Dialog } from "radix-ui";
import { cn } from "@/lib/utils/cn";

export interface SystemAction {
  label: string;
  /** primary = the expected choice · secondary = an alternative · quiet = a way out */
  kind: "primary" | "secondary" | "quiet";
  onClick: () => void;
}

const ACTION: Record<SystemAction["kind"], string> = {
  primary: "bg-accent text-on-accent",
  secondary: "bg-raised text-text",
  quiet: "text-muted bg-transparent",
};

export function SystemActions({ actions }: { actions: SystemAction[] }) {
  return (
    <div className="mt-1 flex flex-col gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className={cn(
            "font-body h-[46px] cursor-pointer rounded-md text-sm font-bold",
            ACTION[action.kind],
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

/**
 * An interruption over a page the user can go back to.
 *
 * Deliberately not dismissible by clicking away or pressing Escape: each of
 * these exists because something needs acknowledging, and the actions are the
 * only way out. `alertdialog` rather than `dialog`, so a screen reader announces
 * it rather than waiting to be explored.
 */
export function SystemDialog({
  open,
  tone = "accent",
  icon,
  title,
  body,
  stats,
  actions,
}: {
  open: boolean;
  tone?: "accent" | "loss";
  icon: React.ReactNode;
  title: string;
  body: string;
  /** Three figures, shown side by side. The last is tinted as a loss. */
  stats?: Array<{ label: string; value: string }>;
  actions: SystemAction[];
}) {
  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[45] bg-black/60" />
        <Dialog.Content
          role="alertdialog"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="bg-surface border-border fixed top-1/2 left-1/2 z-[46] flex w-[400px] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border p-6 outline-none"
        >
          <span
            aria-hidden
            className={cn(
              "grid size-11 place-items-center rounded-xl",
              tone === "loss"
                ? "bg-loss-bg text-loss"
                : "bg-accent-100 text-accent",
            )}
          >
            {icon}
          </span>

          <Dialog.Title className="text-[22px] leading-[1.15]">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-muted text-sm text-pretty">
            {body}
          </Dialog.Description>

          {stats && (
            <div className="grid grid-cols-3 gap-1.5">
              {stats.map((stat, index) => (
                <div key={stat.label} className="bg-raised rounded-md p-2.5">
                  <div className="text-muted text-[11px]">{stat.label}</div>
                  <div
                    className={cn(
                      "numeric text-[15px] font-extrabold",
                      index === stats.length - 1 ? "text-loss" : "text-text",
                    )}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <SystemActions actions={actions} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
