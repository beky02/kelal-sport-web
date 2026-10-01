import { Suspense } from "react";
import { SportsbookView } from "@/features/sportsbook/components/SportsbookView";
import { BoardSkeleton } from "@/features/sportsbook/components/BoardSkeleton";

/**
 * Suspense boundary because the board reads its filters from the URL, and
 * `useSearchParams` opts a subtree out of static rendering without one.
 */
export default function SportsbookPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <SportsbookView />
    </Suspense>
  );
}
