"use client";

import { usePathname } from "next/navigation";
import { decodeSegment, normaliseTicketNumber } from "../lib/number";
import { TicketUnavailable } from "./TicketUnavailable";

/**
 * The 404 for `/t/{ticket}`. Repeats the number only when it is one: anything
 * else in the address is not echoed onto the brand's page (it could be a
 * crafted message, "call this number to claim your win").
 */
export function TicketNotFound() {
  const segment = usePathname().split("/").pop() ?? "";
  const ticketId = normaliseTicketNumber(decodeSegment(segment));
  return <TicketUnavailable status="not_found" ticketId={ticketId} />;
}
