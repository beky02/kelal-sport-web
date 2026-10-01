---
status: proposed
requested_by: F0
---

# Round / matchweek label on fixtures

## Why the web app needs it

The design's row meta and event header read "04/10 · 17:00 · Matchweek 6". The contract has no round, so
the label is dropped.

## Proposed change

```yaml
# contracts/src/03_components.yaml → EventSummary.properties and EventDetail.properties
round:
  type: string
  nullable: true
  description: Round in the Accept-Language language, e.g. "Matchweek 6", "Quarter-final"
  example: Matchweek 6
```

## Clients affected

Web, Flutter app.

## Until it lands

`Competition.round` is empty and the meta line leaves it out.
