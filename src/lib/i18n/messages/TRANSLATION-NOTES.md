# Amharic translation provenance

Most Amharic strings in `am.json` are taken verbatim from the design project's
own string tables (`Kelal Desktop.dc.html` → `STR.am`, `Bet Slip.dc.html` →
`S.am`), which were authored alongside the design.

The keys below had no source string and were **composed from vocabulary already
used elsewhere in the design**. They need review by a native speaker before
launch — this is the list to hand over.

| Key                 | Amharic                      | Composed from                            |
| ------------------- | ---------------------------- | ---------------------------------------- |
| `header.openSlip`   | ትኬት ክፈት                      | `ትኬት` (betSlip.title) + ክፈት              |
| `header.profile`    | መገለጫ                         | trimmed from `መገለጫና ቅንብሮች`               |
| `board.empty.title` | ጨዋታ የለም                      | `ጨዋታ` + `የለም` (alerts.insufficientTitle) |
| `board.empty.body`  | በዚህ ቀን የተያዘ ጨዋታ የለም።         | as above + `ቀን` (round labels)           |
| `board.error.title` | ጨዋታዎችን መጫን አልተሳካም            | `ጫን` (load button) + negation            |
| `board.error.body`  | ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ። | `እንደገና ይሞክሩ` (rejection copy)            |
| `common.retry`      | እንደገና ይሞክሩ                   | lifted from the rejection copy           |
| `common.dataSaver`  | ዳታ ቆጣቢ                       | new                                      |

The `board.empty.*` strings were composed at first and have since been **replaced
by authored copy** from `Kelal Desktop.dc.html` — as have every string under
`search`, `footer`, `auth` and `system`, which all come from that file's `STR`
and `OVL` tables. Those need no review.

Everything else traces to the design and should not be changed without changing
it there too.

## Rules when adding a string

1. Add the key to **both** catalogues. `tests/unit/i18n.test.ts` fails on a
   missing or extra key, and on a placeholder that appears in one language only.
2. Never concatenate translated fragments in a component — add a key with a
   `{placeholder}` and let `t()` interpolate.
3. Amharic is not just longer: it needs more line height and no uppercasing.
   That is handled by the `--label-*` and `--leading-body` tokens, keyed off
   `<html lang>`. Don't hardcode `uppercase` or `tracking-*` on a label.

## Later additions needing review

| Key                | Amharic  | Composed from                  |
| ------------------ | -------- | ------------------------------ |
| `a11y.oddsRising`  | ኦድ እየጨመረ | `ኦድ` (design) + new verb       |
| `a11y.oddsFalling` | ኦድ እየቀነሰ | `ኦድ` + `ቀንሰው` (rejection copy) |
| `a11y.inBetSlip`   | በትኬት ውስጥ | `ትኬት` (betSlip.title)          |
| `a11y.suspended`   | ታግዷል     | design (`STR.am.suspended`)    |

These are screen-reader-only strings on every odds button, so they are read more
often than anything visible. Worth getting right.

## Phase-scaffolding and event-page strings

Composed, not from the design. The `common.coming*` pair is scaffolding for
routes that later phases will fill, and should be deleted with the placeholders.

| Key                       | Amharic                                               |
| ------------------------- | ----------------------------------------------------- |
| `common.comingTitle`      | እስካሁን አልተገነባም                                         |
| `common.comingBody`       | ይህ ገጽ በሚቀጥለው ደረጃ ይመጣል። አሁን የሚሠሩት የስፖርት ዝርዝሩና ትኬቱ ናቸው። |
| `common.backToSportsbook` | ወደ ስፖርት ዝርዝር ተመለስ                                     |
| `event.allMarkets`        | ሁሉም                                                   |
| `event.main`              | ዋና                                                    |
| `event.goals`             | ጎሎች                                                   |
| `event.handicap`          | ሃንዲካፕ (design: `markets.am` for Handicap)             |
| `event.correctScore`      | ትክክለኛ ውጤት (design)                                    |
| `event.backToBoard`       | ተመለስ                                                  |
| `event.noMarkets`         | ክፍት ገበያ የለም                                           |
| `event.noMarketsBody`     | በዚህ ጨዋታ ላይ ውርርድ አልተከፈተም።                              |
| `event.notFound`          | ጨዋታው አልተገኘም                                           |
| `event.notFoundBody`      | ይህ ጨዋታ ከዝርዝሩ ወጥቷል።                                    |
