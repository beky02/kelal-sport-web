"use client";

import { create } from "zustand";
import type { AuthStep } from "../types";

interface AuthState {
  /** Null when the dialog is closed. */
  step: AuthStep | null;
  open: (step: AuthStep) => void;
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
  open: (step) => set({ step }),
  close: () => set({ step: null }),
  goTo: (step) => set({ step }),
}));
