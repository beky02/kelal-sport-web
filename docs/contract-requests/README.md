# Contract requests

Changes the web app needs from the API contract, which the backend repo owns. Each file is written with
the `/contract-request` skill and applied in the backend with `/contract-change`, then synced here with
`pnpm contract:sync`.

| #                                              | Request                                                                                                                                | Requested by  | Status   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------- |
| [001](001-board-markets.md)                    | Double chance and total goals on `/v1/events` rows                                                                                     | F0            | proposed |
| [002](002-team-crests.md)                      | Team crest or colours on fixtures                                                                                                      | F0            | proposed |
| [003](003-fixture-round.md)                    | Round / matchweek label on fixtures                                                                                                    | F0            | proposed |
| [004](004-client-ip-forwarding.md)             | Forward the player's IP and device from the web server                                                                                 | F3b           | proposed |
| [005](005-booking-idempotency.md)              | Accept `Idempotency-Key` on `POST /v1/bookings`                                                                                        | F3b           | proposed |
| [006](006-auth-kyc-error-examples.md)          | Named examples for the auth and Fayda refusals; `REG_ID_TAKEN` after registration                                                      | F4b           | proposed |
| [007](007-bet-figures-and-refusal-examples.md) | `rules_version` on `Bet`, its payout figures described, named bet refusals, a retry that can settle an unconfirmed bet; My bets counts | F5a           | proposed |
| [008](008-withdrawal-bonus-forfeit.md)         | Confirm a bonus forfeit when withdrawing (BON-07); an example for `PAY_ACTIVE_BONUS_WAGERING`                                          | F6a (for F6c) | proposed |

Status: `proposed` → `accepted` (backend agreed) → `in-contract` (merged in the backend) → `synced` (here).
