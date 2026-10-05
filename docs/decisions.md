# Frontend decisions

Decisions for this repo that the higher sources (the contract, Engineering Decisions D1–D9) leave open,
or where the client-apps design (C18) and the built app disagree. They never override the contract or
D1–D9; if one of those changes, revisit the decision here. Each names the task that carries it out.

## FD1. One web workspace, converted before the terminal (2026-10-01)

**Question.** C18 §3 puts every browser app in one pnpm/Turborepo workspace (`apps/player`, `terminal`,
`pos`, `agent`, `admin`; `packages/api`, `slipcalc`, `ui`, `catalogue`, `betslip`, `i18n`, `config`). This
repo is a single Next.js app.

**Decision.** Keep all web apps in **this repo**, converted to a pnpm + Turborepo workspace in a
dedicated task, **F8a**, after F7 and before the terminal (F8). The player app moves to `apps/player`
unchanged; `packages/api` (generated types, mappers, server client), `packages/slipcalc`, `packages/ui`
and `packages/i18n` are extracted from code that F1–F7 will have finished.

**Why.** The terminal, POS and agent apps reuse the slip, the calculator, the catalogue and the API
client; separate repos would copy them and let them drift — the problem the golden CSV exists to prevent.
Converting now would move code that F1–F7 are about to rewrite; converting after F7 moves finished code,
which is mechanical (`git mv`, package boundaries, Turborepo pipeline). The backend README already settles
that the web code is its own repo with a synced `contracts/` copy.

**Added 2026-10-05 (FD6).** A sixth app, `apps/console` — the platform console above the brands — joins
the workspace when the backend docs and the contract describe it (F11).

## FD2. Language in the URL; the tenant's default language (2026-10-01)

**Question.** C18 §4.3: `next-intl`, Amharic by default, the language in the URL (`/am/…`, `/en/…`) so each
version is indexable. Built: the language is a stored preference with English as the default and no URL
segment. The contract's `/v1/config/public` gives each tenant `languages` and `default_language`
(`am` for `demo`).

**Decision.**

- Public pages get a `[lang]` segment: `/am/…` and `/en/…`, limited to the tenant's `languages`.
- A request without one is redirected (proxy) to the player's stored choice, else the tenant's
  `default_language` from config — **Amharic for `demo`**, not English. The contract outranks the app's
  current default.
- Switching language navigates to the other prefix; the stored preference follows the URL, not the other
  way round. Account pages (`/wallet`, `/my-bets`…) keep the preference without a segment, since they are
  never indexed.
- Keep the in-house i18n (`lib/i18n`), not `next-intl`: it already does catalogues, placeholders, Amharic
  rich text and the catalogue-parity test, and swapping it buys nothing a player sees.
