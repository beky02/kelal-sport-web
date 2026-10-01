"use client";

import { usePathname } from "next/navigation";
import { BookingUnavailable } from "./BookingUnavailable";

/** The 404 for `/b/{code}`: the code comes from the address, as typed. */
export function BookingNotFound() {
  const code = decodeURIComponent(usePathname().split("/").pop() ?? "");
  return <BookingUnavailable status="not_found" code={code} />;
}
