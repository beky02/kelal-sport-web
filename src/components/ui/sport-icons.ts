/**
 * Sport icons as SVG path `d` strings, stroked at 1.5 — see `SportIcon`.
 *
 * Keyed by the dictionary's `icon` value (`football`, `basketball`…). A sport
 * the book adds before an icon exists here falls back to a plain ball.
 */

/** Circle path shared by the ball sports. */
const CIRCLE = "M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20";

const ICONS = {
  football: [
    CIRCLE,
    "m12 7 4.5 3.3-1.7 5.2H9.2l-1.7-5.2z",
    "M12 2v5",
    "m21.5 9.5-5 .8",
    "m2.5 9.5 5 .8",
    "m18 20-3.2-4.5",
    "m6 20 3.2-4.5",
  ],
  basketball: [
    CIRCLE,
    "M4.9 4.9c4 4 4 10.2 0 14.2",
    "M19.1 4.9c-4 4-4 10.2 0 14.2",
    "M2 12h20",
    "M12 2v20",
  ],
  tennis: [CIRCLE, "M6 5.3a9 9 0 0 1 0 13.4", "M18 5.3a9 9 0 0 0 0 13.4"],
  volleyball: [
    CIRCLE,
    "M11.1 7.1a16.55 16.55 0 0 1 10.9 4",
    "M12 12a12.6 12.6 0 0 1-8.7 5",
    "M16.8 13.6a16.55 16.55 0 0 1-9 7.5",
    "M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10",
    "M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5",
  ],
  "table-tennis": [
    "M14.5 15.5a6.5 6.5 0 1 0-6-6z",
    "m14.5 15.5 5 5a1.4 1.4 0 0 0 2-2l-5-5",
    "M19.5 5a1.5 1.5 0 1 0 0 .01",
  ],
  "ice-hockey": ["M4 3l8 12h6a2 2 0 0 1 0 4H10.5L3 8", "M16 21h5"],
} as const;

export const SPORT_ICONS: Record<string, readonly string[]> & {
  default: readonly string[];
} = { ...ICONS, default: [CIRCLE] };
