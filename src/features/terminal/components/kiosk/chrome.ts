import { ODDS_REFRESH_MS } from "@/config/constants";
import { routes } from "@/config/routes";
import {
  BARE_CHROME,
  type SportsbookChrome,
} from "@/features/sportsbook/chrome";
import { useOnline } from "../../hooks/use-online";
import { KioskShell } from "./KioskShell";

/**
 * The shop kiosk around the sportsbook (`features/sportsbook/chrome.tsx`,
 * F8ca): its own frame, and its own addresses under `/terminal`; no realtime,
 * so prices are always polled (every 30 s, D5), whatever the build's realtime
 * setting — the kiosk has no channel to deliver them; no data saver, no
 * favourites, no leagues drawer (terminals are PC screens, C19 §11: the
 * sidebar is there from `lg`). Prices lock while the PC is offline — what is
 * on screen may already be wrong, as on the player's site — but never for a
 * break: a kiosk has no player to take one (review Q4).
 */
export const KIOSK_CHROME: SportsbookChrome = {
  ...BARE_CHROME,
  Shell: KioskShell,
  pricePollMs: ODDS_REFRESH_MS,
  useOddsLocked: () => !useOnline(),
  links: {
    home: routes.home,
    event: (id) => `${routes.terminal}/event/${encodeURIComponent(id)}`,
    competition: (id) =>
      `${routes.terminal}/competition/${encodeURIComponent(id)}`,
  },
};
