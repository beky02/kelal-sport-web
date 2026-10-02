/**
 * Code 128 (ISO/IEC 15417), code set B — the symbology a shop's USB scanner
 * reads off a ticket (SRS: "Code 128 and QR").
 *
 * Set B covers printable ASCII, which is every character a ticket number or a
 * booking code can have. A symbol is three bars and three spaces, 11 modules
 * wide; a barcode is Start B, one symbol per character, a check character —
 * the mod-103 weighted sum of everything before it — and the 13-module Stop.
 * `tests/unit/code128.test.ts` holds the table to the standard's invariants.
 */

/**
 * Each value's widths in modules, bar first, for values 0–105 (103: Start A,
 * 104: Start B, 105: Start C). Ten to a row, as the standard's table reads.
 */
// prettier-ignore
export const CODE128_PATTERNS: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232",
];

/** Stop: four bars and three spaces, 13 modules, ending on a bar. */
export const CODE128_STOP = "2331112";

const START_B = 104;

/**
 * The symbol values for `text` in code set B: Start B, one per character
 * (ASCII − 32), and the check character. Throws a `RangeError` for an empty
 * text or a character outside printable ASCII — never a wrong barcode.
 */
export function code128Values(text: string): number[] {
  if (text.length === 0) throw new RangeError("Nothing to encode");
  const values = [...text].map((character) => {
    const code = character.charCodeAt(0);
    if (character.length !== 1 || code < 32 || code > 126) {
      throw new RangeError(`Not in Code 128 set B: "${character}"`);
    }
    return code - 32;
  });
  const check =
    values.reduce((sum, value, i) => sum + value * (i + 1), START_B) % 103;
  return [START_B, ...values, check];
}

/**
 * The barcode for `text` as module widths, alternating bar and space, bar
 * first and last. The quiet zone either side is the renderer's to add.
 */
export function code128(text: string): number[] {
  return [
    ...code128Values(text).flatMap((value) =>
      [...CODE128_PATTERNS[value]].map(Number),
    ),
    ...[...CODE128_STOP].map(Number),
  ];
}
