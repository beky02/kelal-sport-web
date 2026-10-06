# F8a — verification

## Tests proven

Each new acceptance test, green, then run against the behaviour broken once, then restored.

| Test                                                                                                           | What was broken                                                                                                                        | Result |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| server-config › maps a terminal host to its tenant and marks it as a terminal                                  | `isTerminalHost` always false                                                                                                          | failed |
| server-config › maps a terminal host to its tenant and marks it as a terminal                                  | `tenantForHost` skips `TERMINAL_HOST_MAP`                                                                                              | failed |
| server-config › maps a terminal host to its tenant and marks it as a terminal                                  | map lookups take inherited keys (`toString`)                                                                                           | failed |
| server-config › refuses to start with a host in both TENANT_HOST_MAP and TERMINAL_HOST_MAP                     | the refinement always passes                                                                                                           | failed |
| server-config › has no terminal host in production unless one is configured, and terminal.localhost elsewhere  | `terminal.localhost` in production too                                                                                                 | failed |
| server-config › has no terminal host in production unless one is configured, and terminal.localhost elsewhere  | a configured map ignored                                                                                                               | failed |
| server-config › decides by the host tenants are read from: a forwarded host counts only behind a trusted proxy | `requestHost` believes a client's `X-Forwarded-Host` (a first try, dropping `hops === 0`, was an equivalent mutation and stayed green) | failed |
| server-config › never makes a player link on a terminal host                                                   | `publicOrigin` counts terminal hosts as the tenant's                                                                                   | failed |
| server-config › never makes a player link on a terminal host                                                   | `ownedOrigin` counts terminal hosts                                                                                                    | failed |
