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

The engine's refusals of a bet and the no-answer notice. "ውርርዱ አልተያዘም" ("the bet was not placed")
negates `betSlip.placed` (ውርርድ ተይዟል); the rest reuses the slip's alerts and the auth errors.

| Key                                  | Amharic                                                   | Composed from                                                                                  |
| ------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `betSlip.betCount`                   | {n} ውርርዶች                                                 | `betSlip.bets`                                                                                 |
| `betSlip.refused.oddsChanged`        | ውርርዱ አልተያዘም፦ ኦድ ተቀይሯል። ለማስያዝ አዲሱን ኦድ ይቀበሉ።                | `alerts.oddsChangedTitle`, `placeFailedBody` (ማስያዝ); no count, as `translate()` has no plurals |
| `betSlip.refused.oddsUnknown`        | ውርርዱ አልተያዘም፦ ኦድ ተቀይሯል። ኦዶቹን አይተው እንደገና ያስይዙ።              | `alerts.oddsChangedTitle`, `betSlip.placeBet` (አስይዝ)                                           |
| `betSlip.refused.startedTitle`       | ጨዋታው ተጀምሯል                                                | `booking.reason.EVENT_STARTED`                                                                 |
| `betSlip.refused.started`            | ውርርዱ አልተያዘም፦ በትኬትዎ ያለ ጨዋታ ተጀምሯል። የቀሩትን ለማስያዝ ያስወግዱት።      | as above + `alerts.suspendedBody` (ያስወግዱት)                                                     |
| `betSlip.refused.suspended`          | ውርርዱ አልተያዘም፦ በአንድ ምርጫ ላይ ውርርድ ቆሟል። የቀሩትን ለማስያዝ ያስወግዱት።    | `alerts.suspendedBody`                                                                         |
| `betSlip.refused.closedUnknown`      | ውርርዱ አልተያዘም፦ አንድ ምርጫ ከእንግዲህ አይገኝም።                        | new                                                                                            |
| `betSlip.refused.limitTitle`         | ከገደቡ በላይ                                                  | `ገደብ` (`system.limitTitle`)                                                                    |
| `betSlip.refused.limit`              | ይህ የውርርድ መጠን ለዚህ ውርርድ ከተፈቀደው በላይ ነው። ያነሰ መጠን ይሞክሩ።        | `betSlip.stake` (የውርርድ መጠን)                                                                    |
| `betSlip.refused.limitWith`          | ይህ ውርርድ የሚቀበለው ከፍተኛ መጠን {amount} ነው።                      | `errors.stakeTooHighBody`                                                                      |
| `betSlip.refused.insufficient`       | ቀሪ ሂሳብዎ ለዚህ የውርርድ መጠን በቂ አይደለም።                           | `alerts.insufficientBody`                                                                      |
| `betSlip.refused.kycTitle`           | ማንነትዎን ያረጋግጡ                                              | `auth.kycTitle`                                                                                |
| `betSlip.refused.kyc`                | ውርርድ ለማስያዝ መታወቂያዎን በፋይዳ ያረጋግጡ።                            | `auth.verifyWithFayda`                                                                         |
| `betSlip.refused.rgLimitTitle`       | ገደብ ደርሷል                                                  | `system.limitTitle`                                                                            |
| `betSlip.refused.rgLimit`            | ያስቀመጡት ገደብ ላይ ደርሰዋል፤ ይህ ውርርድ መያዝ አይችልም።                   | as above                                                                                       |
| `betSlip.refused.breakTitle`         | ዕረፍት ላይ ነዎት                                               | `rg.takeBreak` (ዕረፍት)                                                                          |
| `betSlip.refused.break`              | በዕረፍትዎ ጊዜ ውርርድ ቆሟል።                                       | `system.coolOffBody` (ቆመዋል)                                                                    |
| `betSlip.refused.breakUntil`         | ውርርድ እስከ {date} ቆሟል።                                      | as above                                                                                       |
| `betSlip.refused.realMoney`          | በእውነተኛ ገንዘብ መወራረድ ገና አልተጀመረም።                             | new                                                                                            |
| `betSlip.refused.rateLimited`        | በአጭር ጊዜ ውስጥ በጣም ብዙ ውርርዶች። ትንሽ ቆይተው እንደገና ይሞክሩ።            | `auth.errors.RATE_LIMITED`                                                                     |
| `betSlip.refused.rateLimitedSeconds` | በአጭር ጊዜ ውስጥ በጣም ብዙ ውርርዶች። ከ{seconds} ሰከንድ በኋላ እንደገና ይሞክሩ። | `auth.errors.rateLimitedSeconds`                                                               |
| `betSlip.unconfirmed.title`          | ውርርድዎን ማረጋገጥ አልቻልንም                                       | new                                                                                            |
| `betSlip.unconfirmed.body`           | ውርርዱ ተይዞ ሊሆን ይችላል። እንደገና ይሞክሩ፤ ተይዞ ከሆነ ያንኑ ትኬት ያያሉ።       | `betSlip.placed` (ተይዟል), `betSlip.ticket`                                                      |

Added in the F5a review round (2026-10-03):

| Key                            | Amharic                                       | Composed from                                      |
| ------------------------------ | --------------------------------------------- | -------------------------------------------------- |
| `betSlip.placing`              | በማስያዝ ላይ…                                     | `betSlip.placeBet` (አስይዝ), progressive             |
| `betSlip.refused.stakeLow`     | ይህ የውርርድ መጠን ለዚህ ውርርድ ከተፈቀደው ዝቅተኛ መጠን በታች ነው። | `errors.stakeTooLowTitle` (ዝቅተኛ), `refused.limit`  |
| `betSlip.refused.stakeHigh`    | ይህ የውርርድ መጠን ለዚህ ውርርድ ከተፈቀደው ከፍተኛ መጠን በላይ ነው። | `errors.stakeTooHighTitle` (ከፍተኛ), `refused.limit` |
| `betSlip.unconfirmed.placeNew` | እንደ አዲስ ውርርድ አስይዝ                             | `betSlip.placeBet` (ውርርድ አስይዝ) + "as a new"        |

Added in the F5a review, round 2 (2026-10-03). `unconfirmed.changed` was reworded here (it now names the bet):

| Key                                | Amharic                                                                             | Composed from                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `betSlip.singlesLabel`             | ነጠላ · {n} ውርርዶች                                                                     | `betSlip.single` (ነጠላ), `betSlip.betCount`                            |
| `betSlip.alerts.oddsChangedBody`   | ለመቀጠል አዲሱን ኦድ ይቀበሉ።                                                                 | `refused.oddsChanged` (አዲሱን ኦድ ይቀበሉ); no count, so no plural          |
| `betSlip.unconfirmed.changed`      | እንደገና መሞከር ያንን ውርርድ እንደነበረ ይልካል፦ {bet}። ያ ውርርድ ተይዞ ከሆነ፣ ይህንንም ማስያዝ ሁለት ውርርዶች ያደርጋል። | `common.retry` (እንደገና), `unconfirmed.body` (ተይዞ ከሆነ), `betSlip.bets`  |
| `betSlip.unconfirmed.asItWas`      | እንደገና መሞከር ያንን ውርርድ እንደነበረ ይልካል፦ {bet}።                                             | as above; `{bet}` is `multipleLabel`, `systemLabel` or `singlesLabel` |
| `betSlip.unconfirmed.retry`        | እንደገና ይሞክሩ · {amount}                                                               | `common.retry`                                                        |
| `betSlip.unconfirmed.retryRefused` | እንደገና መሞከሩ አልተሳካም                                                                   | `common.retry`, `placeFailedBody` (አልተሳካም)                            |
| `betSlip.unconfirmed.oddsChanged`  | ከዚያ በኋላ የዚያ ውርርድ ኦድ ተቀይሯል።                                                          | `alerts.oddsChangedTitle` (ኦድ ተቀይሯል)                                  |
| `betSlip.unconfirmed.closed`       | በዚያ ውርርድ ውስጥ ያለ አንድ ምርጫ ከእንግዲህ አይገኝም።                                               | `refused.closedUnknown`                                               |

## My bets and the ticket check (F5b, 2026-10-03)

Composed, not from the design, for review. Statuses and results reuse the design's words where it had
them (`ክፍት`, `አሸንፏል`, `ተሸንፏል`, `ቀድሞ ተከፍሏል`, and `ተሰርዟል` from the void leg). **Void and cancelled
need distinct words**: void (every leg called off, the stake returned) keeps the design's `ተሰርዟል`;
cancelled took `ተቋርጧል` ("discontinued") — please check both read right on a ticket.

