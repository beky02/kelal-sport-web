# F8cb — verification

## Tests proven

Each new acceptance test, once green, was run against a deliberate break and seen to fail; then the
break was undone.

- `terminal-mappers.test.ts` › "takes the kiosk's rules from retail_betting, never the online betting
  (F8cb AC-3)" — the mapper given `config.betting`: fails (with the contract-shape test).
- › "has no rules without retail_betting, even with betting (F8cb AC-b2)" — the mapper falling back to
  `config.retail_betting ?? config.betting`: fails.
