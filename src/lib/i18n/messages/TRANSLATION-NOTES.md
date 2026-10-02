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
| `booking.dismiss`                 | ዝጋ                                                          |
| `booking.loadIntoSlip`            | ወደ ትኬት ጫን                                                   |
| `booking.stakeHint`               | የተጠቆመ የውርርድ መጠን                                             |
| `booking.pageTitle`               | የውርርድ ትኬት {code}                                            |
| `booking.selections`              | ምርጫዎች                                                       |
| `booking.wasOdds`                 | ቀድሞ {odds}                                                  |
| `booking.expiredTitle`            | ይህ ኮድ ጊዜው አልፏል                                              |
| `booking.expiredBody`             | ኮድ {code} ከእንግዲህ መጫን አይቻልም። አዲስ ኮድ ይጠይቁ ወይም ትኬቱን እንደገና ይሥሩ። |
| `booking.notFoundTitle`           | በዚህ ኮድ የተቀመጠ ትኬት የለም                                        |
| `booking.notFoundBody`            | ኮድ {code}ን ያረጋግጡና እንደገና ይሞክሩ።                               |
| `booking.failedTitle`             | ይህን ትኬት መጫን አልተሳካም                                          |
| `booking.invalidCode`             | የትኬት ኮድ 7 ፊደላትና ቁጥሮች ነው፤ ለምሳሌ 7KQ2M9X።                      |
| `booking.reason.EVENT_STARTED`    | ጨዋታው ተጀምሯል                                                  |
| `booking.reason.MARKET_SUSPENDED` | ውርርድ ቆሟል                                                    |
| `booking.reason.MARKET_CLOSED`    | ገበያው ተዘግቷል                                                  |
| `booking.reason.NOT_FOUND`        | ከእንግዲህ አይቀርብም                                               |
| `booking.reason.UNPRICED`         | አሁን ዋጋ የለውም                                                 |
| `booking.errors.notFound`         | በኮድ {code} የተቀመጠ ትኬት የለም። ያረጋግጡና እንደገና ይሞክሩ።                |
| `booking.errors.rateLimited`      | አሁን በጣም ብዙ የትኬት ኮዶች ተሠርተዋል። ቆይተው ይሞክሩ።                      |
| `booking.errors.cannotBook`       | ይህ ትኬት እንዳለ ሊቀመጥ አይችልም።                                     |
| `booking.errors.failed`           | የትኬት ኮድ አገልግሎቱን ማግኘት አልተቻለም። እንደገና ይሞክሩ።                    |
| `booking.og.description`          | ምርጫዎች፦ {picks}                                              |
| `booking.og.expired`              | ይህ የትኬት ኮድ ጊዜው አልፏል።                                        |
| `booking.og.notFound`             | በዚህ ኮድ የተቀመጠ ትኬት የለም።                                       |

### F3b verification (2026-10-02)

Added or reworded after review; composed, need native review like the rest of this section.

| Key                          | Amharic                                             |
| ---------------------------- | --------------------------------------------------- |
| `booking.nothingAdded`       | ከትኬት ኮድ {code} አሁን ምንም መጨመር አይቻልም።                  |
| `booking.sizesNote`          | ይህ ኮድ የ{sizes} ሲስተም ነው፤ ትኬቱ {k}/{n} ያሰላል።           |
| `booking.sizesNoteMultiple`  | ይህ ኮድ የ{sizes} ሲስተም ነው፤ በቀሩት ምርጫዎች ትኬቱ ጥምር ያሰላል።    |
| `booking.sizesSeparator`     | ፣                                                   |
| `booking.notFoundBodyNoCode` | ኮዱን ያረጋግጡና እንደገና ይሞክሩ።                              |
| `booking.replacesSlip`       | መጫን አሁን ትኬትዎ ውስጥ ያለውን ይተካል።                         |
| `booking.failedBody`         | አሁን መጫን አልተቻለም። እንደገና ይሞክሩ።                         |
| `booking.notAddedLeg`        | {event} · {market} · {pick}፦ {reason}               |
| `booking.booked`             | ተቀምጧል                                               |
| `booking.openSlip`           | ትኬቱን ክፈት                                            |
| `booking.reason.INCOMPLETE`  | ማረጋገጥ አይቻልም                                         |
| `booking.errors.expired`     | ኮድ {code} ጊዜው አልፏል። አዲስ ኮድ ይጠይቁ ወይም ትኬቱን እንደገና ይሥሩ። |

## F4a — session and login (2026-10-02)

Composed, not from the design: the design had no copy for the API's refusals or
for a new device's code. `auth.logInAgain` reuses `system.sessionLogIn`'s words.
`system.sessionBody` was rewritten in both languages because the API makes no
promise about "30 minutes without activity"; it now says only that the session
has ended.