| Key                           | Amharic                                                        | Composed from                                         |
| ----------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `bets.status.void`            | ተሰርዟል                                                          | `bets.voidLeg` (design)                               |
| `bets.status.cancelled`       | ተቋርጧል                                                          | new — see above                                       |
| `bets.status.paid`            | ተከፍሏል                                                          | `bets.statusCashed` (ቀድሞ ተከፍሏል) without "early"       |
| `bets.status.expired`         | ጊዜው አልፏል                                                       | `booking.expiredTitle` (ይህ ኮድ ጊዜው አልፏል)               |
| `bets.result.half_win`        | ግማሽ አሸንፏል                                                      | ግማሽ ("half") + `bets.statusWon`                       |
| `bets.result.half_lose`       | ግማሽ ተሸንፏል                                                      | ግማሽ + `bets.statusLost`                               |
| `bets.voidLeg`                | ተሰርዟል · ኦድ 1.00 ሆኖ ይቆጠራል                                       | design's copy without the reason ("match postponed")  |
| `bets.payout`                 | ክፍያ                                                            | `bets.lostPayout` (design), renamed                   |
| `bets.stakeBonus`             | ከቦነስ ቀሪ ሂሳብ                                                    | `betSlip.accaBonus` (ቦነስ), `betSlip.balance` (ቀሪ ሂሳብ) |
| `bets.placedAt`               | የተያዘበት {date}                                                  | `bets.placed` (design) + the date                     |
| `bets.settledAt`              | የተጠናቀቀበት {date}                                                | `bets.tabSettled` (የተጠናቀቁ)                            |
| `bets.showMore`               | ተጨማሪ አሳይ                                                       | new                                                   |
| `bets.loadFailedTitle`        | ውርርዶችዎን መጫን አልተሳካም                                             | `board.error.title`                                   |
| `bets.loadFailedBody`         | ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።                                   | `board.error.body`                                    |
| `bets.moreFailed`             | ተጨማሪ ውርርዶችን መጫን አልተሳካም።                                        | as above                                              |
| `bets.emptyOpenTitle`         | ክፍት ውርርድ የለም                                                   | `bets.tabOpen` + `bets.emptyTitle` (…ውርርድ የለም)        |
| `bets.emptySettledTitle`      | እስካሁን የተጠናቀቀ ውርርድ የለም                                          | `bets.emptyTitle` (እስካሁን ውርርድ የለም)                    |
| `bets.emptySettledBody`       | የውርርዶቹ ጨዋታዎች በሙሉ ሲጠናቀቁ እዚህ ይታያሉ።                               | `bets.emptyBody` (እዚህ ይታያሉ)                           |
| `bets.guestTitle`             | ውርርዶችዎን ለማየት ይግቡ                                               | `header.login` (ግባ), polite                           |
| `bets.guestBody`              | ክፍትና የተጠናቀቁ ውርርዶችዎ እዚህ ይታያሉ።                                   | the tabs + `bets.emptyBody`                           |
| `bets.ticketFailedTitle`      | ይህን ትኬት መጫን አልተሳካም                                             | `booking.failedTitle`                                 |
| `bets.ticketFailedBody`       | አሁን መጫን አልተቻለም። እንደገና ይሞክሩ።                                    | `booking.failedBody`                                  |
| `bets.backToBets`             | ወደ ውርርዶቼ ተመለስ                                                  | `bets.title` + `common.backToSportsbook` (ተመለስ)       |
| `ticket.checkTitle`           | ትኬት ያረጋግጡ                                                      | `betSlip.ticket` + ያረጋግጡ (`booking.notFoundBody`)     |
| `ticket.checkBody`            | ሁኔታውን ለማየት በትኬቱ ላይ ያለውን ቁጥር ያስገቡ።                              | new                                                   |
| `ticket.numberLabel`          | የትኬት ቁጥር                                                       | `bets.ticketId` (design)                              |
| `ticket.numberPlaceholder`    | ለምሳሌ K7Q2-M9XP-M                                               | `booking.invalidCode` (ለምሳሌ)                          |
| `ticket.check`                | አረጋግጥ                                                          | imperative, as the slip's buttons                     |
| `ticket.invalid`              | የትኬት ቁጥር 9 ፊደላትና ቁጥሮች ነው፤ ለምሳሌ K7Q2‑M9XP‑M። ያረጋግጡና እንደገና ይሞክሩ። | `booking.invalidCode`, `booking.notFoundBodyNoCode`   |
| `ticket.pageTitle`            | ትኬት {ticket}                                                   | `betSlip.ticket`                                      |
| `ticket.notFoundTitle`        | በዚህ ቁጥር የተመዘገበ ትኬት የለም                                         | `booking.notFoundTitle`, ኮድ → ቁጥር                     |
| `ticket.notFoundBody`         | ቁጥር {ticket}ን ያረጋግጡና እንደገና ይሞክሩ።                               | `booking.notFoundBody`                                |
| `ticket.notFoundBodyNoNumber` | ቁጥሩን ያረጋግጡና እንደገና ይሞክሩ።                                        | `booking.notFoundBodyNoCode`                          |
| `ticket.failedTitle`          | ይህን ትኬት ማረጋገጥ አልተሳካም                                           | `booking.failedTitle`, መጫን → ማረጋገጥ                    |
| `ticket.failedBody`           | አሁን ማረጋገጥ አልተቻለም። እንደገና ይሞክሩ።                                  | `booking.failedBody`, as above                        |
| `ticket.checkAnother`         | ሌላ ትኬት ያረጋግጡ                                                   | `ticket.checkTitle`                                   |
| `ticket.shareText`            | ትኬት {ticket}                                                   | `booking.shareText`'s shape                           |
| `ticket.og.notFound`          | በዚህ ቁጥር የተመዘገበ ትኬት የለም።                                        | `ticket.notFoundTitle`                                |

The example number in `ticket.invalid` uses non-breaking hyphens (U+2011) in both languages, so it never
breaks across lines. `ticket.og.description` is `{status} · {matches}` in both languages (symbolic in `i18n.test.ts`): the
status is filled from `bets.status.*`, the matches are the API's names.

## Wallet balances and history (F6a, 2026-10-03)

