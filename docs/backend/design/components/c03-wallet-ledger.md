# C03 Wallet & Ledger

## 1. Purpose & scope

C03 is the single source of truth for money. Every balance change, whether deposit, stake, win, bonus, tax, withdrawal or adjustment, is a balanced double-entry transaction posted through C03. It implements WAL-01 to WAL-09 and NFR-S1/S2/S4.

## 2. Research notes

| Topic | Decision | Why / source |
| --- | --- | --- |
| Double-entry | Every transaction has entries summing to zero; balances derived from entries | Standard accounting; required for audit and reconciliation |
| Storage | PostgreSQL tables + row locks; cached balance on `account` updated in the same transaction | Simple and ACID; [TigerBeetle](https://github.com/tigerbeetle/tigerbeetle) or [Formance Ledger](https://github.com/formancehq/ledger) only if volume later demands |
| Concurrency | Pessimistic locking (`SELECT … FOR UPDATE`) on the affected accounts, ordered by account ID to prevent deadlocks | Hot accounts (house) are handled by §8 below |
| Idempotency | Unique `(tenant_id, idempotency_key)`; return the original txn on repeat | Retries from payments, settlement and game callbacks are normal |
| Immutability | No UPDATE/DELETE on entries; corrections are reversals | Auditability |

## 3. Responsibilities & boundaries

- **Owns**: chart of accounts, accounts, transactions, entries, balances, adjustments, reconciliation runs and breaks.
- **Offers**: a synchronous in-process interface `LedgerService.post(...)` used inside the caller's DB transaction, so the business change and the money move commit together.
- **Does not**: decide *whether* money should move (callers decide; C03 enforces no-negative and balance rules).

## 4. Chart of accounts

| Code | Owner | Kind | Normal balance | Purpose |
| --- | --- | --- | --- | --- |
| `PLAYER_CASH` | player | liability (owed to player) | credit | Withdrawable money |
| `PLAYER_BONUS` | player | liability | credit | Bonus money, not withdrawable |
| `PLAYER_DEBT` | player | asset | debit | Money the player owes after a resettlement clawback exceeds their cash balance (C10). Future deposits and wins repay it first; never negative PLAYER\_CASH. |
| `PLAYER_LOCKED` | player | liability | credit | Pending withdrawals |
| `HOUSE_OPEN_STAKES` | tenant | liability | credit | Stakes of open bets |
| `HOUSE_GGR` | tenant | revenue | credit | Settled stakes minus winnings |
| `HOUSE_BONUS_COST` | tenant | expense | debit | Bonuses granted and converted |
| `TAX_PAYABLE_WIN` / `TAX_PAYABLE_STAKE` / `LEVY_PAYABLE` | tenant | liability | credit | Taxes and regulator levy owed |
| `PROVIDER_CLEARING:{provider}` | tenant | asset | debit | Money in transit with telebirr, CBE Birr, Chapa… |
| `GAMES_CLEARING:{provider}` (R2) | tenant | liability | credit | Virtual-game stakes in play |
| `SUSPENSE` | tenant | — | — | Unmatched late payments, pending investigation |
| `SHOP_CASH:{shop}` | shop (C19) | asset | debit | Cash a shop or agent holds for the operator: sales in, payouts and settlements out |
| `RETAIL_UNPAID_WINNINGS:{shop}` | shop (C19) | liability | credit | Settled retail wins and refunds waiting to be collected at a counter |
| `AGENT_COMMISSION_PAYABLE:{agent}` | agent (C19) | liability | credit | Commission earned, not yet paid or netted |
| `HOUSE_COMMISSION_COST` | tenant | expense | debit | Agent and shop commission |
| `HOUSE_UNCLAIMED_WINNINGS` | tenant | liability or revenue (per regulator rule) | credit | Retail wins not claimed within the claim period |
| `HOUSE_BANK:{account}` | tenant | asset | debit | Operator bank accounts receiving shop and agent settlements |

In the database, amounts are signed: a positive amount is a debit and a negative amount is a credit. A player's displayed balance is the negated sum of their liability account.

## 5. Data model

```sql
create table ledger.account (
  id            uuid primary key,
  tenant_id     uuid not null,
  code          text not null,          -- chart code, e.g. PLAYER_CASH
  owner_type    text not null check (owner_type in ('player','tenant','provider','shop','agent')),
  owner_id      uuid,                   -- player id; null for tenant accounts
  currency      char(3) not null default 'ETB',
  balance_santim bigint not null default 0,   -- cached, = sum(entries), sign per normal balance
  allow_negative boolean not null default false,
  version       bigint not null default 0,
  constraint uq_account unique nulls not distinct (tenant_id, code, owner_id, currency)
);

create table ledger.ledger_txn (
  id              uuid primary key,
  tenant_id       uuid not null,
  type            text not null,        -- DEPOSIT, BET_STAKE, BET_WIN, BET_VOID, BONUS_GRANT, ...
  idempotency_key text not null,
  reference_type  text not null,        -- payment | bet | bonus | adjustment | game_round | retail_ticket | cash_movement | retail_settlement | commission_statement
  reference_id    uuid not null,
  reverses_txn_id uuid references ledger.ledger_txn(id),
  created_by      text not null,        -- module or staff id
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  constraint uq_txn_idem unique (tenant_id, idempotency_key)
);
create index ix_txn_ref on ledger.ledger_txn (tenant_id, reference_type, reference_id);

create table ledger.ledger_entry (
  id             bigserial,
  tenant_id      uuid not null,
  txn_id         uuid not null,
  account_id     uuid not null,
  amount_santim  bigint not null check (amount_santim <> 0),  -- + debit, - credit
  balance_after  bigint not null,
  created_at     timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);
create index ix_entry_account on ledger.ledger_entry (account_id, created_at desc);

create table ledger.adjustment_request (
  id            uuid primary key,
  tenant_id     uuid not null,
  player_id     uuid not null,
  account_code  text not null,
  amount_santim bigint not null,
  reason        text not null,
  requested_by  uuid not null,
  approved_by   uuid,
  status        text not null check (status in ('pending','approved','rejected','posted')),
  txn_id        uuid,
  created_at    timestamptz not null default now()
);

create table ledger.recon_run (
  id uuid primary key, tenant_id uuid not null, business_date date not null,
  kind text not null check (kind in ('internal','provider','regulator')),
  provider text, status text not null, breaks int not null default 0,
  started_at timestamptz not null, finished_at timestamptz
);
create table ledger.recon_break (
  id uuid primary key, tenant_id uuid not null, run_id uuid not null references ledger.recon_run(id),
  reference text not null, expected_santim bigint, actual_santim bigint,
  status text not null default 'open' check (status in ('open','explained','resolved')),
  note text, created_at timestamptz not null default now()
);
```

A database trigger rejects UPDATE and DELETE on `ledger_entry`, and a deferred constraint trigger checks that each `txn_id`'s entries sum to zero at commit.

## 6. Posting templates

| Txn type | Entries (debit + / credit −) |
| --- | --- |
| `DEPOSIT` | +PROVIDER\_CLEARING:x, −PLAYER\_CASH |
| `BET_STAKE` (cash, stake tax taken from the stake) | +PLAYER\_CASH (total), −HOUSE\_OPEN\_STAKES (net stake), −TAX\_PAYABLE\_STAKE (stake tax) |
| `BET_STAKE` (bonus part) | +PLAYER\_BONUS, −HOUSE\_OPEN\_STAKES |
| `BET_WIN` | +HOUSE\_OPEN\_STAKES (stake), +HOUSE\_GGR (profit paid), −PLAYER\_CASH (net), −TAX\_PAYABLE\_WIN (tax) |
| `BET_LOSS` | +HOUSE\_OPEN\_STAKES, −HOUSE\_GGR |
| `BET_VOID` | +HOUSE\_OPEN\_STAKES (net stake), −PLAYER\_CASH (and −PLAYER\_BONUS for the bonus part); + TAX\_PAYABLE\_STAKE, −PLAYER\_CASH for the stake tax only if refund\_stake\_tax\_on\_void |
| `ACCA_BONUS` | +HOUSE\_BONUS\_COST, −PLAYER\_CASH |
| `BONUS_GRANT` | +HOUSE\_BONUS\_COST, −PLAYER\_BONUS |
| `BONUS_CONVERT` | +PLAYER\_BONUS, −PLAYER\_CASH |
| `WITHDRAW_LOCK` | +PLAYER\_CASH, −PLAYER\_LOCKED |
| `WITHDRAW_PAID` | +PLAYER\_LOCKED, −PROVIDER\_CLEARING:x |
| `WITHDRAW_RELEASE` | +PLAYER\_LOCKED, −PLAYER\_CASH |
| `LEVY_ACCRUAL` (daily) | +HOUSE\_GGR, −LEVY\_PAYABLE |

Sign convention, roll-up of hot house accounts and idempotency key format are fixed in Engineering Decisions D2.

Retail tickets have no player wallet, so they use their own transaction types: `RETAIL_SALE`, `RETAIL_WIN`, `RETAIL_LOSS`, `RETAIL_VOID`, `RETAIL_CANCEL`, `RETAIL_PAYOUT`, `RETAIL_UNCLAIMED`, `SHOP_FLOAT_TOPUP`, `SHOP_SETTLEMENT`, `COMMISSION_ACCRUAL` and `COMMISSION_NETTED`. Their entries are listed in C19 section 7; they go through the same `post()` function, idempotency keys and balance invariants as every other transaction.

## 7. Interface

```python
class LedgerService(Protocol):
    async def post(
        self,
        session,
        *,
        tenant_id,
        txn_type: str,
        idempotency_key: str,
        reference: Ref,
        lines: list[Line],  # (account_ref, amount_santim)
        created_by: str,
        meta: dict = {},
    ) -> PostedTxn: ...
    async def reverse(self, session, *, txn_id, idempotency_key, reason) -> PostedTxn: ...
    async def balances(self, session, player_id) -> Balances: ...
    async def open_player_accounts(self, session, player_id) -> None: ...
```

**Player API**: `GET /v1/wallet` → `{"cash": "1250.00", "bonus": "50.00", "locked": "300.00", "currency": "ETB"}`. `GET /v1/wallet/transactions?cursor=` → items `{id, type, amount, balance_after, reference, created_at}`.

## 8. Key algorithm: post()

```python
async def post(session, tenant_id, txn_type, idempotency_key, reference, lines, created_by, meta):
    assert sum(l.amount for l in lines) == 0 and len(lines) >= 2
    existing = await repo.find_txn(tenant_id, idempotency_key)
    if existing:
        return existing  # idempotent replay
    accounts = await repo.lock_accounts(sorted(ids(lines)))  # SELECT ... FOR UPDATE, ordered
    for line in lines:
        new_bal = accounts[line.account].balance + signed(line)
        if new_bal < 0 and not accounts[line.account].allow_negative:
            raise InsufficientFunds(line.account)
    txn = await repo.insert_txn(...)
    for line in lines:
        acc = accounts[line.account]
        acc.balance += signed(line)
        acc.version += 1
        await repo.insert_entry(txn.id, acc.id, line.amount, acc.balance)
    await repo.save_accounts(accounts.values())
    return txn
```

**Hot house accounts**: at 600 bets/s, locking `HOUSE_OPEN_STAKES` on every bet would serialise all bets. Two mitigations:

1. Split house accounts into N shards (e.g. 16), chosen by `hash(player_id) % N`.
2. Or mark house accounts `allow_negative` and don't lock them: insert entries and update their balances by a periodic roll-up, since only player accounts need the no-negative check.

Option 2 is simpler and recommended.

## 9. Reconciliation (nightly, per business date in EAT)

1. **Internal**: for every account, cached balance = sum(entries); each txn sums to zero; totals by type match the betting and payments modules (e.g. sum of `BET_STAKE` = sum of `betting.bet.stake` placed that day).
2. **Provider**: completed payments vs provider settlement files, matched by provider reference; unmatched items become breaks.
3. **Regulator**: ledger totals vs `reporting.daily_summary`.

## 10. Events, errors, edge cases

- Publishes `ledger.recon_break` (C15 alert). No other events: callers publish their own business events.
- `WALLET_INSUFFICIENT_FUNDS` if any player account would go negative.
- A deposit callback after a withdrawal has already drained the balance is fine: postings are ordered by lock acquisition.
- **Rounding**: all inputs are integer santim; C07 decides rounding before calling C03.

## 11. Tests

- Property tests (hypothesis): random sequences of postings keep every transaction balanced, never make a player account negative, and cached balance always equals the entry sum.
- Concurrency test: 1,000 parallel stakes on one player never overspend.
- Replay test: the same idempotency key 100 times gives one transaction.
