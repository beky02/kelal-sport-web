/**
 * The board's column tracks, shared by the header and every row so prices stay
 * in line down the page.
 *
 * The team column has a 200px floor so league and team names still fit at the
 * narrow desktop width; the three market groups shrink from 180px rather than
 * pushing it. Below 1280 the extra market groups are dropped instead of
 * squeezed — an odds button at 40px is worse than one that is absent.
 *
 *   < 768px   teams, then 1X2 beneath      (stacked)
 *   ≥ 768px   teams · 1X2 · more
 *   ≥ 1280px  teams · 1X2 · double chance · total goals · more
 */
export const BOARD_GRID =
  "grid grid-cols-1 md:grid-cols-[minmax(200px,1fr)_minmax(0,180px)_56px] xl:grid-cols-[minmax(200px,1fr)_repeat(3,minmax(0,180px))_56px]";

/** Market groups beyond 1X2 only appear once there is room for them. */
export const HIDE_BELOW_XL = "hidden xl:grid";
