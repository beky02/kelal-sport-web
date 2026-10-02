"use client";

import { create } from "zustand";
import type { AuthEntry, AuthPrefill } from "../types";

interface AuthState {
  /** Which flow is open; null when the dialog is closed. */
  entry: AuthEntry | null;
  /** Where to go once signed in (`/login?next=…`), checked before it is used. */
  next: string | null;
  /** What the previous flow hands over when one switches to another. */
  prefill: AuthPrefill | null;
  open: (entry: AuthEntry, next?: string | null) => void;
  /** Another flow, keeping where the player was going. */
  switchTo: (entry: AuthEntry, prefill?: AuthPrefill | null) => void;
  close: () => void;
}

/**
 * Which auth flow is on screen, if any. Where a flow stands within itself —
 * and what the player has typed — is the flow's own state, gone when the
 * dialog closes.
 *
 * A dialog rather than a route, so closing it returns the user to the page they
 * were on with the bet slip untouched. Someone who has built a five-leg slip and
 * is asked to log in should not lose it to a navigation.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  entry: null,
  next: null,
  prefill: null,
  open: (entry, next = null) => set({ entry, next, prefill: null }),
  switchTo: (entry, prefill = null) => set({ entry, prefill }),
  close: () => set({ entry: null, next: null, prefill: null }),
}));
