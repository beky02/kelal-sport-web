"use client";

import { useRouter } from "next/navigation";
import { CalendarX2, SearchX, TriangleAlert } from "lucide-react";
import { StateMessage } from "@/components/feedback/StateMessage";
import { routes } from "@/config/routes";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * `/b/{code}` when there is no booking to show: expired, unknown, or the
 * bookings service failed. Expired and unknown lead back to the sportsbook;
 * a failure offers a retry, which asks the server again.
 */
export function BookingUnavailable({
  status,
  code,
}: {
  status: "expired" | "not_found" | "failed";
  /** Null when the address held no well-formed code to repeat. */
  code: string | null;
}) {
  const t = useTranslation();
  const router = useRouter();
  const back = { label: t.t("common.backToSportsbook"), href: routes.home };

  switch (status) {
    case "expired":
      return (
        <StateMessage
          icon={<CalendarX2 size={24} strokeWidth={1.5} />}
          title={t.t("booking.expiredTitle")}
          body={
            code
              ? t.t("booking.expiredBody", { code })
              : t.t("booking.notFoundBodyNoCode")
          }
          action={back}
        />
      );
    case "not_found":
      return (
        <StateMessage
          icon={<SearchX size={24} strokeWidth={1.5} />}
          title={t.t("booking.notFoundTitle")}
          body={
            code
              ? t.t("booking.notFoundBody", { code })
              : t.t("booking.notFoundBodyNoCode")
          }
          action={back}
        />
      );
    case "failed":
      return (
        <StateMessage
          icon={<TriangleAlert size={24} strokeWidth={1.5} />}
          title={t.t("booking.failedTitle")}
          body={t.t("booking.failedBody")}
          action={{
            label: t.t("common.retry"),
            onClick: () => router.refresh(),
          }}
        />
      );
  }
}