| Key                                    | Amharic                                         | Composed from                                    |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `auth.errors.AUTH_INVALID_CREDENTIALS` | የስልክ ቁጥሩ ወይም የይለፍ ቃሉ ትክክል አይደለም።                | `auth.phone`, `auth.password` + negation         |
| `auth.errors.AUTH_LOCKED`              | በጣም ብዙ ያልተሳኩ ሙከራዎች። መለያዎ ለአጭር ጊዜ ተቆልፏል።         | `መለያ` (auth.createTitle) + new                   |
| `auth.errors.AUTH_OTP_INVALID`         | ኮዱ ትክክል አይደለም። ኤስኤምኤሱን ያረጋግጡና እንደገና ይሞክሩ።       | `ኮድ`, `ኤስኤምኤስ` (auth.otp*) + `እንደገና ይሞክሩ`        |
| `auth.errors.AUTH_OTP_EXPIRED`         | ኮዱ ጊዜው አልፎበታል። አዲስ ለማግኘት እንደገና ይግቡ።             | `ኮድ` + `ይግቡ` (header.login)                      |
| `auth.errors.RATE_LIMITED`             | በጣም ብዙ ሙከራዎች። ትንሽ ቆይተው እንደገና ይሞክሩ።              | `እንደገና ይሞክሩ` (rejection copy)                    |
| `auth.errors.failed`                   | ችግር ተፈጥሯል። ግንኙነትዎን ያረጋግጡና እንደገና ይሞክሩ።           | `board.error.body`                               |
| `auth.newDeviceBody`                   | አዲስ መሣሪያ። እርስዎ መሆንዎን ለማረጋገጥ ወደ {phone} ኮድ ልከናል። | `auth.otpSentTo` + new                           |
| `system.sessionBody`                   | ቆይታዎ አብቅቷል። ለመቀጠል እንደገና ይግቡ። ትኬትዎ ተቀምጧል።        | `system.sessionTitle`, former body's last clause |
| `header.accountLoading`                | መለያዎ እየተጫነ ነው…                                  | `መለያ` + new (screen readers only)                |
| `wallet.withdrawUnavailable`           | በመለያዎ ላይ ገንዘብ ማውጣት አሁን አይቻልም።                   | `wallet.kycLock` vocabulary                      |

## F4b — registration, reset and Fayda (2026-10-02)

Composed, not from the design: the design had no copy for the API's refusals,
the reset code, the new details step or any Fayda result but "pending".
`auth.pendingBody` was rewritten in both languages because no source promises
"under 10 minutes" or an SMS; it now says only that the ID is being reviewed.
`auth.ruleLetterNumber`, `auth.stepPassword`, `auth.passwordTitle` and `auth.required` were removed (C01 §2: no
composition rules; the third step is now "Details"). "Session" follows
`system.sessionBody` (ቆይታ); "Done" follows `wallet.done`.

