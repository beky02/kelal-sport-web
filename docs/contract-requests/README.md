# Contract requests

Changes the web app needs from the API contract, which the backend repo owns. Each file is written with
the `/contract-request` skill and applied in the backend with `/contract-change`, then synced here with
`pnpm contract:sync`.

| #                           | Request                                            | Requested by | Status   |
| --------------------------- | -------------------------------------------------- | ------------ | -------- |
| [001](001-board-markets.md) | Double chance and total goals on `/v1/events` rows | F0           | proposed |
| [002](002-team-crests.md)   | Team crest or colours on fixtures                  | F0           | proposed |
| [003](003-fixture-round.md) | Round / matchweek label on fixtures                | F0           | proposed |

Status: `proposed` → `accepted` (backend agreed) → `in-contract` (merged in the backend) → `synced` (here).
