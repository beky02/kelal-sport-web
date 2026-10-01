import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthRoute } from "@/features/auth/components/AuthRoute";

export const metadata: Metadata = { title: "Register · KelalSport" };

export default function Page() {
  return (
    <Suspense>
      <AuthRoute step="phone" />
    </Suspense>
  );
}
