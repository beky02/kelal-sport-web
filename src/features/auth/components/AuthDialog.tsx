"use client";

import { Dialog } from "radix-ui";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useAuthStore } from "../stores/auth.store";
import { LoginFlow } from "./flows/LoginFlow";
import { RegisterFlow } from "./flows/RegisterFlow";
import { ResetFlow } from "./flows/ResetFlow";

/**
 * Log in, register, verify an ID and reset a password, over the page.
 *
 * A dialog rather than a route so that closing it returns the user to exactly
 * what they were doing — most people meet this flow because they tried to place
 * a bet, and losing the slip on the way to logging in would be the wrong trade.
 *
 * The store says which flow is open; each flow keeps its own place and what
 * the player typed, and both go when the dialog closes. Nothing here
 * authenticates anyone: the route handlers hold the session as an httpOnly
 * cookie, and `/api/me` says who is signed in (AC-8).
 */
export function AuthDialog() {
  const t = useTranslation();
  const entry = useAuthStore((s) => s.entry);
  const close = useAuthStore((s) => s.close);

  if (entry === null) return null;

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            // The login form puts the caret in its first field itself.
            if (entry === "login") event.preventDefault();
          }}
          className="bg-ground border-border fixed top-1/2 left-1/2 z-40 flex max-h-[92dvh] w-[440px] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border outline-none"
        >
          <Dialog.Title className="sr-only">
            {t.t("auth.dialogLabel")}
          </Dialog.Title>

          {entry === "login" && <LoginFlow />}
          {(entry === "register" || entry === "verify") && (
            <RegisterFlow key={entry} mode={entry} />
          )}
          {entry === "forgot" && <ResetFlow />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
