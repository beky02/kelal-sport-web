import { Suspense } from "react";
import type { Metadata } from "next";
import { SportsbookView } from "@/features/sportsbook/components/SportsbookView";
import { BoardSkeleton } from "@/features/sportsbook/components/BoardSkeleton";

export const metadata: Metadata = { title: "Live · KelalSport" };

export default function LivePage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <SportsbookView live />
    </Suspense>
  );
}
