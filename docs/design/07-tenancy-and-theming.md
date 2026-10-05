# 07 — Tenancy and theming

One build, many brands (C16, C18 §4.3, PRD G8). Nothing brand-specific is in the code: the host picks
the tenant, the tenant's public configuration supplies the rest.

## Host → tenant (D3)

| Step                | Where                                                                                                                                                             | Status      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| The request arrives | `Host` → `TENANT_HOST_MAP` (`kelalsport.et=kelal,localhost=demo`) → tenant code, else `DEFAULT_TENANT`                                                            | Built       |
| Behind our edge     | `X-Forwarded-Host` (and `-Proto`, `-For`) are believed only when `TRUSTED_PROXY_HOPS` is set, and then only the entry the edge appended (the n-th from the right) | Built (F4a) |
| Every API call      | `X-Tenant-Id: <code>` from the route handler; the API refuses a header that disagrees with its own host                                                           | Built       |
| A player's session  | Sealed with its tenant; read under another tenant's host it is nothing                                                                                            | Built (F4a) |
| Links we make       | `og:url` and share links use the tenant's own host, never a forwarded one it does not own                                                                         | Built (F3b) |

## `/v1/config/public` (C16 §5)

Read once per request on the server and cached per tenant for a minute (`loadPublicConfig`); the browser
gets the view it needs through `/api/config`. What the frontend takes from it:

| Field                                         | Used for                                                                                                                                          | Status                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `tenant.name`, `brand.name`, `brand.logo_url` | Header, titles, Open Graph site name                                                                                                              | F1 (site name built for `/b`)     |
| `brand.colors`                                | The theme tokens (below)                                                                                                                          | F1                                |
| `brand.support.telegram`, `.phone`            | Profile support rows, footer, maintenance screen                                                                                                  | F1                                |
| `languages`, `default_language`               | The `[lang]` segment, the switch, the first-visit redirect (FD2)                                                                                  | F2a (default used for `/b` today) |
| `features.booking_codes`                      | Book bet and Load a code shown or not (on unless explicitly `false`)                                                                              | Built                             |
| `features.live`, `features.virtuals`          | Release 2 gates alongside `config/features.ts` (D8)                                                                                               | —                                 |
| `real_money_enabled`                          | A clear notice; placing, depositing and withdrawing disabled (CFG-04)                                                                             | F1                                |
| `betting` (the `RuleSet`)                     | slipcalc's rules, quick stakes, `default_odds_policy`                                                                                             | Built (F3a)                       |
| `legal.terms_version`, `rules_url`, `min_age` | Registration consent and the age copy (F4b: `terms_version` checked by the register route handler, `min_age` in the age box); the rules link (F1) | F4b, F1                           |
| `rg.reality_check_minutes`                    | Not in the contract's `PublicConfig`: the interval in force is `Me.flags.reality_check_minutes` (F7b; request 012 asks the backend to confirm)    | F7b                               |
| `dictionary_version`                          | Dictionary refresh (304 when unchanged)                                                                                                           | F2b                               |
| `min_app_version`                             | The Android app only                                                                                                                              | —                                 |

Payment methods and their limits come from `/v1/payment-methods`, not config (F6).

## Theme tokens (D7)

Colours, radii and fonts are CSS variables in `app/globals.css`, exposed as Tailwind utilities
(`bg-surface`, `text-muted`, `rounded-lg`). **A raw `#hex` in a component is a bug** (two pre-existing
exceptions, the Telegram brand button and the KYC badge's case, are tracked for removal). Both themes are
defined; `[data-theme]` on `<html>` switches, set before first paint by a blocking script so nobody sees a
flash.

| Token family                       | Tokens                                                                                                                                               | From `brand.colors` (F1)                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Surfaces                           | `ground`, `surface`, `raised`, `odd`, `line`, `border`, `divider`, `sel-row`                                                                         | `background`, `surface`, `border`        |
| Text                               | `text`, `muted`, `on-accent`                                                                                                                         | `text`, `text_muted`, `primary_contrast` |
| Accent (action and selection only) | `accent`, `accent-100`, `accent-600`, `accent-700`, `accent-800`                                                                                     | `primary`, `accent`                      |
| Outcomes                           | `win`, `loss`, `win-bg`, `loss-bg`                                                                                                                   | `success`, `danger`                      |
| Odds movement                      | rising / falling colouring on odds buttons                                                                                                           | `odds_up`, `odds_down`                   |
| Signals                            | `live`, `warn`, `warn-bg`, `telegram`                                                                                                                | —                                        |
| Type                               | `--font-barlow`, `--font-barlow-condensed`, `--font-noto-ethiopic`; `--head-stretch`, `--leading-body`, `--label-*`, `--weight-strong` (06-language) | —                                        |

Every key has a default, so a config that leaves one out still renders (D7). Accent is reserved for
action and selection; nothing decorative uses it.

## Components (`components/ui`)

Button (primary, raised, outline, ghost; sm → cta), IconButton, Field (label, help, error, a trailing
control), TextInput, PhoneInput (+251 fixed), PasswordInput (Show/Hide), CheckboxRow (a consent is a
block with links, so the whole block is the target), SubmitButton, OrDivider, TelegramButton, Card,
Segmented, Switch, Sheet (phone bottom sheet), Skeleton, CountBadge, LiveTag, StarButton, TeamCrest and
Flag (initials or a flag, nothing in data-saver mode), SportIcon, Barcode (Code 128). Odds buttons live
in `features/odds` with their five states: normal, selected, suspended, price up, price down.

The gallery `/dev/components` (F1) shows every token, both themes, every odds-button state and every
field state in both languages; it is the review surface for a theme change and returns 404 in
production.

## Compose, don't add props

An event row is `TeamLine` + `EventMeta` + `OddsGroup`; a market card is a title and an `OddsGroup`.
Resist the twenty-prop component (AGENTS.md).
