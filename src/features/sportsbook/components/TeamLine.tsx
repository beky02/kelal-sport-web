import { TeamCrest } from "@/components/ui/TeamCrest";
import type { Team } from "@/features/events/types";

/**
 * One side of a fixture: badge, name, and its live score.
 *
 * The score sits in a fixed-width box so the two lines of a row stay aligned
 * whatever the digits are.
 */
export function TeamLine({
  team,
  name,
  score,
}: {
  team: Team;
  name: string;
  /** Null when the match has not kicked off. */
  score: number | null;
}) {
  return (
    <span className="flex w-full items-center gap-2 text-[13px] font-semibold">
      <TeamCrest crest={team.crest} size={18} />
      <span className="flex-1 truncate">{name}</span>
      {score !== null && (
        // Fixed to the crest's height, so a live row is no taller than any other.
        <span className="bg-raised numeric h-[18px] min-w-5 rounded-[4px] text-center leading-[18px] font-extrabold">
          {score}
        </span>
      )}
    </span>
  );
}
