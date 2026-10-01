---
status: proposed
requested_by: F0
---

# Double chance and total goals on `/v1/events` rows

## Why the web app needs it

The board (design: `Kelal Desktop.dc.html`) shows three market columns per fixture from 1280 px up:
match result (1X2), double chance, and total goals at the main line (O/U 2.5). `EventSummary` carries only
`main`, so the other two columns render as dashes on every row. Fetching `/v1/events/{id}` per row to fill
them would be one request per fixture on a 3G phone.

## Proposed change

Add an optional `board` array to `EventSummary` — the extra markets the list view shows, at most two, in
the same `Market` shape as `main`:

```yaml
# contracts/src/03_components.yaml → EventSummary.properties
board:
  type: array
  maxItems: 2
  description: >-
    Extra markets for list views besides `main`, in display order: double chance (`m_dc`) and the
    main total line (`m_total`) for football. Empty when the sport has no such markets.
  items:
    $ref: "#/components/schemas/Market"
```

Example for `fx_arsenal_chelsea` (reuses the event-detail fixture's prices):

```yaml
board:
  - id: mk_ac_dc
    template_id: m_dc
    specifiers: {}
    status: active
    outcomes:
      - { id: oc_ac_1x, tpl: o_1x, odds: "1.33", active: true }
      - { id: oc_ac_12, tpl: o_12, odds: "1.30", active: true }
      - { id: oc_ac_x2, tpl: o_x2, odds: "1.66", active: true }
  - id: mk_ac_t25
    template_id: m_total
    specifiers: { total: "2.5" }
    status: active
    outcomes:
      - { id: oc_ac_o25, tpl: o_over, odds: "1.85", active: true }
      - { id: oc_ac_u25, tpl: o_under, odds: "1.95", active: true }
```

Alternative if the backend prefers a query parameter: `GET /v1/events?markets=m_1x2,m_dc,m_total` returning
`markets: Market[]` per row. The web app can use either.

## Clients affected

Web (board), Flutter app (match list), terminal (match list).

## Until it lands

`toBoard` sets `doubleChance` and `totalGoals` to `null` and the row shows dashes in those columns
(`NoPrices`). The mapper picks them up from `board` with no component changes.
