import { Suspense } from "react";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { BetTicket } from "@/features/bets/components/BetTicket";

export default async function BetTicketPage({
  params,
}: PageProps<"/my-bets/[betId]">) {
  const { betId } = await params;

  return (
    <Suspense>
      <SportsbookShell>
        <Card className="overflow-hidden">
          <BetTicket id={betId} />
        </Card>
      </SportsbookShell>
    </Suspense>
  );
}
