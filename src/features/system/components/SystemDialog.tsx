"use client";

import { useRef } from "react";
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
          data-kind={action.kind}
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
 * it rather than waiting to be explored. Focus opens on the first action unless
 * `initialFocus` names another kind — the safe answer of a question that can't
 * be undone, so a stray Enter never confirms it.
 */
export function SystemDialog({
  open,
  tone = "accent",
  icon,
  title,
  body,
  actions,
  initialFocus,
}: {
  open: boolean;
  tone?: "accent" | "loss";
  icon: React.ReactNode;
  title: string;
  body: string;
  actions: SystemAction[];
  /** The kind of action focus opens on; the first action when not given. */
  initialFocus?: SystemAction["kind"];
}) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[45] bg-black/60" />
        <Dialog.Content
          ref={content}
          role="alertdialog"
          onOpenAutoFocus={(event) => {
            if (!initialFocus) return;
            event.preventDefault();
            content.current
              ?.querySelector<HTMLButtonElement>(
                `[data-kind="${initialFocus}"]`,
              )
              ?.focus();
          }}
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

          <SystemActions actions={actions} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
