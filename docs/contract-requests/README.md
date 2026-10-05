# Contract requests

Changes the web app needs from the API contract, which the backend repo owns. Each file is written with
the `/contract-request` skill and applied in the backend with `/contract-change`, then synced here with
`pnpm contract:sync`.

| #                                              | Request                                                                                                                                                                               | Requested by  | Status   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------- |
| [001](001-board-markets.md)                    | Double chance and total goals on `/v1/events` rows                                                                                                                                    | F0            | proposed |
| [002](002-team-crests.md)                      | Team crest or colours on fixtures                                                                                                                                                     | F0            | proposed |
| [003](003-fixture-round.md)                    | Round / matchweek label on fixtures                                                                                                                                                   | F0            | proposed |
| [004](004-client-ip-forwarding.md)             | Forward the player's IP and device from the web server                                                                                                                                | F3b           | proposed |
| [005](005-booking-idempotency.md)              | Accept `Idempotency-Key` on `POST /v1/bookings`                                                                                                                                       | F3b           | proposed |
| [006](006-auth-kyc-error-examples.md)          | Named examples for the auth and Fayda refusals; `REG_ID_TAKEN` after registration                                                                                                     | F4b           | proposed |
| [007](007-bet-figures-and-refusal-examples.md) | `rules_version` on `Bet`, its payout figures described, named bet refusals, a retry that can settle an unconfirmed bet; My bets counts                                                | F5a           | proposed |
| [008](008-withdrawal-bonus-forfeit.md)         | Confirm a bonus forfeit when withdrawing (BON-07); an example for `PAY_ACTIVE_BONUS_WAGERING`                                                                                         | F6a (for F6c) | proposed |
| [009](009-deposit-reference-and-examples.md)   | The provider's reference on a deposit (DEP-08); examples for every deposit state and refusal; whether a 502 is kept under its key                                                     | F6b           | proposed |
| [010](010-withdrawal-examples-and-reasons.md)  | Examples for every withdrawal state, the cancel and each refusal; review reasons as codes; an account already saved; the kind of account a method pays to; self-exclusion and the 502 | F6c           | proposed |
| [011](011-rg-limits-and-exclusion.md)          | Removing a time limit; minutes used and when a period resets; which exclusion is in force and what a second one does; RG refusal examples; the RG operations' missing responses       | F7a           | proposed |
| [013](013-platform-and-retail-chain.md)        | Brand and partner agents, every shop under an agent, one agent level; the retail admin errors; the platform console's operations                                                      | FD6           | proposed |

Status: `proposed` → `accepted` (backend agreed) → `in-contract` (merged in the backend) → `synced` (here).
