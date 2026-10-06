import { Suspense } from "react";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { BookingNotFound } from "@/features/bookings/components/BookingNotFound";

/** `/b/{code}` for a code no booking has (404), in the booking's own words. */
export default function BookingNotFoundPage() {
  return (
    <Suspense>
      <SportsbookShell>
        <Card className="overflow-hidden">
          <BookingNotFound />
        </Card>
      </SportsbookShell>
    </Suspense>
  );
}
