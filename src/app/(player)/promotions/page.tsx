import type { Metadata } from "next";
import { Suspense } from "react";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { PromotionsView } from "@/features/promotions/components/PromotionsView";

export const metadata: Metadata = { title: "Promotions · KelalSport" };

export default function PromotionsPage() {
  return (
    <Suspense>
      <SportsbookShell>
        {/* Two offers across where there is room; the player's part above them. */}
        <Card className="max-w-[760px] overflow-hidden">
          <PromotionsView />
        </Card>
      </SportsbookShell>
    </Suspense>
  );
}
