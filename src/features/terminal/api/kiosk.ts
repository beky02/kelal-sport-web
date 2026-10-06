import { terminalConfigSchema } from "@/lib/api/terminal-schemas";
import type { Lang } from "@/types/common";
import { TERMINAL_READS } from "../lib/calls";
import type { TerminalConfigView } from "../types";
import { terminalRead } from "./client";

/**
 * The tenant's shop switch and languages (F8ca). The kiosk's catalogue —
 * board, sports, leagues, a match, search — is read by the player's own
 * fetchers, sent to `/api/terminal/` by the terminal's `<html data-api>`.
 */
export const getTerminalConfig = (
  lang: Lang,
  signal?: AbortSignal,
): Promise<TerminalConfigView> =>
  terminalRead(TERMINAL_READS.config, terminalConfigSchema, { lang, signal });
