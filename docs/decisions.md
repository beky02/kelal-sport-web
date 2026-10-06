# Frontend decisions

Decisions for this repo that the higher sources (the contract, Engineering Decisions D1–D9) leave open,
or where the client-apps design (C18) and the built app disagree. They never override the contract or
D1–D9; if one of those changes, revisit the decision here. Each names the task that carries it out.

## FD1. Two web projects: player and terminal here, split by host; staff apps in `kelalsport-ops` (2026-10-05)

Replaces the 2026-10-01 decision (one pnpm + Turborepo workspace with `apps/player`, `terminal`, `pos`,
`agent`, `admin`, converted in F8a), on the product owner's direction.

**Question.** C18 §3 puts every browser app in one pnpm/Turborepo workspace (`apps/player`, `terminal`,
`pos`, `agent`, `admin`; shared `packages/`). This repo is a single Next.js app. Where do the terminal,
cashier POS, agent portal, back office and platform console (FD6) live, and does putting several apps in
one Next.js project cost the player site?

**Decision.**

- **Two projects.**
  - **This repo (`kelalsport-web`)** stays **one Next.js app**, serving the **player site** and the **shop
    terminal**, each on its own host.
  - **`kelalsport-ops`**, a new repo (F12), holds the staff and shop-counter apps: **cashier POS**,
    **agent portal**, **back office** and **platform console**.
- **This app is split by host, with a root layout per route group:**

  ```
  src/app/(player)/layout.tsx    today's pages, same URLs, the player's <html>
  src/app/(terminal)/layout.tsx  the kiosk's own <html>; its pages under /terminal/*
  src/app/api/terminal/*         the terminal's route handlers (device signature, terminal token)
  src/proxy.ts                   terminal.{brand} serves only /terminal/* and /api/terminal/*
                                 (its "/" rewritten to /terminal); www.{brand} never serves them
  ```

  Each root layout has its own JavaScript and CSS, so a player never downloads terminal code and the kiosk
  never loads login, wallet or account pages. The separation is the proxy's: a route of the other app
  answers 404 on the wrong host, so there is no login on a shop PC. The player's session cookie is bound to
  its host (`__Host-` in production). One build can run as two deployments (`www` and `terminal`) so shop
  and online traffic scale and restart apart. The terminal reuses `src/features/*` (catalogue, odds,
  the slip in a `terminal` mode) and slipcalc with the retail rule set.

- **Conditions for `kelalsport-ops`.** The POS shows money before a sale (stake, taxes, payout), so:
  1. Its slip figures come only from `contracts/golden/ts/slipcalc.ts`, synced from the backend with
     `contract:sync` like here — never copied or edited.
  2. Its CI runs the golden CSV test and the contract drift check, as this repo's does.
  3. It follows D3 (the browser never calls the API; tokens in httpOnly cookies) and FD4 (money as
     strings, BigInt santim when computed).

**What this version of Next.js says** (`node_modules/next/dist/docs`, checked 2026-10-05):

- **Route groups** may each have a root layout. Moving between them is a full page load (harmless across
  hosts). Two groups may not resolve to the same path, hence `/terminal/*`. The home route `/` must sit
  inside a group.
- **The proxy** (`proxy.ts`) can rewrite by host (and `next.config` rewrites can match `has: host`). It runs
  on the Node.js runtime, and its `matcher` must be a constant. Enforcing the split means it runs on every
  page and route handler, excluding `_next/static`, `_next/image` and public files, instead of today's
  four account paths. That is a host lookup per request, nothing more.

**Why.**

- **The terminal belongs with the player site.** It is the player's catalogue and slip on a touch screen,
  with no staff, cash or login, so a separate app would copy the most code for the least gain.
- **The staff apps belong together, apart from the player site.** They share staff sign-in, devices, cash
  and the ledger's figures, and little with the player site but the API and slipcalc, which both projects
  take from the contract.
- **One Next.js app split by host costs the player nothing at runtime.** It costs a single build: a
  terminal change redeploys the player site, accepted for two customer-facing apps kept together.

**Carried out in F8a** (the host split), **F8b–F8c** (the terminal), **F12** (`kelalsport-ops`; F9–F11
are built there).

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
- **The platform layer** is a separate app, the **platform console** (in `kelalsport-ops`, F11, FD1), for
  platform staff: create, run and suspend brands. A brand's own staff keep their back office (F10b–F10g).

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
contract leaves open; it doesn't override it. **Carried out in F10a, F10g and F11** (all in
`kelalsport-ops`, FD1).
