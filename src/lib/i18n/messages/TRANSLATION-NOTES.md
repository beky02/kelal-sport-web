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

## Calendar preference

Composed, not from the design. The design showed Ethiopian dates whenever the
language was Amharic; Release 1 shows Gregorian dates by default (D7) and makes
the Ethiopian calendar a setting in Profile → Preferences.

| Key                                | Amharic                      |
| ---------------------------------- | ---------------------------- |
| `profile.calendar`                 | የቀን አቆጣጠር                    |
| `profile.gregorian`                | ጎርጎርዮሳዊ                      |
| `profile.ethiopianCalendar`        | የኢትዮጵያ (as `ethiopianClock`) |
| `profile.calendarExampleGregorian` | ኦክቶበር 4 እንደ 04/10 ይታያል       |
| `profile.calendarExampleEthiopian` | 04/10 እንደ መስ 24 ይታያል         |

## Slip calculator (F3a)

Composed, not from the design: D1's warnings and errors, the total-stake label and
the rule-set loading states. They speak about money, so they need review for meaning
as well as wording. `ቦነስ` and `አኩሙሌተር` are transliterations.

| Key                                | Amharic                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `betSlip.totalStake`               | ጠቅላላ የውርርድ መጠን                                                                                                |
| `betSlip.linesTimesStake`          | {lines} ውርርዶች × {amount}                                                                                      |
| `betSlip.accaBonus`                | የአኩሙሌተር ቦነስ                                                                                                   |
| `betSlip.rulesLoading`             | የውርርድ ደንቦች እየተጫኑ ነው…                                                                                          |
| `betSlip.rulesFailed`              | የውርርድ ደንቦችን መጫን አልተሳካም                                                                                        |
| `betSlip.warnings.remainder`       | {amount} በ{lines} ውርርዶች እኩል አይከፈልም፤ የሚከፍሉት {charged} ነው።                                                      |
| `betSlip.warnings.bonusCapped`     | የአኩሙሌተር ቦነስ በ{amount} ተገድቧል።                                                                                  |
| `betSlip.warnings.maxPayout`       | ከፍተኛው ክፍያ {amount} ደርሷል።                                                                                      |
| `betSlip.errors.stakeTooLowTitle`  | የውርርድ መጠኑ ዝቅተኛ ነው                                                                                             |
| `betSlip.errors.stakeTooLowBody`   | ዝቅተኛው ጠቅላላ የውርርድ መጠን {amount} ነው።                                                                             |
| `betSlip.errors.stakeTooHighTitle` | የውርርድ መጠኑ ከፍተኛ ነው                                                                                             |
| `betSlip.errors.stakeTooHighBody`  | ከፍተኛው ጠቅላላ የውርርድ መጠን {amount} ነው።                                                                             |
| `betSlip.errors.tooManyLegsTitle`  | ምርጫዎች በዝተዋል                                                                                                   |
| `betSlip.errors.tooManyLegsBody`   | አንድ ትኬት እስከ {n} ምርጫዎች ይይዛል። ለመቀጠል የተወሰኑትን ያስወግዱ።                                                              |
| `betSlip.errors.tooManyLinesTitle` | ጥምረቶች በዝተዋል                                                                                                   |
| `betSlip.errors.tooManyLinesBody`  | ሲስተም እስከ {n} ውርርዶች ይይዛል። ትንሽ መጠን ይምረጡ ወይም ጥምር ይጠቀሙ።                                                           |
| `betSlip.errors.useMultiple`       | ጥምር                                                                                                           |
| `betSlip.errors.cannotPriceTitle`  | ይህን ትኬት ማስላት አይቻልም                                                                                            |
| `betSlip.errors.cannotPriceBody`   | ከኦዶቹ አንዱ ትክክል አይደለም። ያስወግዱት ወይም ቆይተው ይሞክሩ።                                                                    |
| `betSlip.withholdingTax`           | የተቀናሽ ግብር                                                                                                     |
| `betSlip.levy`                     | ቀረጥ                                                                                                           |
| `betSlip.tax`                      | ግብር                                                                                                           |
| `betSlip.placeFailedBody`          | ውርርዱን ማስያዝ አልተሳካም። እንደገና ይሞክሩ።                                                                                |
| `bets.stakeTaxRefund`              | የውርርድ ግብር ተመላሽ                                                                                                |
| `betSlip.taxRate`                  | {tax} · {rate}                                                                                                |
| `betSlip.taxRateOver`              | {tax} · ድሉ ከ{amount} ሲበልጥ ከጠቅላላው {rate} — must say the **whole** win is taxed once over the threshold (D1.8)  |
| `betSlip.taxRateStakeOver`         | {tax} · ጠቅላላ የውርርድ መጠኑ ከ{amount} ሲበልጥ {rate}                                                                  |
| `betSlip.errors.stakeTooLowBody`   | ይህ ትኬት የሚቀበለው ዝቅተኛው የውርርድ መጠን {amount} ነው። — the amount can be above the tenant minimum (rounded up per line) |

