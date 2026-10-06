import { z } from "zod";
import type { BoardSection } from "@/features/events/types";
import type { Sport } from "@/features/sports/types";
import { boardSectionSchema, sportSchema } from "@/lib/api/catalogue-schemas";
import { terminalConfigSchema } from "@/lib/api/terminal-schemas";
import type { Lang } from "@/types/common";
import { TERMINAL_READS } from "../lib/calls";
import type { KioskBoardFilters, TerminalConfigView } from "../types";
import { terminalRead } from "./client";

const sportsSchema = z.array(sportSchema);
const boardSchema = z.array(boardSectionSchema);

/** The tenant's shop switch and languages (F8ca). */
export const getTerminalConfig = (
  lang: Lang,
  signal?: AbortSignal,
): Promise<TerminalConfigView> =>
  terminalRead(TERMINAL_READS.config, terminalConfigSchema, { lang, signal });

/** The sport tabs. */
export const getKioskSports = (
  lang: Lang,
  signal?: AbortSignal,
): Promise<Sport[]> =>
  terminalRead(TERMINAL_READS.sports, sportsSchema, { lang, signal });

/**
 * One sport's competitions and matches on one day, with the prices a row
 * shows, as the player's board has them (the same loader and schema), before
 * kick-off only.
 */
export const getKioskBoard = (
  { sportId, date, filter }: KioskBoardFilters,
  lang: Lang,
  signal?: AbortSignal,
): Promise<BoardSection[]> =>
  terminalRead(TERMINAL_READS.board, boardSchema, {
    lang,
    params: { sport: sportId, date, filter },
    signal,
  });
