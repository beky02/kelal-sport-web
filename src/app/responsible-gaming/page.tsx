import type { Metadata } from "next";
import { Suspense } from "react";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { ResponsibleGamingView } from "@/features/responsible-gaming/components/ResponsibleGamingView";

export const metadata: Metadata = {
  title: "Responsible gaming · KelalSport",
};

export default function ResponsibleGamingPage() {
  return (
    <Suspense>
      <SportsbookShell>
        <Card className="overflow-hidden">
          <ResponsibleGamingView />
        </Card>
      </SportsbookShell>
    </Suspense>
  );
}
