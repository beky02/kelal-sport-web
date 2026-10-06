import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { features } from "@/config/features";
import { SportsbookView } from "@/features/sportsbook/components/SportsbookView";
import { BoardSkeleton } from "@/features/sportsbook/components/BoardSkeleton";

export const metadata: Metadata = { title: "Live · KelalSport" };

export default function LivePage() {
  // In-play betting is Release 2 (D8): until then there is no such page.
  if (!features.live) notFound();

  return (
    <Suspense fallback={<BoardSkeleton />}>
      <SportsbookView live />
    </Suspense>
  );
}
