"use client";

import { SearchX, TriangleAlert } from "lucide-react";
import { StateMessage } from "@/components/feedback/StateMessage";
import { routes } from "@/config/routes";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * `/t/{ticket}` when there is no ticket to show: no ticket has the number, or
 * the check failed. A failure's Try again is a link to the same address, so
 * it works without JavaScript too.
 */
export function TicketUnavailable({
  status,
  ticketId,
}: {
  status: "not_found" | "failed";
  /** Null when the address held no ticket number to repeat. */
  ticketId: string | null;
}) {
  const t = useTranslation();

  if (status === "not_found") {
    return (
      <StateMessage
        icon={<SearchX size={24} strokeWidth={1.5} />}
        title={t.t("ticket.notFoundTitle")}
        body={
          ticketId
            ? t.t("ticket.notFoundBody", { ticket: ticketId })
            : t.t("ticket.notFoundBodyNoNumber")
        }
      />
    );
  }
  return (
    <StateMessage
      icon={<TriangleAlert size={24} strokeWidth={1.5} />}
      title={t.t("ticket.failedTitle")}
      body={t.t("ticket.failedBody")}
      action={
        ticketId
          ? { label: t.t("common.retry"), href: routes.ticket(ticketId) }
          : undefined
      }
    />
  );
}
