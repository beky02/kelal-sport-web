# C11 Bonuses & Promotions

## 1. Purpose & scope

C11 runs every incentive from rules stored as data: accumulator bonus (computed in C07, funded here), welcome bonus with wagering, free bets, promo codes, and later cashback and referrals. It implements BON-01 to BON-07.

## 2. Research notes

| Competitor feature seen | Keep for Release 1? |
| --- | --- |
| Accumulator bonus table (Shamo: 3 legs 5% → 20 legs 100%, min odd 1.3, max 200,000 ETB) | Yes (BON-01) |
| Free bets with rules: min selections, min odd per leg, min total odds (HuluSport `bonus-engine/free-bets`) | Yes (BON-05) |
| Welcome / first-deposit bonus with wagering (Melbet 200% up to 37,000 ETB) | Yes, modest (BON-02/03) |
| “Lost by one” cashback (Shamo rule #36), daily casino cashback | P1, after launch |
| Raffles, tournaments, XP levels, streaks, spin wheel, quizzes | Later; the rule engine is designed to add them |

Bonus abuse is the main risk: multi-accounting to farm welcome bonuses. It is addressed by C02 duplicate signals and wagering rules.

## 3. Rule model

A rule has a **trigger**, **eligibility conditions**, a **reward** and **wagering terms**, stored as validated JSON:

```json
{
  "code": "WELCOME_100",
  "trigger": { "type": "first_deposit" },
  "eligibility": { "kyc": "any", "new_player_days": 7, "min_deposit": "100.00", "exclude_if_duplicate_signal": true },
  "reward": { "type": "bonus_balance", "percent": 100, "max": "1000.00" },
  "wagering": { "multiplier": 5, "min_odds_per_leg": "1.50", "min_legs": 3, "counts": ["multiple"], "expires_days": 14 },
  "window": { "from": "2026-11-01T00:00:00Z", "to": null },
  "max_per_player": 1
}
```

Trigger types: `first_deposit`, `deposit`, `registration`, `promo_code`, `manual`, `bet_settled` (cashback, P1). Reward types: `bonus_balance`, `free_bet`, `cash` (rare, manual only).

## 4. Data model

```sql
create table bonus.bonus_rule (
  id uuid primary key, tenant_id uuid not null, code text not null,
  definition jsonb not null, version int not null, active boolean not null default true,
  created_by uuid, created_at timestamptz not null default now(),
  unique (tenant_id, code, version)
);

create table bonus.player_bonus (
  id               uuid primary key,
  tenant_id        uuid not null,
  player_id        uuid not null,
  rule_id          uuid not null references bonus.bonus_rule(id),
  amount_santim    bigint not null,
  wagering_required_santim bigint not null,
  wagering_done_santim     bigint not null default 0,
  status           text not null check (status in ('active','completed','expired','forfeited','cancelled')),
  expires_at       timestamptz not null,
  grant_txn_id     uuid, convert_txn_id uuid,
  created_at       timestamptz not null default now()
);
create unique index uq_one_active_bonus on bonus.player_bonus (tenant_id, player_id) where status = 'active';

create table bonus.wagering_progress (         -- one row per qualifying bet, for audit
  player_bonus_id uuid not null, bet_id uuid not null, counted_santim bigint not null,
  created_at timestamptz not null default now(), primary key (player_bonus_id, bet_id)
);

create table bonus.free_bet (
  id uuid primary key, tenant_id uuid not null, player_id uuid not null, rule_id uuid,
  stake_santim bigint not null, min_legs int not null default 1, min_leg_odds numeric(6,2),
  min_total_odds numeric(8,2), status text not null check (status in ('available','used','expired')),
  used_bet_id uuid, expires_at timestamptz not null, created_at timestamptz not null default now()
);

create table bonus.promo_code (
  code text not null, tenant_id uuid not null, rule_id uuid not null,
  max_uses int, uses int not null default 0, per_player int not null default 1,
  valid_from timestamptz, valid_to timestamptz, primary key (tenant_id, code)
);
create table bonus.promo_redemption (
  tenant_id uuid not null, code text not null, player_id uuid not null,
  redeemed_at timestamptz not null default now(), primary key (tenant_id, code, player_id)
);
```

## 5. Flows

- **Grant**: on `payment.deposit_completed`, evaluate active rules with that trigger → eligibility check (including duplicate signals) → C03 `BONUS_GRANT` → `player_bonus` row → notify.
- **Wagering**: on `bet.settled` (not placed, so cancelled or voided bets don't count), if the bet qualifies (type, min legs, min odds per leg, not a free bet), add `min(stake, remaining)` to `wagering_done`. When it is met, C03 `BONUS_CONVERT` moves the remaining bonus balance to cash.
- **Spending order**: stakes use cash first, then bonus (tenant option `bonus_first`). The split is recorded on the bet (`stake_bonus_santim`); winnings from the bonus part go to the bonus balance until wagering completes.
- **Expiry job** (hourly): expired bonuses reverse the remaining bonus balance to `HOUSE_BONUS_COST`.
- **Withdrawal with an active bonus**: C04's rule `NoActiveWagering` blocks; the player may forfeit (BON-07) → C03 reverses the bonus balance.
- **Free bet**: C08 accepts `free_bet_id`; stake comes from `HOUSE_BONUS_COST`, not the player; on a win, only profit is credited to cash.

## 6. API

`GET /v1/promotions` (public list with localized terms) · `GET /v1/me/bonuses` → `{active: {amount, wagering_required, wagering_done, expires_at}, free_bets: [...]}` · `POST /v1/promo-codes/redeem {code}` · Staff CRUD `/v1/admin/bonus-rules` with JSON-schema validation and a dry-run endpoint that previews which players would qualify.

## 7. Events

Consumes `payment.deposit_completed`, `player.registered`, `bet.settled`, `kyc.duplicate_detected` (freeze active bonus). Publishes `bonus.granted`, `bonus.completed`, `bonus.expired`.

## 8. Edge cases & tests

- One active bonus at a time (unique partial index); a second grant waits or is refused per rule.
- Rule versioning: an active bonus keeps the rule version it was granted under.
- Tests: rule-schema validation, wagering maths, expiry reversal, free-bet payout excludes stake, abuse scenario (same device, two accounts → second grant blocked).