| Key                                    | Amharic                                             | Composed from                                   |
| -------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `auth.stepDetails`                     | መረጃ                                                 | new                                             |
| `auth.detailsTitle`                    | የእርስዎ መረጃ                                           | new                                             |
| `auth.detailsBody`                     | በፋይዳ መታወቂያዎ ላይ እንዳሉት ያስገቡ — ሲያረጋግጡ እናዛምዳቸዋለን።       | `auth.fullName` ("…እንዳለው"), `auth.faydaTitle`   |
| `auth.fullNameInvalid`                 | ሙሉ ስምዎን በመታወቂያዎ ላይ እንዳለው ያስገቡ።                      | `auth.fullName` + `ያስገቡ` (auth.finInvalid)      |
| `auth.dateOfBirthInvalid`              | ትክክለኛ ቀን በቀን/ወር/ዓመት (DD/MM/YYYY) ያስገቡ።              | new; the format kept in Latin as typed          |
| `auth.fieldInvalid`                    | ይህንን ያረጋግጡና እንደገና ይሞክሩ።                             | `auth.errors.AUTH_OTP_INVALID`                  |
| `auth.faydaCodeBody`                   | ፋይዳ ከመታወቂያዎ ጋር ወደተመዘገበው {phone} ኮድ ልኳል።             | `auth.newDeviceBody` ("ወደ {phone} ኮድ ልከናል")     |
| `auth.verified`                        | ተረጋግጧል                                              | `auth.faydaTitle` (በፋይዳ የተረጋገጠ)                 |
| `auth.kycVerifiedTitle`                | ማንነትዎ ተረጋግጧል                                        | `auth.kycTitle` (ማንነትዎን ያረጋግጡ)                  |
| `auth.kycVerifiedBody`                 | የፋይዳ መታወቂያዎ ከመለያዎ ጋር ይዛመዳል።                         | new                                             |
| `auth.pendingBody`                     | መታወቂያዎን እየገመገምን ነው። ሲጠናቀቅ እናሳውቅዎታለን።                | former body's last clause                       |
| `auth.needsInfo`                       | ትኩረት ይፈልጋል                                          | new                                             |
| `auth.needsInfoTitle`                  | መረጃዎን ማዛመድ አልቻልንም                                   | new                                             |
| `auth.kycReason.NAME_MISMATCH`         | በፋይዳ መታወቂያዎ ላይ ያለው ስም በመለያዎ ላይ ካለው ስም ጋር አይዛመድም።    | new                                             |
| `auth.kycReason.DOB_MISMATCH`          | በፋይዳ መታወቂያዎ ላይ ያለው የትውልድ ቀን በመለያዎ ላይ ካለው ጋር አይዛመድም። | `auth.dateOfBirth` (የትውልድ ቀን)                   |
| `auth.kycReason.DOC_UNREADABLE`        | መታወቂያዎን ማንበብ አልቻልንም።                                | new                                             |
| `auth.kycReason.UNDERAGE`              | የፋይዳ መታወቂያዎ ዕድሜዎ ከሕጋዊው ዕድሜ በታች መሆኑን ያሳያል።           | `auth.age` (ዕድሜ)                                |
| `auth.kycReason.OTHER`                 | እርስዎን ለማረጋገጥ ተጨማሪ መረጃ እንፈልጋለን።                      | new                                             |
| `auth.rejected`                        | አልተረጋገጠም                                            | negation of `auth.verified`                     |
| `auth.rejectedTitle`                   | መታወቂያዎን ማረጋገጥ አልቻልንም                                | new                                             |
| `auth.rejectedBody`                    | ከመገለጫዎ ድጋፍን ያግኙ፤ እንረዳዎታለን።                          | `profile.support` (ድጋፍ)                         |
| `auth.tryAgain`                        | እንደገና ይሞክሩ                                          | rejection copy                                  |
| `auth.done`                            | ተጠናቀቀ                                               | `wallet.done`                                   |
| `auth.resetCodeBody`                   | {phone} መለያ ካለው ኮድ ልከንለታል።                          | `auth.newDeviceBody` + `መለያ`                    |
| `auth.newPasswordTitle`                | አዲስ የይለፍ ቃል ያስገቡ                                    | the former `auth.passwordTitle`                 |
| `auth.newPassword`                     | አዲስ የይለፍ ቃል                                         | `auth.password`                                 |
| `auth.savePassword`                    | የይለፍ ቃሉን አስቀምጥ                                      | `auth.password` + new                           |
| `auth.passwordChanged`                 | የይለፍ ቃልዎ ተቀይሯል። በአዲሱ የይለፍ ቃል ይግቡ።                   | `auth.password`, `ይግቡ` (header.login)           |
| `auth.logInInstead`                    | በምትኩ ይግቡ                                            | `ይግቡ` + new                                     |
| `auth.sendNewCode`                     | አዲስ ኮድ ላክ                                           | `auth.sendCode` (ኮድ ላክ)                         |
| `auth.errors.otpExpiredResend`         | ኮዱ ጊዜው አልፎበታል። አዲስ ልንልክልዎ እንችላለን።                   | `auth.errors.AUTH_OTP_EXPIRED`'s first sentence |
| `auth.errors.AUTH_OTP_UNAVAILABLE`     | አሁን ኤስኤምኤስ መላክ አልቻልንም። ከጥቂት ደቂቃዎች በኋላ እንደገና ይሞክሩ።   | `ኤስኤምኤስ` (auth.phoneHelp) + `እንደገና ይሞክሩ`        |
| `auth.errors.REG_PHONE_TAKEN`          | ይህ ስልክ ቁጥር ቀድሞውኑ መለያ አለው።                           | `auth.phone`, `መለያ`                             |
| `auth.errors.REG_UNDERAGE`             | መለያ ለመክፈት ሕጋዊ ዕድሜ ላይ መድረስ አለብዎት።                    | `auth.createTitle` (መለያ ይክፈቱ), `auth.age`       |
| `auth.errors.REG_ID_TAKEN`             | ይህ መታወቂያ ከሌላ መለያ ጋር ተያይዟል። ድጋፍን ያግኙ።                | `መታወቂያ`, `profile.support`                      |
| `auth.errors.KYC_PROVIDER_UNAVAILABLE` | ፋይዳ አሁን አይገኝም። በኋላ ከመገለጫዎ ማረጋገጥ ይችላሉ።               | `auth.doThisLater` (በኋላ), `profile` (መገለጫ)      |
| `auth.errors.AUTH_TOKEN_EXPIRED`       | ቆይታዎ አብቅቷል። ለመቀጠል እንደገና ይግቡ።                        | `system.sessionBody`'s first two sentences      |
| `auth.errors.VALIDATION_FAILED`        | አንዳንድ መረጃዎች መስተካከል አለባቸው።                           | new                                             |

