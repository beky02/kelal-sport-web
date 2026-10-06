import type { Metadata } from "next";
import { Suspense } from "react";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { WalletView } from "@/features/wallet/components/WalletView";

export const metadata: Metadata = { title: "Wallet · KelalSport" };

export default function WalletPage() {
  return (
    <Suspense>
      <SportsbookShell>
        <Card className="overflow-hidden">
          <WalletView />
        </Card>
      </SportsbookShell>
    </Suspense>
  );
}
