"use client";

import { useEffect } from "react";
import { SportsbookView } from "@/features/sportsbook/components/SportsbookView";
import { useAuthStore } from "../stores/auth.store";
import type { AuthStep } from "../types";

/**
 * `/login` and `/register` as real, linkable URLs.
 *
 * Auth is a dialog, but the addresses still have to work — someone can bookmark
 * them, or be sent one. Both open the dialog over the sportsbook, which is the
 * same thing the header buttons do, so there is one flow rather than two.
 */
export function AuthRoute({ step }: { step: AuthStep }) {
  const open = useAuthStore((s) => s.open);

  useEffect(() => {
    open(step);
  }, [open, step]);

  return <SportsbookView />;
}
