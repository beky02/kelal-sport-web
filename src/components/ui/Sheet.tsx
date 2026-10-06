"use client";

import { Dialog } from "radix-ui";
import { cn } from "@/lib/utils/cn";

/**
 * A bottom sheet.
 *
 * On a phone the bet slip is not a third column — it is a sheet that comes up
 * over the board, so the matches keep the full width. Radix handles the focus
 * trap, scroll lock and Escape.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Read by screen readers; the visible header lives inside `children`. */
  title: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Where focus goes when the sheet closes. Radix returns it only to a
   * `Dialog.Trigger`; a sheet opened from code has none, so without this it
   * lands on the page.
   */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in fixed inset-0 z-40 bg-black/55" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.current) return;
            event.preventDefault();
            returnFocusTo.current.focus();
          }}
          className={cn(
            "bg-ground border-border fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[16px] border-t outline-none",
            className,
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <div
            aria-hidden
            className="bg-muted/40 mx-auto mt-2 h-1 w-9 shrink-0 rounded-full"
          />
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const SheetClose = Dialog.Close;
