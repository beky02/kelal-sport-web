"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n";
import { PhasePlaceholder } from "./PhasePlaceholder";

/** Titles a placeholder route from the catalogue, so it is bilingual too. */
export function PlaceholderRoute({ messageKey }: { messageKey: MessageKey }) {
  const t = useTranslation();
  return <PhasePlaceholder title={t.t(messageKey)} />;
}
