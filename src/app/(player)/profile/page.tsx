import type { Metadata } from "next";
import { Suspense } from "react";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { ProfileView } from "@/features/profile/components/ProfileView";

export const metadata: Metadata = { title: "Profile & settings · KelalSport" };

export default function ProfilePage() {
  return (
    <Suspense>
      <SportsbookShell>
        {/* Narrower than the board: a settings list at 800px is unreadable. */}
        <Card className="max-w-[620px] overflow-hidden">
          <ProfileView />
        </Card>
      </SportsbookShell>
    </Suspense>
  );
}
