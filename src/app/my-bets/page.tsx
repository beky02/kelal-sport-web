import type { Metadata } from "next";
import { Suspense } from "react";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { MyBetsView } from "@/features/bets/components/MyBetsView";

export const metadata: Metadata = { title: "My bets · KelalSport" };

export default function MyBetsPage() {
  return (
    <Suspense>
      <SportsbookShell>
        <Card className="overflow-hidden">
          <MyBetsView />
        </Card>
      </SportsbookShell>
    </Suspense>
  );
}
