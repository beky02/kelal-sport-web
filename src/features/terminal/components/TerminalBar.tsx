"use client";

import { BrandMark } from "@/components/layout/BrandMark";

/**
 * The terminal's one bar (F8ca): the player's application bar's frame with
 * the brand, and whatever acts on its right (the kiosk's search and language
 * switch). Every terminal screen with a bar has this one — starting, the
 * kiosk, activation, its states, a closed shop — so nothing changes between
 * them (reviews U7, Q4). It names no shop and no PC (the user's second
 * review): those are the terminal's business, not the customer's. The brand
 * goes home, `/`, which a terminal host serves as the kiosk.
 */
export function TerminalBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="bg-surface border-divider sticky top-0 z-30 flex h-[52px] items-center gap-2 px-3 md:h-14 md:gap-3.5 md:border-b md:px-5">
      <BrandMark />
      <span className="flex-1" />
      {children}
    </header>
  );
}
