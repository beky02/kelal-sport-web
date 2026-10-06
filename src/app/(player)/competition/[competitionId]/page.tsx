import { Suspense } from "react";
import { CompetitionView } from "@/features/competitions/components/CompetitionView";

export default async function CompetitionPage({
  params,
}: PageProps<"/competition/[competitionId]">) {
  const { competitionId } = await params;

  return (
    <Suspense>
      <CompetitionView competitionId={competitionId} />
    </Suspense>
  );
}
