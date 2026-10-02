"use client";

import { useEffect, useRef } from "react";
import { Dialog } from "radix-ui";
import { ChevronLeft, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { AuthStepper } from "./AuthStepper";

/**
 * What every flow puts around its steps: the back arrow (only when there is
 * somewhere to go back to — on a first step it could only close, which the
 * cross already does), where the player is, the cross, the progress bar
 * during registration, and the scrolling body.
 *
 * When the step changes, focus goes with it. A step that puts the caret in
 * its own field (the phone, the code boxes) keeps it; any other step gets
 * focus on its heading, so a screen reader says where the player now is —
 * "Your details", "Identity verified" — instead of nothing after Create
 * account or Verify.
 */
export function AuthFrame({
  heading,
  onBack,
  stepper = null,
  stepKey,
  children,
}: {
  heading: string;
  /** Which step is showing; focus moves when it changes. */
  stepKey: string;
  onBack: (() => void) | null;
  /** The registration step's index, or null for no progress bar. */
  stepper?: number | null;
  children: React.ReactNode;
}) {
  const t = useTranslation();
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = body.current;
    // A step's own effects run first: if it focused a field, leave it there.
    if (!root || root.contains(document.activeElement)) return;
    const title = root.querySelector("h2");
    if (!title) return;
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }, [stepKey]);

  return (
    <>
      <div className="border-divider grid min-h-12 shrink-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b px-1">
        {onBack ? (
          <button
            type="button"
            aria-label={t.t("auth.back")}
            onClick={onBack}
            className="text-text grid size-11 cursor-pointer place-items-center rounded-md bg-transparent"
          >
            <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
          </button>
        ) : (
          <span aria-hidden />
        )}

        <div className="text-muted text-center text-xs">{heading}</div>

        <Dialog.Close
          aria-label={t.t("betSlip.close")}
          className="text-text hover:bg-raised grid size-11 cursor-pointer place-items-center rounded-md bg-transparent"
        >
          <X size={18} strokeWidth={1.5} aria-hidden />
        </Dialog.Close>
      </div>

      {stepper !== null && <AuthStepper current={stepper} />}

      <div
        ref={body}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-5.5 pb-7 [&_h2]:outline-none"
      >
        {children}
      </div>
    </>
  );
}
