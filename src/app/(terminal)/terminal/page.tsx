import { Suspense } from "react";
import { BoardSkeleton } from "@/features/sportsbook/components/BoardSkeleton";
import { SportsbookView } from "@/features/sportsbook/components/SportsbookView";

/**
 * The kiosk's home (F8ca; `/` on a terminal host): the player's sportsbook
 * page, in the kiosk's chrome. Its filters are in the URL, so it sits in a
 * `<Suspense>` for `useSearchParams`, as the player's home does.
 */
export default function TerminalHomePage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <SportsbookView />
    </Suspense>
  );
}
