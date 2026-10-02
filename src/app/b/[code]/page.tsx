import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache, Suspense } from "react";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/routes";
import { BookingUnavailable } from "@/features/bookings/components/BookingUnavailable";
import { BookingView } from "@/features/bookings/components/BookingView";
import { normaliseBookingCode } from "@/features/bookings/lib/code";
import { bookingMetadata } from "@/features/bookings/lib/metadata";
import type { BookingLookup } from "@/features/bookings/types";
import { lookupBooking } from "@/lib/server/bookings";
import { publicOrigin, tenantFromHeaders } from "@/lib/server/config";
import { loadPageLocale } from "@/lib/server/public-config";
import { mockPreference } from "@/lib/server/upstream";

/**
 * The tenant, its page locale and — when the tenant has booking codes on — the
 * booking: once per request, shared by the metadata and the page (`cache`).
 */
const lookup = cache(async (code: string) => {
  const h = await headers();
  const tenant = tenantFromHeaders(h);
  const locale = await loadPageLocale(tenant);
  const booking: BookingLookup | null = locale.bookingCodes
    ? await lookupBooking(tenant, code, mockPreference(h.get("prefer")))
    : null;
  return {
    booking,
    locale,
    url: `${publicOrigin(h, tenant)}${routes.booking(code)}`,
  };
});

/**
 * Open Graph tags for a shared code. Next streams metadata into `<body>` except
 * for "HTML-limited" bots; Telegram's preview bot is not on that list itself,
 * but its user agent ("TelegramBot (like TwitterBot)") matches `Twitterbot`,
 * so it gets them in `<head>` — `tests/e2e/booking.spec.ts` guards that.
 */
export async function generateMetadata({
  params,
}: PageProps<"/b/[code]">): Promise<Metadata> {
  const raw = (await params).code;
  const code = normaliseBookingCode(raw);
  // A malformed or non-canonical address answers 404 or a redirect: nothing
  // to describe, and nothing worth an upstream call.
  if (!code || code !== raw) return { robots: { index: false, follow: false } };
  const { booking, locale, url } = await lookup(code);
  // Booking codes off for this tenant: the page is a 404 and says nothing.
  if (!booking) return { robots: { index: false, follow: false } };
  return bookingMetadata(booking, { ...locale, url });
}

/**
 * `/b/{code}` — the deep link D7 fixes for a booking, shared from the app and
 * Telegram. Unprefixed until F2a adds `/{lang}`, then it redirects (FD3).
 */
export default async function BookingPage({ params }: PageProps<"/b/[code]">) {
  const raw = (await params).code;
  const code = normaliseBookingCode(raw);
  if (!code) notFound();
  // One address per code: `/b/7kq2m9x` and `/b/7KQ2M9O` are 7KQ2M9X/…0.
  if (code !== raw) redirect(routes.booking(code));

  const { booking } = await lookup(code);
  if (!booking || booking.status === "not_found") notFound();

  return (
    <Suspense>
      <SportsbookShell>
        <Card className="overflow-hidden">
          {booking.status === "ok" ? (
            <BookingView booking={booking.booking} />
          ) : (
            <BookingUnavailable status={booking.status} code={code} />
          )}
        </Card>
      </SportsbookShell>
    </Suspense>
  );
}
