# F7a — verification

## Tests proven

Each acceptance test, once green, was run against the behaviour broken once and seen to fail.

| Test                                                                                                     | What was broken                                                |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `rg-mappers` "maps the contract's limits: the API's strings, the pending change with its effective time" | `toLimit` dropped `used` (always null)                         |
| `rg-mappers` "sends a time limit in minutes alone, never with amount: null, which removes a limit"       | `toLimitSet` sent `amount: null` with a time limit             |
| `rg-mappers` "takes a limit above zero in the contract's form, and nothing else"                         | `limitChangeSchema` took `0.00` (`>= 0`)                       |
| `money` "says how much of a limit is used as a whole percentage, for a bar only"                         | `percentOf` no longer capped at 100                            |
| `rg-route` "answers 401 AUTH_TOKEN_EXPIRED without a session and sends nothing" (GET limits)             | the GET read the account without a session check               |
| `rg-route` "refuses a limit from another site, without the CSRF header, or not in JSON"                  | `PUT` skipped `assertSameOrigin`                               |
| `rg-route` "starts a break with the player's session, answers 201 and clears the session cookie (AC-6)"  | the 201 kept the session cookie                                |
| `rg-route` "keeps the session when the API refused the break: nothing started"                           | the cookie was cleared before the API answered                 |
| `rg-route` "reads the player's limits from /v1/me/limits with their session, never cached (AC-1)"        | `loadLimits` answered none of the account's limits             |
| `rg-route` "sends a money limit as the contract's RgLimitSet and answers the API's limit (AC-5)"         | `changeLimit` dropped the change the API held back (`pending`) |
