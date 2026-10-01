"use client";

import { create } from "zustand";

interface SessionState {
  /**
   * Whether anyone is signed in.
   *
   * A stub for this phase. Real sessions live in an HttpOnly cookie set by the
   * backend and are read by calling `/me` — never by trusting a flag in the
   * browser. Keep that boundary when auth lands: this store may cache who the
   * user is, but it must never be what decides whether they may bet.
   */
  isGuest: boolean;
  /**
   * Whether Fayda ID verification has come back.
   *
   * Gates withdrawals only: Ethiopian law requires the check before money
   * leaves, not before a bet. Server-owned, like `isGuest`.
   */
  kycVerified: boolean;

  setGuest: (isGuest: boolean) => void;
  setKycVerified: (verified: boolean) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  isGuest: false,
  kycVerified: true,
  setGuest: (isGuest) => set({ isGuest }),
  setKycVerified: (kycVerified) => set({ kycVerified }),
}));
