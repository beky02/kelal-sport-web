# 06 — Language and format

Amharic and English are both complete at every release (NFR-Q1, REG-11); Amharic is the tenant default
for `demo` (FD2). The in-house i18n (`lib/i18n`) stays: catalogues, placeholders, rich text and the
parity test already do what the product needs (FD2).

## Where the language comes from

| Page kind     | Source of the language                                                                                                                                                                                                                                                                                   | Status                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Public pages  | The URL segment `/am/…`, `/en/…`, limited to the tenant's `languages`; a visit with no segment is redirected to the stored choice, else `default_language`                                                                                                                                               | F2a                           |
| Account pages | The stored preference (no segment: never indexed)                                                                                                                                                                                                                                                        | Built                         |
| `<html lang>` | Follows the above; tokens key off it                                                                                                                                                                                                                                                                     | Built (store) → F2a (segment) |
| API calls     | `Accept-Language` from the UI on every browser call; the route handlers forward it, so the API's titles and names arrive in the right script. Catalogue loaders read one language once the segment exists (F2a); today they read both and the mappers keep `Localized` pairs                             |                               |
| Shop kiosk    | The customer's tap, else English where the tenant offers it, else its `default_language` (the user's decision, F8ca rework 2); never stored; back to English on idle (F8cc). `<html lang>` and `Accept-Language` follow it. The terminal's own screens (activation, closed, offline) show both languages | F8ca                          |

The header switch is one tap: a user who lands in the wrong script needs no menu. The kiosk has the same
`EN | አማ` switch, among the tenant's languages.

The shared text hooks (`useTranslation`, `useRichTranslation`, `useDateTimeText`, `useLongDateTimeText`)
read the language, clock and calendar from the nearest `LocaleProvider` (`lib/i18n/locale.tsx`), never
from a store. The player's site feeds it from its preferences (`(player)/locale.tsx`, also mounted by
`tests/component/render.tsx`). The kiosk feeds it from its own language, with Gregorian dates and East
Africa Time. Without a provider, the hooks read English, EAT and Gregorian (F8ca).

## Rules for strings

1. Every visible string is in `en.json` **and** `am.json`; `tests/unit/i18n.test.ts` fails on a missing
   or extra key, an empty string, a placeholder in one language only, or Amharic written in Latin.
2. Never concatenate translated fragments. A sentence with a value or a link in it is one key with a
   `{placeholder}`; `useRichTranslation` puts React nodes into placeholders, so each language puts them
   where its grammar wants them. The API's own `detail` is rendered as its own line, not joined.
3. Composed Amharic — strings that had no source in the design project — is listed in
   `TRANSLATION-NOTES.md` with what it was composed from, for a native editor before launch.
4. Names from the API (sports, tournaments, markets, outcomes) are templates from `/v1/dictionary`
   (`Total {total}` → `Total 2.5`), filled by the mappers; the dictionary is per language and versioned.
5. Screen-reader strings (`a11y.*`) are read more often than anything visible; they are translated with
   the same care.

## Amharic is not just longer

| Need           | How                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Line height    | `--leading-body` 1.55 under `[lang="am"]`, 1.4 otherwise                                                                        |
| No uppercasing | `--label-case: none` and `--label-track: 0` in Amharic; never hardcode `uppercase` or `tracking-*` on a label                   |
| Weight         | `--weight-strong` 600 in Amharic, 700 otherwise                                                                                 |
| Headings       | Noto Sans Ethiopic as a variable font with `wdth` condensed to 82 % so headings sit with Barlow Condensed                       |
| Font loading   | Noto Sans Ethiopic subset (WOFF2) through `next/font` beside the Latin UI font (F1 finishes the subset)                         |
| Length         | Every screen is screenshotted in both languages at 375 and 1440 px; a label that wraps mid-number or overflows fails the review |
| SMS            | Not ours to send, but copy that quotes an SMS keeps Amharic short (70 characters per part, C14)                                 |

## Money, odds, numbers (D7, FD4)

| Value          | English      | Amharic     | Rule                                                                       |
| -------------- | ------------ | ----------- | -------------------------------------------------------------------------- |
| Money          | ETB 1,250.00 | 1,250.00 ብር | Always two decimals, grouped; formatted from the decimal string; `t.money` |
| Balance chip   | 1,250.00 ETB | 1,250.00 ብር | Number and a small currency label                                          |
| Odds           | 2.10         | 2.10        | As the contract sends them (2–3 decimals); never rounded up                |
| Signed figures | − ETB 230.00 | − 230.00 ብር | A real minus sign with a space, so it reads as a loss                      |
| Percent        | 8 %          | 8 %         | From the rule set's string                                                 |

Numbers are formatted for display only; nothing is computed from a formatted string.

## Dates and times (D7)

| Value             | Default                                                                 | Preference                                                             |
| ----------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Time zone         | East Africa Time, UTC+3, no daylight saving; the API speaks UTC         | —                                                                      |
| Clock             | 24-hour (19:30)                                                         | Ethiopian clock (1:30 evening), labelled; the profile shows an example |
| Calendar          | Gregorian (4 Oct, Mon 28 Sep, 12 Apr 1998)                              | Ethiopian calendar (መስ 24), labelled; the profile shows an example     |
| Kick-off on a row | `04/10 · 17:00`                                                         | Follows both preferences                                               |
| Date strip        | Weekday and day-month                                                   | Follows the calendar                                                   |
| History headings  | "Today · 3 Oct", "Yesterday · 2 Oct", "Thu 1 Oct" (the EAT date)        | Follows the calendar; a row's time follows the clock                   |
| Long dates        | `formatLongDate`: 12 Apr 1998 / ኤፕሪ 12 1998, or the Ethiopian long form | Follows the calendar                                                   |
| Durations         | "Starts in 12 min", "Valid until Sat 3 Oct, 16:39"                      | Follows both                                                           |

The Ethiopian calendar and clock are preferences in Release 1, never the default (D7).

## Typography and layout tokens

Fonts and the language-keyed tokens live in `app/globals.css` and are exposed as Tailwind utilities;
a component never sets a line height, a case or a tracking by hand for a label. See 07-tenancy for the
colour tokens.
