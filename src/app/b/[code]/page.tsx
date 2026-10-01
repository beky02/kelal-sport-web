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
import { lookupBooking } from "@/lib/server/bookings";
import { tenantFromHeaders } from "@/lib/server/config";
import { loadPageLocale } from "@/lib/server/public-config";
import { mockPreference } from "@/lib/server/upstream";

/**
 * The tenant, its page locale and the booking — once per request, shared by
 * the metadata and the page (`cache`).
 */
const lookup = cache(async (code: string) => {
  const h = await headers();
  const tenant = tenantFromHeaders(h);
  const [booking, locale] = await Promise.all([
    lookupBooking(tenant, code, mockPreference(h.get("prefer"))),
    loadPageLocale(tenant),
  ]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return {
    booking,
    locale,
    url: new URL(routes.booking(code), `${proto}://${host}`).toString(),
  };
});

/**
 * Open Graph tags for a shared code. Telegram's preview bot (`TelegramBot (like
 * TwitterBot)`) is on Next's HTML-limited list, so it gets them in `<head>`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/b/[code]">): Promise<Metadata> {
  const code = normaliseBookingCode((await params).code);
  if (!code) return { robots: { index: false, follow: false } };
  const { booking, locale, url } = await lookup(code);
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

  const { booking, locale } = await lookup(code);
  if (!locale.bookingCodes || booking.status === "not_found") notFound();

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