### F4b, before merge (2026-10-02)

The ID step's copy was cut to what a source backs (the user's decision): SRS KYC-04 blocks withdrawals
until the ID is verified; nothing backs "Ethiopian law requires…" (C02 §2 TBD-1), "about 2 minutes",
or "You can deposit and bet now" (C02 §9 allows a deposit threshold). The age consent now states the
tenant's `legal.min_age`.

| Key                              | Amharic                                               | Composed from                                   |
| -------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| `auth.kycBody`                   | አሸናፊነትዎን ከማውጣትዎ በፊት የማንነት ማረጋገጫ ያስፈልጋል።               | former body without "በሕግ" (by law) and the time |
| `auth.laterNote`                 | መታወቂያዎ እስኪረጋገጥ ገንዘብ ማውጣት አይቻልም።                       | former note's second sentence                   |
| `auth.age`                       | ዕድሜዬ {age} ዓመት ወይም ከዚያ በላይ ነው                         | former copy, 21 → `{age}`                       |
| `auth.ageNote`                   | ውርርድ ለ{age}+ ዓመት ብቻ ነው። ይህንን ከፋይዳ መታወቂያዎ ጋር እናረጋግጣለን። | former copy, 21 → `{age}`                       |
| `auth.errors.termsUpdated`       | ደንቦቻችን ተሻሽለዋል። እባክዎ አንብበው እንደገና ይቀበሉ።                 | `auth.termsLink` (ደንቦቹን), `auth.termsConsent`   |
| `auth.errors.rateLimitedSeconds` | በጣም ብዙ ሙከራዎች። ከ{seconds} ሰከንድ በኋላ እንደገና ይሞክሩ።         | `auth.errors.RATE_LIMITED` + wait               |
| `auth.errors.rateLimitedMinutes` | በጣም ብዙ ሙከራዎች። ከ{minutes} ደቂቃ በኋላ እንደገና ይሞክሩ።          | `auth.errors.RATE_LIMITED` + wait               |

### F4b, review fixes before merge (2026-10-02)

The UI review found two Amharic strings that read wrongly: `auth.resetTitle` said only "Password", and
`auth.kycBody`'s "አሸናፊነት" reads as "victory", not money won.

| Key                        | Amharic                                  | Composed from                              |
| -------------------------- | ---------------------------------------- | ------------------------------------------ |
| `auth.resetTitle`          | የይለፍ ቃል ዳግም ማስጀመር                        | `auth.forgotTitle` (…ዳግም ያስጀምሩ), as a noun |
| `auth.kycBody`             | ያሸነፉትን ገንዘብ ለማውጣት የተረጋገጠ መታወቂያ ያስፈልግዎታል። | new: "the money you won"                   |
| `auth.opensInNewTab`       | (በአዲስ ትር ይከፈታል)                          | new (screen readers only)                  |
| `auth.dateOfBirthHelp`     | ቀን / ወር / ዓመት (DD/MM/YYYY)               | `auth.dateOfBirthInvalid`                  |
| `auth.fullNamePlaceholder` | አበበ ከበደ ተስፋዬ                             | the English example, in Ethiopic           |
| `auth.ruleMet`             | (ተሟልቷል)                                  | new (screen readers only)                  |
| `auth.ruleNotMet`          | (ገና አልተሟላም)                              | new (screen readers only)                  |

## Placing a bet (F5a, 2026-10-02)

Composed, not from the design, for review. The odds-change setting replaces the switch
`betSlip.acceptAnyChange` ("ማንኛውንም የኦድ ለውጥ ተቀበል"), whose words it reuses.

| Key                         | Amharic      | Composed from                                     |
| --------------------------- | ------------ | ------------------------------------------------- |
| `betSlip.oddsPolicy.label`  | ኦድ ሲቀየር      | `ኦድ` (design) + `ሲቀየር` ("when it changes")        |
| `betSlip.oddsPolicy.none`   | ጠይቀኝ         | new: "ask me", imperative like the slip's buttons |
| `betSlip.oddsPolicy.higher` | ከፍ ያለውን ተቀበል | `ተቀበል` (`betSlip.accept`) + "the higher one"      |
| `betSlip.oddsPolicy.any`    | ማንኛውንም ተቀበል  | `betSlip.acceptAnyChange` without "odds change"   |
