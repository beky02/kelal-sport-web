import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaceholderRoute } from "@/components/feedback/PlaceholderRoute";

export const metadata: Metadata = { title: "Terms · KelalSport" };

export default function Page() {
  return (
    <Suspense>
      <PlaceholderRoute messageKey="footer.terms" />
    </Suspense>
  );
}
