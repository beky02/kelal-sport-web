"use client";

import { create } from "zustand";
import type { AuthStep } from "../types";

interface AuthState {
  /** Null when the dialog is closed. */
  step: AuthStep | null;
  /** Where to go once signed in (`/login?next=…`), checked before it is used. */
  next: string | null;
  open: (step: AuthStep, next?: string | null) => void;
  close: () => void;
  goTo: (step: AuthStep) => void;
}

/**
 * Which auth step is on screen, if any.
 *
 * A dialog rather than a route, so closing it returns the user to the page they
 * were on with the bet slip untouched. Someone who has built a five-leg slip and
 * is asked to log in should not lose it to a navigation.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  step: null,
  next: null,
  open: (step, next = null) => set({ step, next }),
  close: () => set({ step: null, next: null }),
  goTo: (step) => set({ step }),
}));