- Once the language is in the URL, server loaders fetch the catalogue in **one** language
  (`Accept-Language` from the segment) instead of both (F0's `both()`), halving catalogue calls.

**Why.** Match and league pages indexed and previewed in Telegram in Amharic is what C18 is after, and the
contract makes Amharic the tenant default. The library choice in C18 is a means; the URL behaviour is the
requirement. **Carried out in F2.**

## FD3. D7 deep links and C18 route names, old paths redirected (2026-10-01)

**Question.** D7 fixes one path set for web and app: `/match/{id}`, `/b/{code}`, `/t/{ticket}`. C18 §4.1
adds `/sport/[slug]` and `/league/[id]`. Built: `/event/[id]`, `/competition/[id]`, sport as `?sport=`.

**Decision.** Rename to `/{lang}/match/[id]`, `/{lang}/league/[id]`, `/{lang}/sport/[slug]`; keep `date`
and `filter` as query parameters (they are views of a page, not pages). Unprefixed `/match/{id}`,
`/b/{code}` and `/t/{ticket}` always work — they are the links the Flutter app and Telegram share — and
redirect to the language-prefixed page. `/event/*` and `/competition/*` redirect permanently (308).
`routes.ts` stays the only place paths are written.

**Why.** D7 is a decision above C18 and the built app, and shared links must be identical across web and
app. **`/match` and `/league` in F2; `/b` in F3; `/t` in F5.**

## FD4. No `decimal.js`: money is strings in, BigInt santim when computed (2026-10-01)

**Question.** C18 §4.2 says `decimal.js` for money, with an ESLint rule banning `number` for money. D1
defines the slip with exact BigInt rationals, which `contracts/golden/ts/slipcalc.ts` already implements.

**Decision.** No `decimal.js`. Money and odds stay the contract's decimal strings in domain types. The
only arithmetic is slipcalc's (D1). Anything else that must compare or add amounts — a deposit amount
against a method's limits, a balance check before placing — goes through a small `lib/money.ts` that
works in BigInt santim with slipcalc's rule: it reuses slipcalc's exported `money()` for santim → string,
and mirrors its (private, uneditable) string → santim parse, with a test pinning the two together. Display
formatting takes the string. C18's lint rule is
kept in spirit: ESLint bans `parseFloat`, `Number(…)` and unary `+` on money/odds fields outside
`lib/money.ts`, slipcalc and the display formatters.

**Why.** Two exact-number libraries would be two definitions of rounding to keep in step with the golden
CSV; one (slipcalc's) can't drift from D1. It also keeps ~30 KB of library out of the first load
(C18 §8: < 150 KB). **Carried out in F3** (lib, lint rule, slip); F5–F6 use it.

## FD5. Phone tab bar: Search takes Live's slot until Release 2 (2026-10-01)

**Question.** With live betting off (D8) the phone bar had four tabs and the raised slip button sat second,
not in the middle.

**Decision.** Keep five slots so the slip stays centred. The second slot is **Live** when
`features.live` is on and **Search** otherwise, opening a phone search screen (`/{lang}/search`) on the
existing `useSearch` hook.

**Why.** Search exists today only in the desktop header (≥ 1280 px); phones and tablets have none, and
players find a match by team name. It needs no new API (`/v1/search` is already wired) and no new design
language — a tab and a results list that reuses the header's rows. Wallet was ruled out (the balance chip
in the app bar is its entry point, by design) and Promotions (not built until F7, and a weaker reason to
open the app). **Carried out in F2**, with the search screen.

## FD6. Phase 1 chain: Platform → Brand → Agent → Shop; the platform layer (2026-10-05)

**Question.** C19 §3 lets a brand's retail network have master agents (a regional level above agents) and
shops the operator runs with no agent, and the contract allows both (`Agent.level: master_agent`,
`Agent.parent_id`, `Shop.agent_id` nullable). Nothing in the backend docs describes the company above the
brands: who creates a brand, what it can see, how a brand pays for the platform.

**Decision.** The product owner fixed the Phase 1 chain
([backend proposal 001](backend-proposals/001-platform-and-retail-hierarchy.md)):

```
Platform → Brand (tenant) → Agent → Shop (terminals, cashiers)
```

- **Every shop has an agent.** A shop the brand runs itself sits under an agent the brand owns (a
  **brand agent**); a **partner agent** is a business running shops for the brand.
- **One agent level.** No master agents in Phase 1.
- **The platform layer** is a separate app, the **platform console** (`apps/console`, F11), for platform
  staff: create, run and suspend brands. A brand's own staff keep their back office (F10b–F10g).

What the frontend does now, within what the contract already allows:

- The back office's retail administration (F10g) offers no master agents and no shop without an agent:
  creating a shop starts with choosing its agent.
- The agent portal (F10a) shows one agent's own shops; there are no sub-agent or subtree views.
- Agents are labelled brand or partner once the contract has `Agent.kind`
  ([contract request 013](contract-requests/013-platform-and-retail-chain.md)); until then, nothing in the
  UI depends on the difference.

What waits for the backend: `Agent.kind`, `Shop.agent_id` required, the `Platform` operations (request
013), and the proposal's open questions — how a brand pays the platform (Q1), several brand agents (Q2),
the shop manager (Q3; F9a keeps the contract's `shop_manager` role meanwhile), platform access to brand
data (Q4), how many brands at launch (Q5), regulator reporting (Q6) and the brand agent's portal login
(Q7).

**Why.** One shape for every shop makes payout rules (`same_agent`), settlement, commission and every
agent-portal and retail-admin screen one case instead of two, and one agent level drops the subtree views
and roll-ups Phase 1 doesn't need. Leaving master agents and agentless shops out of the UI is a choice the
contract leaves open; it doesn't override it. **Carried out in F10a, F10g and F11.**
