import type { Metadata } from "next";
import { Suspense } from "react";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { MyBetsView } from "@/features/bets/components/MyBetsView";

export const metadata: Metadata = { title: "Transactions · KelalSport" };

export default function TransactionsPage() {
  return (
    <Suspense>
      <SportsbookShell>
        <Card className="overflow-hidden">
          <MyBetsView initialView="transactions" />
        </Card>
      </SportsbookShell>
    </Suspense>
  );
}
