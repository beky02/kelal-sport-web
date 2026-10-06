# F8b — verification

## Tests proven

Each acceptance test was seen failing against a deliberate break of the behaviour it guards, then the code
was restored (a scratch script swaps one string, runs the test, puts it back).

| Test                                                                                                       | What was broken                                        |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `session.test.ts` › still opens a cookie sealed before the sealing moved into seal.ts (F8b)                | The session's HKDF info changed (`kelal.session.v1x`)  |
| `server-config.test.ts` › refuses to send terminal activations to the real API before contract request 004 | Seen failing before the refusal existed                |
| `terminal-route.test.ts` › says rotation is due when fewer than 7 days of the token remain, and not before | `<` flipped to `>` in `rotateDue`                      |
| › forwards the device id, timestamp, signature and token to the API                                        | `X-Device-Signature` dropped from the upstream headers |
| › answers a skewed clock with the server's time instead of calling the API                                 | The ±20 s check disabled                               |
| › refuses a status read without valid device headers, and calls nothing                                    | The shape checks reduced to "a timestamp is present"   |
| › says blocked for a revoked status and for AUTH_INVALID_CREDENTIALS, and keeps the cookie                 | Revoked made to clear the cookie                       |
| › refuses a malformed code, another site and a player host before calling the API                          | `terminalOnly` made to pass every host                 |
| › rotates: the new token replaces the cookie, from a signed call made with the old one                     | The new cookie not set                                 |
| › activates: the token goes into a sealed httpOnly cookie, never the answer                                | The mapper made to add the token to the answer         |
