"use client";

import { usePathname } from "next/navigation";
import { normaliseBookingCode } from "../lib/code";
import { BookingUnavailable } from "./BookingUnavailable";

/**
 * The 404 for `/b/{code}`. Repeats the code only when it is one: anything else
 * in the address is not echoed onto the brand's page (it could be a crafted
 * message, "call this number to claim your win").
 */
export function BookingNotFound() {
  const segment = usePathname().split("/").pop() ?? "";
  let code: string | null = null;
  try {
    code = normaliseBookingCode(decodeURIComponent(segment));
  } catch {
    // A malformed escape is not a code either.
  }
  return <BookingUnavailable status="not_found" code={code} />;
}
