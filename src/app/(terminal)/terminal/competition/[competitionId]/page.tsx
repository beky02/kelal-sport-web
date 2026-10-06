import { Suspense } from "react";
import { CompetitionView } from "@/features/competitions/components/CompetitionView";

/** A league on the kiosk (F8ca): the player's league page, in the kiosk's chrome. */
export default async function TerminalCompetitionPage({
  params,
}: PageProps<"/terminal/competition/[competitionId]">) {
  const { competitionId } = await params;
  return (
    <Suspense>
      <CompetitionView competitionId={competitionId} />
    </Suspense>
  );
}
