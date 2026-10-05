# F7a — verification

## Tests proven

Each acceptance test, once green, was run against the behaviour broken once and seen to fail.

| Test                                                                                                     | What was broken                                    |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `rg-mappers` "maps the contract's limits: the API's strings, the pending change with its effective time" | `toLimit` dropped `used` (always null)             |
| `rg-mappers` "sends a time limit in minutes alone, never with amount: null, which removes a limit"       | `toLimitSet` sent `amount: null` with a time limit |
| `rg-mappers` "takes a limit above zero in the contract's form, and nothing else"                         | `limitChangeSchema` took `0.00` (`>= 0`)           |
| `money` "says how much of a limit is used as a whole percentage, for a bar only"                         | `percentOf` no longer capped at 100                |