## Booking codes (F3b)

Composed, not from the design. "Booking code" follows the design's own term, `የትኬት ኮድ` (slip code). `booking.og.*` and `booking.pageTitle` appear in Telegram link previews in the tenant's default language (Amharic for `demo`), so they are read before the site is.

| Key                               | Amharic                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| `booking.validUntil`              | እስከ {day} {date}፣ {time} ያገለግላል                             |
| `booking.shareText`               | የውርርድ ትኬት {code}                                            |
| `booking.loaded`                  | የትኬት ኮድ {code} ትኬትዎ ውስጥ ገብቷል።                               |
| `booking.notAddedTitle`           | አልተጨመሩም፤ ከእንግዲህ አይገኙም፦                                      |
| `booking.notAddedLeg`             | {event} · {pick}፦ {reason}                                  |
| `booking.sizesNote`               | ይህ ኮድ የሲስተም መጠኖችን {sizes} ያጣምራል። ትኬቱ {k} ያሳያል።              |
| `booking.dismiss`                 | ዝጋ                                                          |
| `booking.loadIntoSlip`            | ወደ ትኬት ጫን                                                   |
| `booking.replacesSlip`            | ትኬትዎ ውስጥ ያሉትን {n} ምርጫዎች ይተካል።                               |
| `booking.stakeHint`               | የተጠቆመ የውርርድ መጠን                                             |
| `booking.pageTitle`               | የውርርድ ትኬት {code}                                            |
| `booking.selections`              | ምርጫዎች                                                       |
| `booking.wasOdds`                 | ቀድሞ {odds}                                                  |
| `booking.expiredTitle`            | ይህ ኮድ ጊዜው አልፏል                                              |
| `booking.expiredBody`             | ኮድ {code} ከእንግዲህ መጫን አይቻልም። አዲስ ኮድ ይጠይቁ ወይም ትኬቱን እንደገና ይሥሩ። |
| `booking.notFoundTitle`           | በዚህ ኮድ የተቀመጠ ትኬት የለም                                        |
| `booking.notFoundBody`            | ኮድ {code}ን ያረጋግጡና እንደገና ይሞክሩ።                               |
| `booking.failedTitle`             | ይህን ትኬት መጫን አልተሳካም                                          |
| `booking.failedBody`              | ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።                                |
| `booking.invalidCode`             | የትኬት ኮድ 7 ፊደላትና ቁጥሮች ነው፤ ለምሳሌ 7KQ2M9X።                      |
| `booking.reason.EVENT_STARTED`    | ጨዋታው ተጀምሯል                                                  |
| `booking.reason.MARKET_SUSPENDED` | ውርርድ ቆሟል                                                    |
| `booking.reason.MARKET_CLOSED`    | ገበያው ተዘግቷል                                                  |
| `booking.reason.NOT_FOUND`        | ከእንግዲህ አይቀርብም                                               |
| `booking.reason.UNPRICED`         | አሁን ዋጋ የለውም                                                 |
| `booking.errors.expired`          | ኮድ {code} ጊዜው አልፏል።                                         |
| `booking.errors.notFound`         | በኮድ {code} የተቀመጠ ትኬት የለም። ያረጋግጡና እንደገና ይሞክሩ።                |
| `booking.errors.rateLimited`      | አሁን በጣም ብዙ የትኬት ኮዶች ተሠርተዋል። ቆይተው ይሞክሩ።                      |
| `booking.errors.cannotBook`       | ይህ ትኬት እንዳለ ሊቀመጥ አይችልም።                                     |
| `booking.errors.failed`           | የትኬት ኮድ አገልግሎቱን ማግኘት አልተቻለም። እንደገና ይሞክሩ።                    |
| `booking.og.description`          | ምርጫዎች፦ {picks}                                              |
| `booking.og.expired`              | ይህ የትኬት ኮድ ጊዜው አልፏል።                                        |
| `booking.og.notFound`             | በዚህ ኮድ የተቀመጠ ትኬት የለም።                                       |
