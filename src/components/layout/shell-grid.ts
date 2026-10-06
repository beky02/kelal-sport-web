/**
 * The sportsbook's columns (`SportsbookShell`, and the kiosk's `KioskShell`):
 *
 *   ≥ 1440px   sidebar 248 · board (fluid) · slip 340
 *   1280–1439  sidebar 228 · board (fluid) · slip 312
 *   1024–1279  sidebar 228 · board (fluid)
 *
 * Bounded ranges, not a cascade. Tailwind emits a custom breakpoint before the
 * built-in ones, so overlapping `lg:` / `xl:` / `wide:` rules would be decided
 * by source order rather than by width. Making each band exclusive takes
 * ordering out of it.
 */
export const SHELL_GRID = [
  "grid flex-1 items-start gap-3 p-3",
  "lg:max-xl:grid-cols-[228px_minmax(0,1fr)]",
  "xl:max-wide:grid-cols-[228px_minmax(0,1fr)_312px]",
  "wide:grid-cols-[248px_minmax(0,1fr)_340px]",
].join(" ");
