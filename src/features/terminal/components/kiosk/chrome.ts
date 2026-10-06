import { routes } from "@/config/routes";
import {
  BARE_CHROME,
  type SportsbookChrome,
} from "@/features/sportsbook/chrome";
import { KioskShell } from "./KioskShell";

/**
 * The shop kiosk around the sportsbook (`features/sportsbook/chrome.tsx`,
 * F8ca): its own frame, and its own addresses under `/terminal`; no realtime
 * (Release 2), no data saver, no favourites, no leagues drawer, and nothing
 * that locks prices beyond the market — a kiosk has no player to take a break.
 */
export const KIOSK_CHROME: SportsbookChrome = {
  ...BARE_CHROME,
  Shell: KioskShell,
  links: {
    home: routes.home,
    event: (id) => `${routes.terminal}/event/${encodeURIComponent(id)}`,
    competition: (id) =>
      `${routes.terminal}/competition/${encodeURIComponent(id)}`,
  },
};
