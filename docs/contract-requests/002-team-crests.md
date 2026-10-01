---
status: proposed
requested_by: F0
---

# Team crest or colours on fixtures

## Why the web app needs it

Board rows, the event header and favourites badge each team. The design uses a flag for national sides
and the club's colours behind its initials for clubs. `EventSummary.home` / `away` are plain strings, so
every team now gets neutral initials and national teams get no flag.

## Proposed change

Keep `home` / `away` as they are (no breaking change) and add optional team details:

```yaml
# contracts/src/03_components.yaml
TeamRef:
  type: object
  required: [id]
  properties:
    id: { type: string, example: tm_arsenal }
    country:
      {
        type: string,
        nullable: true,
        description: ISO 3166 alpha-2 for national teams,
      }
    colors:
      type: object
      nullable: true
      properties:
        primary: { type: string, example: "#D61F26" }
        contrast: { type: string, example: "#FFFFFF" }
    logo_url: { type: string, format: uri, nullable: true }

# EventSummary and EventDetail .properties
home_team: { $ref: "#/components/schemas/TeamRef" }
away_team: { $ref: "#/components/schemas/TeamRef" }
```

## Clients affected

Web, Flutter app, terminal.

## Until it lands

`crestFor` in `src/lib/api/mappers/catalogue.ts` draws initials on theme tokens (`--color-raised`,
`--color-text`).