| Key                                   | Amharic                                  | Composed from                                                  |
| ------------------------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| `wallet.bonus`                        | ቦነስ                                      | `betSlip.accaBonus` (ቦነስ)                                      |
| `wallet.bonusNote`                    | ለውርርድ ብቻ — ወጪ ማድረግ አይቻልም                 | ውርርድ + ብቻ ("only"); `wallet.withdraw` (ወጪ አድርግ)                |
| `wallet.locked`                       | በሂደት ላይ ያሉ ወጪዎች                          | `wallet.statusPending` (በሂደት ላይ) + ወጪ                          |
| `wallet.debt`                         | ዕዳ                                       | new ("debt")                                                   |
| `wallet.debtNote`                     | ከሚቀጥሉት ገቢዎችና አሸናፊነቶች መጀመሪያ ይከፈላል         | ገቢ (`wallet.deposit`), አሸናፊነት (the design's winnings rows)     |
| `wallet.guestTitle`                   | ቦርሳዎን ለማየት ይግቡ                           | `bets.guestTitle`, ውርርዶች → ቦርሳ (`wallet.title`)                |
| `wallet.guestBody`                    | ቀሪ ሂሳብዎና ክፍያዎችዎ እዚህ ይታያሉ።                | `wallet.balance` + `bets.guestBody` (…እዚህ ይታያሉ)                |
| `wallet.loadFailedTitle`              | ቦርሳዎን መጫን አልተሳካም                         | `bets.loadFailedTitle`, ውርርዶች → ቦርሳ                            |
| `wallet.loadFailedBody`               | ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።             | `board.error.body`                                             |
| `wallet.recentEmpty`                  | እስካሁን ምንም የለም። ገቢዎችና ውርርዶች እዚህ ይታያሉ።     | `bets.emptyTitle` (እስካሁን…የለም) + `bets.emptyBody`               |
| `wallet.recentFailed`                 | የቅርብ ጊዜ እንቅስቃሴዎን መጫን አልተሳካም።             | `wallet.recent` + `bets.loadFailedTitle`                       |
| `history.filtersLabel`                | በዓይነት ለይ                                 | new ("sort by kind"), the filter row's name for screen readers |
| `history.filterWins`                  | አሸናፊነት                                   | the design's winnings rows (አሸናፊነት · …)                        |
| `history.type.bet`                    | ውርርድ                                     | the singular of `bets.filterBets` (ውርርዶች)                      |
| `history.type.withdrawal_released`    | የተመለሰ ወጪ                                 | ወጪ + የተመለሰ ("returned")                                        |
| `history.type.refund`                 | ተመላሽ                                     | `betSlip.totalReturn` (…ተመላሽ, "return")                        |
| `history.type.bonus_converted`        | ወደ ቀሪ ሂሳብ የተቀየረ ቦነስ                      | ቦነስ + `wallet.balance` (ቀሪ ሂሳብ) + የተቀየረ ("converted")          |
| `history.type.adjustment`             | ማስተካከያ                                   | new ("adjustment")                                             |
| `history.type.other`                  | ሌላ                                       | new ("other"): a kind the contract added after this build      |
| `history.balanceAfter`                | ቀሪ ሂሳብ {amount}                          | `wallet.balance`                                               |
| `history.today` / `history.yesterday` | ዛሬ · {date} / ትናንት · {date}              | the design's mock headings (ዛሬ · …, ትናንት · …)                  |
| `history.emptyTitle`                  | እስካሁን ግብይት የለም                           | `bets.emptyTitle`, ውርርድ → ግብይት (`bets.viewTransactions`)       |
| `history.emptyBody`                   | ገቢዎች፣ ውርርዶች፣ አሸናፊነቶችና ወጪዎች እዚህ ይታያሉ።     | the filters + `bets.emptyBody`                                 |
| `history.emptyFilteredTitle`          | እዚህ እስካሁን ምንም የለም                        | `bets.emptyTitle`                                              |
| `history.emptyFilteredBody`           | ሁሉንም ለማየት «ሁሉም»ን ይምረጡ።                   | `history.filterAll` (ሁሉም), `wallet.seeAll` (ሁሉንም)              |
| `history.loadFailedTitle`             | ግብይቶችዎን መጫን አልተሳካም                       | `bets.loadFailedTitle`, ውርርዶች → ግብይቶች                          |
| `history.moreFailed`                  | ተጨማሪ ግብይቶችን መጫን አልተሳካም።                  | `bets.moreFailed`, as above                                    |
| `history.guestTitle`                  | ግብይቶችዎን ለማየት ይግቡ                         | `bets.guestTitle`, as above                                    |
| `history.guestBody`                   | ገቢዎችዎ፣ ውርርዶችዎ፣ አሸናፊነቶችዎና ወጪዎችዎ እዚህ ይታያሉ። | `history.emptyBody`, possessive                                |

The other `history.*` strings reuse existing ones verbatim (`bets.filter*` moved here, `bets.showMore`,
`board.error.body`; the deposit, withdrawal, winnings and bonus kinds are the filters' and `wallet.bonus`'s words). `history.withLabel` (`{kind} · {label}`) and
`history.day` (`{weekday} {date}`) are symbolic in `i18n.test.ts`: the kind, weekday and date are filled in
Amharic, the label is the API's (`telebirr`, a ticket number).

## Deposits (F6b, 2026-10-03)

| Key                                          | Amharic                                                                            | Composed from                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `deposit.flowPhone`                          | በስልክዎ ያጽድቁ                                                                         | `wallet.pendingBody` (…ያጽድቁ), ስልክ (`auth.phone`)                                      |
| `deposit.flowWeb`                            | በድረ-ገጻቸው ይክፈሉ                                                                      | new: ድረ-ገጽ ("website"); ክፈል (`wallet.confirmDeposit`)                                 |
| `deposit.unavailable`                        | አሁን አይገኝም                                                                          | `auth.errors.KYC_PROVIDER_UNAVAILABLE` (…አሁን አይገኝም)                                   |
| `deposit.methodsFailed`                      | የክፍያ ዘዴዎችን መጫን አልተሳካም።                                                             | ክፍያ + ዘዴ (`wallet.method`) + `bets.loadFailedTitle` (…መጫን አልተሳካም)                     |
| `deposit.methodsEmpty`                       | አሁን የሚገኝ የክፍያ ዘዴ የለም። ቆይተው እንደገና ይሞክሩ።                                             | as above + `betSlip.errors.cannotPriceBody` (ቆይተው … ይሞክሩ)                             |
| `deposit.promptWeb`                          | ለመክፈል ወደ {method} ገጽ ይቀጥላሉ።                                                        | ክፈል, ገጽ, ቀጥል (`wallet.continue`)                                                      |
| `deposit.unconfirmedTitle` / `Body`          | ገቢዎን ማረጋገጥ አልቻልንም / ገቢው ተጀምሮ ሊሆን ይችላል። …                                           | `betSlip.unconfirmed.title` / `.body`, ውርርድ → ገቢ, ተይዞ → ተጀምሮ ("started")              |
| `deposit.retry`                              | እንደገና ይሞክሩ · {amount}                                                              | `betSlip.unconfirmed.retry`                                                           |
| `deposit.refused.methodTitle` / `method`     | ዘዴው አይገኝም / {method} አሁን አይገኝም። ሌላ ዘዴ ይምረጡ።                                        | `wallet.method`, `deposit.unavailable`, `wallet.otherMethod` (ሌላ ዘዴ)                  |
| `deposit.refused.amountTitle` / `amount`     | መጠኑ አይፈቀድም / {method} በአንድ ገቢ ከ{min} እስከ {max} ይቀበላል።                              | `wallet.amount` (መጠን), new: አይፈቀድም ("not allowed"), ይቀበላል ("takes")                   |
| `deposit.refused.providerTitle` / `provider` | የክፍያ አቅራቢው ምላሽ አልሰጠም / {method} ምላሽ ስላልሰጠ ገቢዎ አልተጀመረም። …                           | new: አቅራቢ ("provider"), ምላሽ ("answer")                                                |
| `deposit.refused.limitTitle` / `limit`       | ገደብ ደርሷል / ያስቀመጡት ገደብ ላይ ደርሰዋል፤ ይህ ገቢ ሊፈጸም አይችልም።                                  | `betSlip.refused.rgLimitTitle` / `.rgLimit`, ውርርድ → ገቢ                                |
| `deposit.refused.break*`                     | ዕረፍት ላይ ነዎት / በዕረፍትዎ ጊዜ ገቢ ማድረግ ቆሟል። / ገቢ ማድረግ እስከ {date} ቆሟል።                     | `betSlip.refused.break*`, ውርርድ → ገቢ ማድረግ                                              |
| `deposit.refused.kyc*`                       | ማንነትዎን ያረጋግጡ / ገቢ ለማድረግ መታወቂያዎን በፋይዳ ያረጋግጡ።                                        | `betSlip.refused.kyc*`, ውርርድ ለማስያዝ → ገቢ ለማድረግ                                         |
| `deposit.refused.realMoney*`                 | ገና አልተጀመረም / ገቢ ማድረግ ገና አልተጀመረም።                                                   | `betSlip.refused.realMoney` (…ገና አልተጀመረም)                                             |
| `deposit.refused.otherTitle`                 | ገቢዎ አልተጀመረም                                                                        | as above                                                                              |
| `deposit.depositAmount` / `changeAmount`     | {amount} ገቢ አድርግ / መጠኑን ቀይር                                                        | `wallet.deposit` (ገቢ አድርግ); `wallet.amount` + ቀይር ("change")                          |
| `deposit.statusStarting` / `statusExpired`   | በመጀመር ላይ / ጊዜው አልፏል                                                                | `wallet.statusPending` (…ላይ); `bets.status.expired`                                   |
| `deposit.startingTitle`                      | ክፍያዎ እየተጀመረ ነው                                                                     | ክፍያ + `header.accountLoading` (እየ…ነው)                                                 |
| `deposit.updates`                            | ይህ ገጽ በራሱ ይታደሳል።                                                                   | `wallet.pendingBody` (its second sentence)                                            |
| `deposit.phoneTitle`                         | ስልክዎን ይመልከቱ                                                                        | ስልክ + ይመልከቱ ("look at")                                                               |
| `deposit.webTitle` / `webBody`               | ክፍያውን በ{method} ይጨርሱ / ክፍያውን በ{method} ገጽ ላይ ያጠናቅቁ።                                | ክፍያ, ገጽ; new: ይጨርሱ, ያጠናቅቁ ("finish", "complete")                                      |
| `deposit.continueTo`                         | ወደ {method} ቀጥል                                                                    | `wallet.backToSports` (ወደ …), `wallet.continue`                                       |
| `deposit.unsupportedTitle` / `Body`          | ይህ ክፍያ እዚህ ሊቀጥል አይችልም / {method} የራሱን መተግበሪያ ወይም ይህ ድረ-ገጽ የማይከፍተውን ገጽ ይፈልጋል። …     | new: መተግበሪያ ("app"), ድረ-ገጽ                                                            |
| `deposit.completedTitle` / `Body`            | ገንዘቡ ገብቷል / ከ{method} ያስገቡት {amount} ደርሷል።                                         | `wallet.successTitle`; `rg.deposited` (ያስገቡት), ደርሷል ("arrived")                       |
| `deposit.failedTitle` / `Body`               | ክፍያው አልተሳካም / ወደ ቀሪ ሂሳብዎ ምንም አልገባም።                                                | `wallet.failedTitle`; `wallet.balance` (ቀሪ ሂሳብ), `wallet.successTitle` (ገብቷል → አልገባም) |
| `deposit.expiredTitle` / `Body`              | የክፍያው ጊዜ አልፏል / በጊዜው ስላልጸደቀ ወደ ቀሪ ሂሳብዎ ምንም አልገባም። አሁን ካጸደቁት {method} ሲያረጋግጥ ይደርሳል። | as above + ጸደቀ (`wallet.pendingBody`'s ያጽድቁ), ያረጋግጥ (`wallet.confirmTitle`)           |
| `deposit.checkFailedTitle` / `Body`          | ይህን ገቢ ማረጋገጥ አልተቻለም / ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።                                 | `bets.ticketFailedTitle` pattern; `board.error.body`                                  |
| `deposit.notFoundTitle` / `Body`             | ይህን ገቢ ማግኘት አልቻልንም / በመለያዎ ላይ የለም።                                                 | `auth.needsInfoTitle` (…አልቻልንም); `bets.notFoundBody` (…በመለያዎ ላይ የለም)                  |
| `deposit.backToWallet`                       | ወደ ቦርሳ ተመለስ                                                                        | `wallet.backToSports`, ስፖርት → ቦርሳ (`wallet.title`)                                    |
| `wallet.aboveMaximum`                        | የ{method} ከፍተኛ መጠን {amount} ነው።                                                    | `wallet.belowMinimum`, ዝቅተኛ → ከፍተኛ (`betSlip.maxWin`)                                 |

The status words Pending, Success and Failed, the fix labels Choose another method, Try again, View
limits and Verify, and Done and Back to sports reuse `wallet.*` and `system.viewLimits` verbatim. A
method's name, the push's `message` and a failure's reason are the API's text, shown as sent.
`wallet.mobileMoney` and `wallet.gateway` are gone: the contract says how a method is paid, not what
kind it is.

### Deposits, review round 1 (2026-10-03)

| Key                          | Amharic                                        | Composed from                                                               |
| ---------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `deposit.refused.retryTitle` | እንደገና መሞከሩ አልተሳካም                              | `betSlip.unconfirmed.retryRefused`, verbatim                                |
| `deposit.refused.provider`   | {method} ምላሽ አልሰጠም። እንደገና ይሞክሩ ወይም ሌላ ዘዴ ይምረጡ። | the earlier line without its claim (…ስላልሰጠ ገቢዎ አልተጀመረም → ምላሽ አልሰጠም)         |
| `deposit.refused.limit`      | የገቢ ገደብ ላይ ደርሰዋል፤ ይህ ገቢ ሊፈጸም አይችልም።            | `rg.depositLimit` (የገቢ ገደብ) in place of ያስቀመጡት ገደብ ("a limit you set")      |
| `deposit.youDeposit`         | የሚያስገቡት                                        | `rg.deposited` (ያስገቡት), relative form                                       |
| `deposit.provider`           | የክፍያ አቅራቢዎ                                     | `deposit.refused.providerTitle` (የክፍያ አቅራቢ) + possessive                    |
| `deposit.retry` (changed)    | እንደገና ሞክር · {amount}                           | `wallet.tryAgain` (ሞክር): one Try again in the flow's buttons (UI review U8) |

The flow's other Try again buttons (methods failed or empty, a deposit that couldn't be checked) now use
`wallet.tryAgain` too. Failed and expired deposits end with `deposit.backToWallet` (ወደ ቦርሳ ተመለስ), not
`wallet.done` (ተጠናቀቀ, which under a failure reads as "completed"). Removed: `wallet.youPay` (a deposit
shows what it puts in, not what is paid), `wallet.successTitle` and `wallet.successBody` (the withdrawal
mock's deposit branch).

## Withdrawals (F6c, 2026-10-03)

Composed from the wallet's own words: ወጪ ("withdrawal", `wallet.withdraw`, `history.type.withdrawal`),
ሂሳብ ("account", `wallet.account`), ቀሪ ሂሳብ ("balance", `wallet.balance`), ሰርዝ ("cancel",
`wallet.cancel`). The refusal and no-answer lines follow F6b's deposit lines with ገቢ → ወጪ.

| Key                                                                       | Amharic                                                                            | Composed from                                                                               |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `withdraw.accountTitle`                                                   | ወደ የትኛው የ{method} ሂሳብ ይላክ?                                                         | `wallet.chooseWithdraw` (…እንላክ), `wallet.account` (ሂሳብ)                                     |
| `withdraw.verified`                                                       | ተረጋግጧል                                                                             | `auth.verified`, verbatim                                                                   |
| `withdraw.remove` / `removeLabel` / `removeQuestion` / `keep`             | አስወግድ / ሂሳቡን አስወግድ፦ {account} / {account} ይወገድ? / ይቆይ                              | new: አስወግድ ("remove"), ይቆይ ("let it stay")                                                  |
| `withdraw.removeFailed` / `accountsFailed`                                | ይህን ሂሳብ ማስወገድ አልተቻለም። / የተቀመጡ ሂሳቦችዎን መጫን አልተሳካም።                                   | `deposit.checkFailedTitle` (…አልተቻለም), `deposit.methodsFailed` (…መጫን አልተሳካም)                 |
| `withdraw.anotherNumber` / `numberLabel`                                  | ሌላ ቁጥር / የ{method} ቁጥር                                                             | `wallet.otherMethod` (ሌላ), ቁጥር ("number", `auth.phoneInvalid`)                              |
| `withdraw.numberHint` / `save` / `saveFailed`                             | ለሚቀጥሉት ወጪዎችዎ እናስቀምጠዋለን። / ቁጥሩን አስቀምጥ / ይህን ቁጥር ማስቀመጥ አልተቻለም።                       | `wallet.debtNote` (ከሚቀጥሉት…), new: አስቀምጥ ("save")                                            |
| `withdraw.yourAccount` / `youWithdraw`                                    | ሂሳብዎ / የሚያወጡት                                                                      | `wallet.account` + possessive; `deposit.youDeposit` (የሚያስገቡት → የሚያወጡት)                      |
| `withdraw.prompt`                                                         | ጥያቄዎን አረጋግጠን ወደ {account} እንልካለን። በመረጋገጥ ላይ እያለ መሰረዝ ይችላሉ።                         | `wallet.confirmTitle` (ያረጋግጡ), `wallet.chooseWithdraw` (እንላክ), `wallet.cancel` (ሰርዝ)        |
| `withdraw.unconfirmedTitle` / `Body`, `retry`                             | ወጪዎን ማረጋገጥ አልቻልንም / ወጪው ተልኮ ሊሆን ይችላል። … / እንደገና ሞክር · {amount}                     | `deposit.unconfirmed*`, ገቢ → ወጪ, ተጀምሮ → ተልኮ ("sent"); `deposit.retry`                       |
| `withdraw.refused.bonusTitle` / `bonus`                                   | ቦነሱ ገና በውርርድ ላይ ነው / ውርርዱ ያልተጠናቀቀ ቦነስ ስላለዎት ይህ ወጪ ሊፈጸም አይችልም።                      | `wallet.bonus` (ቦነስ), `deposit.refused.limit` (…ሊፈጸም አይችልም)                                 |
| `withdraw.refused.amount`                                                 | {method} በአንድ ወጪ ከ{min} እስከ {max} ይከፍላል።                                           | `deposit.refused.amount`, ገቢ → ወጪ, ይቀበላል → ይከፍላል ("pays")                                   |
| `withdraw.refused.fundsTitle` / `funds`                                   | ቀሪ ሂሳብዎ በቂ አይደለም / ቀሪ ሂሳብዎ ከዚህ መጠን ያነሰ ነው።                                         | `wallet.balance`, `wallet.amount` (መጠን), new: ያነሰ ("less")                                  |
| `withdraw.refused.break`                                                  | በዕረፍትዎ ጊዜ ይህ ወጪ ሊፈጸም አይችልም። ድጋፍ ሰጪዎቻችንን ያግኙ፤ ገንዘብዎን እንዲያገኙ እንረዳዎታለን።               | `deposit.refused.break` (በዕረፍትዎ ጊዜ…), new: ድጋፍ ሰጪ ("support")                               |
| `withdraw.refused.kyc`, `realMoney`, `method`, `retryTitle`, `otherTitle` | … ወጪ ለማድረግ … / ወጪ ማድረግ ገና አልተጀመረም። / … / … / ወጪዎ አልተፈጸመም                           | the `deposit.refused.*` lines, ገቢ → ወጪ                                                      |
| `withdraw.withdrawAmount` / `chooseAccount` / `keepWagering` / `help`     | {amount} ወጪ አድርግ / ሌላ ሂሳብ ምረጥ / ውርርዱን ቀጥል / እገዛ                                    | `deposit.depositAmount`, `wallet.otherMethod` (ሌላ … ምረጥ), `wallet.continue` (ቀጥል)           |
| `withdraw.status.*`                                                       | ተጠይቋል / በግምገማ ላይ / ጸድቋል / በሂደት ላይ / ተከፍሏል / አልተሳካም / ውድቅ ሆኗል / ተሰርዟል               | `wallet.statusPending` (…ላይ), `wallet.statusFailed`; new: ግምገማ ("review"), ውድቅ ("rejected") |
| `withdraw.requested*`, `review*`, `approved*`, `processing*`, `paid*`     | ወጪ ተጠይቋል / በግምገማ ላይ ነው / ወጪው ጸድቋል / ገንዘብዎ እየተላከ ነው / ወጪው ተከፍሏል, and their bodies   | the status words above; እንልካለን / እየተላከ ("sending", `wallet.chooseWithdraw`)                 |
| `withdraw.reviewReason.FIRST_WITHDRAWAL`                                  | የእያንዳንዱን ተጫዋች የመጀመሪያ ወጪ እንገመግማለን።                                                  | new: ተጫዋች ("player"), የመጀመሪያ ("first")                                                      |
| `withdraw.failed*`, `rejected*`, `cancelled*`                             | ወጪው አልተሳካም / ወጪው ውድቅ ሆኗል / ወጪው ተሰርዟል; "{amount} ወደ ቀሪ ሂሳብዎ ተመልሷል።"                 | `history.type.withdrawal_released` (የተመለሰ → ተመልሷል, "returned")                              |
| `withdraw.cancel`, `tooLate*`, `cancelUnconfirmed*`, `cancelFailedTitle`  | ወጪውን ሰርዝ / ለመሰረዝ ዘግይቷል / መሰረዙን ማረጋገጥ አልቻልንም / ይህን ወጪ መሰረዝ አልተቻለም, and their bodies | `wallet.cancel` (ሰርዝ), `deposit.unconfirmedTitle` pattern; new: ዘግይቷል ("too late")          |
| `withdraw.checkFailed*`, `notFound*`                                      | ይህን ወጪ ማረጋገጥ አልተቻለም / ይህን ወጪ ማግኘት አልቻልንም, and their bodies                         | `deposit.checkFailed*`, `deposit.notFound*`, ገቢ → ወጪ                                        |
| `wallet.withdrawalTitle`                                                  | ወጪ                                                                                 | `history.type.withdrawal`, verbatim                                                         |

The fix labels Choose another method, Try again, Change amount and Verify, and Back to wallet, Done and
Back to sports reuse `wallet.*`, `deposit.changeAmount` and `deposit.backToWallet` verbatim. A method's
name, the account's masked number and a rejection's reason are the API's text, shown as sent. Removed
with the mock (the provenance notes above that name them still say where an older string came from):
`wallet.fee`, `youReceive`, `promptWithdraw`, `pendingTitle`, `pendingBody`, `cancelPayment`,
`successTitleWithdraw`, `successBodyWithdraw`, `failedTitle`, `failedBody`, `startFailed`, `fromAccount`.

### Withdrawals, review round 1 (2026-10-03)

The requested, processing and paid bodies name the withdrawal instead of its amount (the user's
decision on the money reviewer's M1): `withdraw.requestedBody` ወጪዎን ወደ {account} ከመላካችን በፊት ጥያቄዎን
እያረጋገጥን ነው። …, `withdraw.processingBody` ወጪዎ ወደ {account} እየተላከ ነው።, `withdraw.paidBody` ወጪዎ ወደ
{account} ተከፍሏል። — ወጪዎ ("your withdrawal") from `withdraw.unconfirmedTitle` (ወጪዎን). The break refusal's
fix is `withdraw.help` (Help / እገዛ, as `footer.help`), not Contact support, as approved at the plan gate.

## Responsible gambling (F7a, 2026-10-05)

The English is the copy approved at the plan gate (`docs/tasks/F7a/plan.md`, question 1). The Amharic below
was composed from vocabulary already in `am.json`; `rg.usedDay` is the design's own `wallet.usedToday`
(ዛሬ ከ{limit} ውስጥ {used} ተጠቅመዋል, removed in F6a) and `wallet.manage` (አስተዳድር) is restored verbatim.
`{value}` is a formatted money amount (`1,000.00 ብር`) or a duration (`120 ደቂቃ`, `rg.minutes`); `{date}`
is the long date with its year (`common.dateAtTime`).

| Key                                                                                                  | Amharic                                                                                                      | Composed from                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `common.dateAtTime`                                                                                  | {date}፣ {time}                                                                                               | `booking.validUntil` (…{date}፣ {time}…)                                                                                                                     |
| `rg.guestTitle`, `rg.guestBody`                                                                      | ገደቦችዎን ለማስቀመጥ ይግቡ / ገደቦችዎ፣ ዕረፍቶችዎና ራስን ማግለልዎ በመለያዎ ላይ ይቀመጣሉ፤ ስለዚህ በሁሉም መሣሪያ ላይ ይሠራሉ።                         | `auth.logInLink` (ይግቡ), `rg.intro` (…በሁሉም መሣሪያ ላይ ይሠራሉ), `rg.selfExclusion` (ራስን ማግለል), `rg.saved` (ተቀምጧል)                                                  |
| `rg.limitsFailedTitle`, `rg.limitsFailedBody`, `rg.saveFailedBody`                                   | ገደቦችዎን መጫን አልቻልንም / ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።                                                             | `withdraw.checkFailedTitle` pattern (… አልቻልንም), `board.error.body` verbatim                                                                                 |
| `rg.depositLimitBody`, `stakeLimitBody`, `lossLimitBody`, `timeLimitBody`                            | በቀን፣ በሳምንት ወይም በወር ማስገባት / መወራረድ / ሊያጡ / መጫወት የሚችሉት ከፍተኛ መጠን (ጊዜ)። ክፍት ውርርዶች ይቆጠራሉ። / የተጠናቀቁ ውርርዶች ብቻ ይቆጠራሉ። | `rg.daily`/`weekly`/`monthly` (ቀን, ሳምንት, ወር), `wallet.deposit` (ገቢ አድርግ), `rg.excludeConfirmBody` (ክፍት ውርርዶች … ይጠናቀቃሉ); new: ከፍተኛ ("most"), ይቆጠራሉ ("count") |
| `rg.stakeLimit`, `rg.timeLimit`                                                                      | የውርርድ ገደብ / የጊዜ ገደብ                                                                                          | `rg.depositLimit` (የገቢ ገደብ), ውርርድ, ጊዜ (`system.realityBody`)                                                                                                |
| `rg.noLimit`, `rg.limitValue`                                                                        | ገደብ አልተቀመጠም / ገደብ፦ {value}                                                                                   | `rg.saved` (ተቀምጧል) negated                                                                                                                                  |
| `rg.usedWeek`, `rg.usedMonth`                                                                        | በዚህ ሳምንት / በዚህ ወር ከ{limit} ውስጥ {used} ተጠቅመዋል                                                                 | `rg.usedDay` (the design's), `rg.thisMonth` (በዚህ ወር)                                                                                                        |
| `rg.pendingChange`, `rg.pendingRemoved`                                                              | {date} ላይ ወደ {value} ይቀየራል። / ከ{date} ጀምሮ ገደብ አይኖርም።                                                         | new: ይቀየራል ("changes"), ጀምሮ ("from")                                                                                                                        |
| `rg.newLimit`, `rg.minutesUnit`, `rg.saving`                                                         | አዲስ ገደብ / ደቂቃ / በማስቀመጥ ላይ…                                                                                   | `rg.minutes` (ደቂቃ), `withdraw.status.processing` pattern (… ላይ)                                                                                             |
| `rg.savedNow`, `rg.savedPending`                                                                     | ተቀምጧል። ገደብዎ አሁን {value} ነው። / ተቀምጧል። አዲሱ ገደብዎ {value} ከ{date} ጀምሮ ይሠራል።                                      | `rg.saved`, `rg.increaseNote` (… ይሠራል)                                                                                                                      |
| `rg.amountTooLow`, `minutesTooLow`, `amountTooHigh`, `minutesTooHigh`                                | ከ0 በላይ መጠን / ደቂቃ ያስገቡ። / ያነሰ መጠን / ደቂቃ ያስገቡ።                                                                 | `deposit` amount step's ያስገቡ; new: ያነሰ ("smaller")                                                                                                          |
| `rg.notSavedTitle`, `rg.saveFailedTitle`                                                             | ገደብዎ አልተቀመጠም / ገደብዎን ማስቀመጥ አልቻልንም                                                                            | `rg.saveLimit` (ገደቡን አስቀምጥ)                                                                                                                                 |
| `rg.exclude5y`                                                                                       | 5 ዓመት                                                                                                        | `rg.exclude1y`                                                                                                                                              |
| `rg.takeBreakBody`, `rg.selfExclusionBody` (changed)                                                 | …፤ ከሁሉም መሣሪያዎች ያስወጣዎታል። …                                                                                    | the authored lines, with the sign-out added; ያስወጣዎታል ("signs you out") new; "closes your account" dropped (RG-02)                                           |
| `rg.breakConfirmBody`, `rg.excludeConfirmBody` (changed), `rg.excludeConfirmBodyPermanent`           | ከሁሉም መሣሪያዎች ይወጣሉ፤ እስኪያበቃ (ዳግመኛ) መወራረድም ገቢ ማድረግም አይችሉም። … ክፍት ውርርዶች እንደተለመደው ይጠናቀቃሉ።                          | the authored lines; "your balance is returned to your registered account" dropped (no spec says so); new: ዳግመኛ ("again"), ሊቀለበስ አይችልም ("can't be undone")   |
| `rg.breakStartedTitle`, `rg.exclusionStartedTitle`                                                   | ዕረፍትዎ ጀምሯል / ራስዎን አግልለዋል                                                                                     | `rg.startBreak` (ዕረፍት ጀምር), `rg.selfExclude` (ራሴን አግልል)                                                                                                     |
| `rg.breakStartedBody`, `rg.exclusionStartedBody`, `rg.exclusionStartedPermanent`                     | ከሁሉም መሣሪያዎች ወጥተዋል። ውርርድና ገቢ እስከ {date} ቆመዋል። / … ዳግመኛ መወራረድም ገቢ ማድረግም አይችሉም።                                 | `system.coolOffBody` (ውርርድና ገቢ ቆመዋል)                                                                                                                        |
| `rg.startingBreak`, `rg.breakNotStartedTitle`, `rg.breakUnconfirmedTitle`, `rg.breakUnconfirmedBody` | በመጀመር ላይ… / ዕረፍትዎ አልጀመረም / ዕረፍትዎን ማረጋገጥ አልቻልንም / ጀምሮ ሊሆን ይችላል። ከጀመረ ከመለያዎ ይወጣሉ።                              | `deposit.unconfirmedTitle` pattern (… ማረጋገጥ አልቻልንም), `deposit.unconfirmedBody` (… ሊሆን ይችላል)                                                                 |
| `system.excludedTitle`, `system.excludedBody`                                                        | ራስን ማግለል ንቁ ነው። / ውርርድና ገቢ ቆመዋል።                                                                             | `rg.activeExclusion` (removed), `system.coolOffBody` verbatim                                                                                               |
| `betSlip.paused`                                                                                     | ውርርድ ቆሟል                                                                                                     | `betSlip.refused.breakUntil` (ውርርድ … ቆሟል)                                                                                                                   |
| `rg.refusedBody` (review round 1)                                                                    | ችግር ተፈጥሯል። ትንሽ ቆይተው እንደገና ይሞክሩ።                                                                              | `auth.errors.failed` (ችግር ተፈጥሯል። … እንደገና ይሞክሩ።); new: ትንሽ ቆይተው ("in a moment")                                                                              |
| `wallet.noDepositLimit`, `wallet.setLimit`, `wallet.depositLimitFailed`                              | የገቢ ገደብ አልተቀመጠም። / ገደብ ያስቀምጡ / የገቢ ገደብዎን መጫን አልቻልንም።                                                         | `rg.depositLimit`, `rg.noLimit`, `rg.limitsFailedTitle`                                                                                                     |

Removed with the mock (no source any more): `rg.thisMonth`, `deposited`, `netLoss`, `monthSummary`,
`used`, `saved`, `lossNote`, `activeBreak`, `activeExclusion`, and the deposit-limit dialog's
`system.limitTitle`, `limitBody`, `limitOk` (question 2). The provenance notes above that name them
still say where an older string came from.

## Account and reality check (F7b, 2026-10-05)

None of this copy is about money: the reality check shows time only until F7e. The Amharic was composed from
vocabulary already in `am.json`: መለያ (account, `auth.*`), መሣሪያ (device, `rg.takeBreakBody`), አስቀምጥ /
በማስቀመጥ ላይ… (save / saving, `withdraw.save`, `rg.saving`), ማስቀመጥ አልተቻለም (`withdraw.saveFailed`), and
the reality check's ለ{…} ተጫውተዋል። from the old `system.realityBody`. `{time}` is the long date and time
(`common.dateAtTime`); `{ip}` and `{device}` are the API's own text (`196.188.x.x`, `Chrome 129 on
Windows`), so the Amharic puts them after a colon rather than suffixing them.

| Key                                                                              | Amharic                                                                             | Composed from                                                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `profile.languageSaving`, `languageNotSaved`, `languageSave`                     | በመለያዎ ላይ በማስቀመጥ ላይ… / በመለያዎ ላይ አልተቀመጠም። / አስቀምጥ                                     | `bets.notFoundBody` (በመለያዎ ላይ), `rg.saving`, `withdraw.save`                                 |
| `profile.saveFailed`, `saveFailedBody`                                           | ይህን በመለያዎ ላይ ማስቀመጥ አልተቻለም። / ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።                           | `withdraw.saveFailed`; `wallet.loadFailedBody` verbatim                                      |
| `profile.devices`, `devicesBody`, `thisDevice`                                   | የገቡ መሣሪያዎች / የማያውቁትን ማንኛውንም መሣሪያ ያስወጡ። / ይህ መሣሪያ                                    | `rg.takeBreakBody` (መሣሪያ, ያስወጣዎታል)                                                           |
| `profile.platformAndroid`, `platformIos`, `platformWeb`                          | አንድሮይድ ስልክ / አይፎን / የድር አሳሽ                                                         | Transliterated names; ስልክ (`profile.phone`)                                                  |
| `profile.lastActive`, `lastActiveFrom`                                           | መጨረሻ የተጠቀሙበት፦ {time} / መጨረሻ የተጠቀሙበት፦ {time} · {ip}                                  | New; the colon form of `withdraw.removeLabel`                                                |
| `profile.signOutDevice`, `signOutDeviceAria`, `signingOut`                       | አስወጣ / ከመለያው አስወጣ፦ {device} / በማስወጣት ላይ…                                            | `rg.takeBreakBody` (ያስወጣዎታል); the colon form of `withdraw.removeLabel`                       |
| `profile.signOutFailed`, `devicesFailed`                                         | ይህን መሣሪያ ማስወጣት አልተቻለም። / መሣሪያዎችዎን መጫን አልተቻለም።                                       | `withdraw.removeFailed`, `rg.limitsFailedTitle`                                              |
| `system.realityPlayedMinutes`, `realityPlayedHours`, `realityPlayedHoursMinutes` | ለ{minutes} ደቂቃ ተጫውተዋል። / ለ{hours} ሰዓት ተጫውተዋል። / ለ{hours} ሰዓት ከ{minutes} ደቂቃ ተጫውተዋል። | The old `system.realityBody` (ለ{duration} ተጫውተዋል።); ደቂቃ (`rg.minutes`)                       |
| `rg.sessionReminderBody` (changed), `sessionReminderEvery`, `sessionReminderOff` | በመለያዎ ላይ በተቀመጠው ጊዜ ልዩነት የተጫወቱበትን ጊዜ ያሳያል። / በየ{n} ደቂቃው / ጠፍቷል                       | The old `rg.sessionReminderBody`, without ወጪ (money spent); `profile.notifOffersBody` (ጠፍቷል) |

Removed with the mock figures (no source until F7e): `system.realityBody`, `realityStaked`, `realityWon`,
`realityNet`. The provenance note above that names `system.realityBody` still says where an older string
came from.

## Shop terminal placeholder (F8a, 2026-10-06)

What a terminal host shows until F8b builds the terminal. Composed; needs review with the rest.

| Key                          | Amharic             | Composed from                                                       |
| ---------------------------- | ------------------- | ------------------------------------------------------------------- |
| `terminal.placeholder.title` | የሱቅ ተርሚናል           | New: ሱቅ (shop) + ተርሚናል, the transliterated word                     |
| `terminal.placeholder.body`  | ይህ ስክሪን ገና አልተዘጋጀም። | New; ገና … (not yet) as in `betSlip.alerts.realMoney` (… ገና አልተጀመረም) |

## Shop terminal (F8b, 2026-10-06)

The placeholder's two strings are gone; these replace them. All composed, all need review. The terminal
shows each in Amharic then English. ተርሚናል is the transliterated word the placeholder used; ማግበር
(activate) and የማግበሪያ ኮድ (activation code) are new. `{minutes}` is a whole number, and the Amharic
puts it after ከ… (from) and before ደቂቃ በኋላ (minutes later), as `auth.errors.AUTH_OTP_UNAVAILABLE` does
with ከጥቂት ደቂቃዎች በኋላ.

| Key                                                                         | Amharic                                                                                                                           | Composed from                                                                                                     |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `terminal.loading`                                                          | ተርሚናሉ በመጀመር ላይ ነው…                                                                                                                | New; … ላይ ነው as in the saving strings (`rg.saving`)                                                               |
| `terminal.activate.title`, `body`, `label`, `submit`, `busy`                | ይህን ተርሚናል ያግብሩ / ከባክ ኦፊስ ወይም ከወኪል ፖርታል የተሰጠውን ባለ 8 ፊደል የማግበሪያ ኮድ ያስገቡ። / የማግበሪያ ኮድ / አግብር / በማግበር ላይ…                             | New: ማግበር (activate); ኮድ (`betSlip.bookingCode`); ወኪል (agent, `betSlip.bookHint`); ባክ ኦፊስ and ፖርታል transliterated |
| `terminal.activate.lapsed`, `expired`                                       | የዚህ ተርሚናል ማግበሪያ ጊዜው አልፎበታል። አዲስ ኮድ ያስገቡ። / ይህ ኮድ ጊዜው አልፎበታል። አዲስ ኮድ ይጠይቁ።                                                         | ጊዜው አልፎበታል and አዲስ from `auth.errors.AUTH_OTP_EXPIRED`                                                            |
| `terminal.activate.format`, `wrongCode`                                     | ኮዱ 8 ፊደሎችና ቁጥሮች አሉት። / ይህ ኮድ ያለው ተርሚናል የለም። ኮዱን አረጋግጠው እንደገና ይሞክሩ።                                                                | New; እንደገና ይሞክሩ (`common.retry`); ያረጋግጡ (`board.error.body`)                                                      |
| `terminal.activate.tooMany`, `tooManyLater`                                 | ብዙ ሙከራዎች ተደርገዋል። ከ{minutes} ደቂቃ በኋላ እንደገና ይሞክሩ። / ብዙ ሙከራዎች ተደርገዋል። ቆየት ብለው እንደገና ይሞክሩ።                                            | New; ደቂቃ (`rg.minutes`); the ከ… በኋላ form of `auth.errors.AUTH_OTP_UNAVAILABLE`                                    |
| `terminal.activate.unreachable`, `terminal.offline.title`, `body`, `retry`  | ከአገልጋዩ ጋር መገናኘት አልተቻለም። እንደገና ይሞክሩ። / ከአገልጋዩ ጋር መገናኘት አልተቻለም / ተርሚናሉ በራሱ እንደገና ይሞክራል። / እንደገና ይሞክሩ                                | New: አገልጋይ (server); … አልተቻለም as `withdraw.saveFailed`; `common.retry`                                            |
| `terminal.activate.unsupported`                                             | ይህ አሳሽ የተርሚናሉን ቁልፍ መያዝ አይችልም። Chromeን በኪዮስክ ሁነታ ይጠቀሙ።                                                                             | አሳሽ (browser, `profile.platformWeb`); ቁልፍ (key) and ኪዮስክ ሁነታ (kiosk mode) new; Chrome kept in Latin               |
| `terminal.ready.title`, `body`                                              | ይህ ተርሚናል ዝግጁ ነው / ውርርድ በዚህ ስክሪን ላይ ይከፈታል።                                                                                         | New; ስክሪን from the placeholder                                                                                    |
| `terminal.closed.title`, `body`                                             | ይህ ሱቅ ዝግ ነው / በዚህ ተርሚናል ላይ ውርርድ የሚከፈተው ሱቁ ሲከፈት ነው።                                                                                | ሱቅ from the placeholder; ዝግ (closed) new                                                                          |
| `terminal.blocked.revokedTitle`, `revokedBody`, `deviceTitle`, `deviceBody` | ይህ ተርሚናል ተዘግቷል / ከሱቁ ተርሚናሎች ተወግዷል። የሱቁን ሠራተኞች ይጠይቁ። / ይህ ኮምፒውተር ተርሚናሉን ማስኬድ አይችልም / የሱቁ ቅንብሮች ይህን ኮምፒውተር አይፈቅዱም። የሱቁን ሠራተኞች ይጠይቁ። | ተዘግቷል as `booking.reason.MARKET_CLOSED`; ቅንብሮች (settings) as in መገለጫና ቅንብሮች; ሠራተኞች (staff), ኮምፒውተር new            |

## Shop kiosk (F8ca, 2026-10-06)

The kiosk is the player's sportsbook (its home, league and match pages, sidebar, search and slip), so it
shows the player's strings, already reviewed with them, in one language at a time with the player's
`EN | አማ` switch. Its own strings are those of the bilingual "unavailable" screen. All are composed, and all
need review. The kiosk's first version had strings of its own for its views; they went with the views when
the user chose the player's pages (2026-10-06): `terminal.kiosk.matches`, `days`, `emptyBody`,
`backToToday`, `backToMatches`, `sportsFailed`, and `LANG_NAME`. So did `terminal.ready.*`.

| Key                                        | Amharic                                    | Composed from                                                                             |
| ------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `terminal.kiosk.unavailable.title`, `body` | በዚህ ተርሚናል ላይ ውርርድ አይገኝም / የሱቁን ሠራተኞች ይጠይቁ። | በዚህ ተርሚናል ላይ ውርርድ from `terminal.closed.body`; the body as `terminal.blocked.revokedBody` |

## The kiosk's slip (F8cb, 2026-10-08)

The kiosk prices its slip with the player's slip strings (modes, stake, alerts, figures), already
reviewed. Its own is the line a tenant without a shop rule set shows, whose English the user chose at the
plan gate. It is composed and needs review. (The on-screen keypad's three names went with the keypad, on
the user's review.)

| Key                      | Amharic                                | Composed from                                                                                                                                                       |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terminal.kiosk.noRules` | ይህ ትኬት ምን ያህል እንደሚከፍል የሱቁን ሠራተኞች ይጠይቁ። | ይህ ትኬት (`betSlip.errors.stakeTooLowBody`); የሱቁን ሠራተኞች ይጠይቁ (`terminal.kiosk.unavailable.body`); ምን ያህል እንደሚከፍል (how much it pays) new                               |
| `betSlip.minStake`       | ዝቅተኛው የውርርድ መጠን {amount}               | As `betSlip.errors.stakeTooLowBody` (ዝቅተኛው የውርርድ መጠን); shown under the stake field on both sites (the user's decision, 2026-10-08)                                  |
| `betSlip.potentialWin`   | ሊያሸንፉ የሚችሉት                            | New: what you could win (ሊያሸንፉ, as "win"); replaces `betSlip.totalReturn`, `maxReturn` and `youStake`, removed with the payout card (the user's review, 2026-10-08) |

## Multiple only, three slips (F3c, 2026-10-08)

The tab label is the user's choice ("ትኬት {n}", the slip's own word). All composed; all need review.
Removed: `betSlip.alerts.useSingle` (no Single to switch to), `booking.sizesNote` (the slip never prices
a system). For the reviewer (F3c review U3): ትኬት now names the tabs ("ትኬት 1"), the placed ticket and
the slip itself ("ትኬት አስቀምጥ", "per ticket"); on the placed screen "ትኬት 1" sits above the ticket's own
"ትኬት". The user chose it; confirm it reads clearly or suggest a word for the tabs.

| Key                           | Amharic                                        | Composed from                                                          |
| ----------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `betSlip.slipN`, `slipsAria`  | ትኬት {n} / ትኬቶች                                 | ትኬት (`betSlip.title`)                                                  |
| `betSlip.slipNAria`           | ትኬት {n}፣ {count} ምርጫዎች                         | As `nav.slipAria`                                                      |
| `betSlip.alerts.conflictBody` | ሁለት ምርጫዎች ከአንድ ጨዋታ ናቸው። አንዱን ያስወግዱ።            | The old body without "ወይም ነጠላ ይምረጡ"                                    |
| `booking.sizesNoteMultiple`   | ይህ ኮድ የ{sizes} ሲስተም ነው፤ ትኬቱ እንደ አንድ ጥምር ያሰላዋል። | The old opening; ጥምር (multiple, the old tab's word); ያሰላዋል (prices it) |
| `booking.singlesNote`         | ይህ ኮድ በነጠላ ተቀምጧል፤ ትኬቱ እንደ አንድ ጥምር ያሰላዋል።       | ነጠላ (single, the old tab's word); ተቀምጧል (was saved) new                |

## Slip codes on the kiosk (F8cc, 2026-10-08)

The kiosk's Book bet makes a slip code, shown in the player's booking-code dialog (the user's review), so
it needs only the wait after the terminal's 30 codes per 10 minutes and the refusals. All composed; all
need review.

| Key                                   | Amharic                                                                               | Composed from                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `terminal.code.paused`, `pausedLater` | ይህ ተርሚናል በጣም ብዙ ኮዶች ሠርቷል። ትኬት ማስቀመጥ ከ{minutes} ደቂቃ በኋላ ይመለሳል። / … ቆየት ብለው እንደገና ይሞክሩ። | `terminal.activate.tooMany` / `tooManyLater` (ብዙ…, ከ{minutes} ደቂቃ በኋላ); ሠርቷል (has made); ትኬት ማስቀመጥ (Book bet, `betSlip.bookBet` ትኬት አስቀምጥ) |
| `terminal.code.failed`                | ኮድ ማግኘት አልተቻለም። እንደገና ይሞክሩ።                                                           | As `booking.errors.failed` (… አልተቻለም። እንደገና ይሞክሩ።)                                                                                         |
| `terminal.code.cannot`                | ይህ ትኬት እንዳለ ኮድ ሊሆን አይችልም።                                                             | As `booking.errors.cannotBook` (ይህ ትኬት እንዳለ … አይችልም)                                                                                       |

## Promotions (F7ca, 2026-10-09)

No design-project page has these strings: every one is composed and needs review. Vocabulary is the
catalogue's own — ቅናሾች (`profile.notifOffers`), ቦነስ (`wallet.bonus`), ኦድ (`betSlip.totalOdds`), ገቢ
(`header.deposit`), ደንቦች (`footer.terms`), ጊዜው … (`bets.status.expired`) — and "promo code" is borrowed as
ፕሮሞ ኮድ.

| Key                                                             | Amharic                                                 | Composed from                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `nav.promotions`, `promotions.title`, `offersTitle`             | ቅናሾች                                                    | `profile.notifOffers`                                                  |
| `promotions.intro`, `menuBody`                                  | ቅናሾች፣ ቦነስዎና የፕሮሞ ኮዶች። / ቅናሾች፣ ቦነስና ነፃ ውርርዶች             | ቅናሾች; ቦነስ (`wallet.bonus`); ነፃ ውርርድ (free bet) new                     |
| `promotions.yourBonus`, `bonusUnnamed`                          | ቦነስዎ / ቦነስ                                              | `wallet.bonus` with the possessive                                     |
| `promotions.wagered`                                            | ከ{required} ውስጥ {done} ተወራርደዋል                          | As `rg.usedDay` (ከ{limit} ውስጥ {used} …); ተወራርደዋል (have wagered)        |
| `promotions.expires`                                            | {date} ላይ ጊዜው ያልፋል                                      | `bets.status.expired` (ጊዜው አልፏል) in the future tense                   |
| `promotions.noBonus`, `noBonusBody`                             | ንቁ ቦነስ የለም / ቦነስና ምን ያህሉን እንደተወራረዱበት እዚህ ይታያሉ።          | ንቁ (active) new; "… እዚህ ይታያሉ" as `bets.guestBody`                      |
| `promotions.bonusFailedTitle`, `offersFailedTitle`              | ቦነስዎን መጫን አልተሳካም / ቅናሾቹን መጫን አልተሳካም                     | As `wallet.loadFailedTitle`                                            |
| `promotions.loadFailedBody`                                     | ግንኙነትዎን ያረጋግጡ እና እንደገና ይሞክሩ።                            | `wallet.loadFailedBody`                                                |
| `promotions.freeBets`, `freeBetStake`, `noFreeBets`             | ነፃ ውርርዶች / {stake} ነፃ ውርርድ / ነፃ ውርርድ የለም                | ነፃ (free) + ውርርድ (`nav.myBets`)                                        |
| `promotions.noFreeBetsBody`                                     | የሚያገኟቸው ነፃ ውርርዶች እዚህ ይታያሉ።                              | ነፃ ውርርድ; "… እዚህ ይታያሉ" (review U3)                                      |
| `promotions.freeBetPicks`, `freeBetLegOdds`, `freeBetTotalOdds` | ምርጫዎች፦ {n} ወይም ከዚያ በላይ / የእያንዳንዱ ምርጫ ኦድ፦ … / ጠቅላላ ኦድ፦ … | ምርጫ (`nav.slipAria`), ኦድ, ጠቅላላ ኦድ (`betSlip.totalOdds`); "or more" new |
| `promotions.codeLabel`, `codeHelp`                              | የፕሮሞ ኮድ / ኮድ አለዎት? ቅናሹን ለማግኘት ያስገቡት።                    | ኮድ (booking codes); ያስገቡ (`betSlip.alerts.deposit`)                    |
| `promotions.redeem`, `redeeming`                                | ተጠቀም / በመጠቀም ላይ…                                        | ተጠቀም (use), imperative as `profile.verify`                             |
| `promotions.granted`, `pendingDeposit`                          | ኮዱ ተቀባይነት አግኝቷል። / … በሚቀጥለው ገቢዎ ላይ ይተገበራል።              | ተቀባይነት አግኝቷል (was accepted) new; ገቢ                                    |
| `promotions.codeInvalidTitle`, `codeInvalidBody`                | ይህ ኮድ ትክክል አይደለም / ኮዱን ያረጋግጡ እና እንደገና ይሞክሩ።             | As `booking.expiredTitle` (ይህ ኮድ …); `common.retry`                    |
| `promotions.codeUsedTitle`                                      | ይህን ኮድ አስቀድመው ተጠቅመውበታል                                  | ተጠቅመውበታል (have used it) new                                            |
| `promotions.codeCheckTitle`, `codeRefusedTitle`                 | ኮዱን ያረጋግጡ / ኮድዎ ተቀባይነት አላገኘም                            | ያረጋግጡ; the negative of `granted`                                       |
| `promotions.unconfirmedTitle`, `unconfirmedBody`                | ኮድዎን ማረጋገጥ አልቻልንም / ኮዱ ተቀባይነት አግኝቶ ሊሆን ይችላል። …          | As `deposit.unconfirmedTitle` / `unconfirmedBody`                      |
| `promotions.unconfirmedBody` (the plan's wording, review M2)    | … እንደገና ይሞክሩ፤ አንድ ኮድ የሚያገለግለው አንድ ጊዜ ብቻ ነው።             | "a code is only ever used once": የሚያገለግለው (serves) … ብቻ ነው new         |
| `promotions.offersNone`, `offersNoneBody`                       | አሁን ምንም ቅናሽ የለም / አዲስ ቅናሾች እዚህ ይታያሉ።                    | ቅናሽ; "… እዚህ ይታያሉ"                                                      |
| `promotions.from`, `until`, `between`                           | ከ{date} ጀምሮ / እስከ {date} / ከ{from} እስከ {until}          | As `deposit.refused.amount` (ከ{min} እስከ {max}); ጀምሮ (from) new         |
| `promotions.needsCode`, `enterCode`                             | የፕሮሞ ኮድ ያስፈልጋል / ኮድ ያስገቡ                                | ያስፈልጋል (is needed) new                                                 |
| `promotions.terms`                                              | ደንቦች                                                    | `footer.terms`                                                         |
| `promotions.guestTitle`, `guestBody`                            | ቦነስዎን ለማየት ይግቡ / ቦነስዎ፣ ነፃ ውርርዶችዎና የፕሮሞ ኮዶች እዚህ ይታያሉ።    | As `wallet.guestTitle` / `wallet.guestBody`                            |
