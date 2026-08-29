# Production notes

Working notes for shipping. Short, dated, deletable — resolve an item by
removing it. Rationale lives in `CONSTITUTION.md`; the release procedure lives
in `AGENTS.md`.

## Deferred

- **A Node-free keystore.** Signing requires `node` on PATH: the managed
  keystore CLI is a `#!/usr/bin/env node` program, and `npm` provisions it.
  Everything else in the binary works without Node -- chain queries, `new`,
  `init`, the Explorer -- so the toolchain-free install story holds until the
  first signature. Building a scaffolded project needs Node anyway
  (`engines: node >=24`, `puya-ts`, `tsx`, `vitest`), so this is not currently
  blocking anyone; it is a story problem more than a capability one.

  A prototype on 2026-08-27 showed it is removable. `keystore-node` is 244 KB
  of JS plus one optional native addon (`@napi-rs/keyring`, 2.9 MB), and Bun
  embeds NAPI addons in compiled binaries -- verified in isolation, then
  end to end: a compiled binary listed real OS-keychain entries with no `node`
  on PATH. Two upstream packaging details block a naive compile, neither
  fundamental:

  - `isEntryPoint()` in `dist/cli.js` compares `realpathSync(argv[1])` with its
    own module URL, which never matches inside Bun's virtual filesystem, so the
    CLI exits 0 in silence. A shim calling the exported `runCli` avoids it.
  - `createNapiKeyring` (`dist/storage/keyring.js`) loads the addon through
    `createRequire(import.meta.url)` to keep it optional, which no bundler can
    follow. A static import fixes it.

  Fold it into the existing `vibekit` binary rather than shipping a third one:
  the Bun runtime is already there, so the cost is ~3 MB, not another 83 MB.
  That would remove the npm provisioning step, the Node daemon, and the
  `node`/`npm` checks in `doctor`.

  The blocker is that this means patching a `dist/` file of someone else's
  canary on every version bump. Raise it upstream first -- `createNapiKeyring`
  is already built to be swappable for tests, so exposing that injection point
  (or using a static import) would remove the patch entirely.

- **Post-quantum accounts need one upstream change.** `vibekit keystore
  generate falcon --seed <id>` mints a real Falcon-1024 keypair that signs and
  verifies, but it is not an Algorand PQ account: it has no address and never
  appears in `keystore accounts`. The chain is not the blocker -- MainNet and
  TestNet both run algod 5.0.0 (v42), so PQ signatures are live.

  The address half is already solved. `algosdk` 3.7.0, which we already depend
  on, exports `addressFromPQKey(scheme, publicKey)`. Verified 2026-08-27
  against a hand-rolled derivation of the spec
  (<https://dev.algorand.co/concepts/accounts/post-quantum/>): both produce
  `PGABXU2A…F4D4GY` at canonical salt 0 for the same Falcon key, byte for byte.

  The gap is key derivation. The SDK derives the keypair from a 25-word
  Algorand mnemonic through `pq25WordMnemonicToSeed` --
  `SHA512-256("PQK" || scheme || entropy)` -- so the seed is domain-separated
  per scheme. `keystore-node` passes a BIP39 seed straight into Falcon
  `generateKey` with no `PQK` step and no Algo25. Same words, different key,
  different address.

  So do not reach for `addressFromPQKey` on top of today's keystore key. It
  returns a well-formed, correctly off-curve address for a key nothing else
  can reproduce from the mnemonic -- including a later keystore canary that
  adopts the spec. Funding it once PQ accounts are user-visible loses the
  funds on restore.

  The ask upstream is small: derive Falcon keys via
  `SHA512-256("PQK" || "f1" || entropy)` from an Algo25 mnemonic. `Algo25` is
  already an active shim in `keystore algorithms`, so the pieces are there and
  unwired. After that, PQ accounts are a call to a function we already ship.
  Until then, describe the capability as post-quantum *signing*, never as an
  account -- `skills/use-vibekit/references/accounts-and-signing.md` says so.

- **Agent: flipping paid turns to mainnet.** `agent.getvibekit.ai` sells
  turns in testnet USDC for the alpha (`X402_NETWORK=testnet`). Going live is
  an env change and a redeploy, nothing in code: set `X402_NETWORK=mainnet`
  (or delete it -- production defaults to mainnet), point `X402_PAY_TO` at the
  house mainnet address opted in to USDC `31566704`, leave `X402_ASSET_ID`
  empty, and delete `NEXT_PUBLIC_EXPLORER_DEFAULT_NETWORK` so the chip starts
  on mainnet. The offer's "testnet USDC" suffix and the intro's example asset
  follow the chain the route reports.

  Remove `withWalletNetwork` in `apps/agent/src/wallet/provider.tsx` at the
  same time (2026-08-28). It pins the wallet to the pack's chain for the
  seconds a payment takes so testers can `/buy` while browsing mainnet; on a
  mainnet pack it never fires, so it is dead weight, not a hazard. Deleting it
  is the hook, its one call in `useCredits.buy`, and the prop that threads it.

  Still unverified in production: the KV ledger surviving a cold start (buy,
  redeploy, check `GET /api/credits` with the bearer). Cross-device access to
  an address's turns (the bearer token is per browser) is deferred until there
  is a real session backend.

- **Agent: web search needs an Exa key in production.** `web_search` /
  `read_page` go through Exa's hosted MCP (`https://mcp.exa.ai/mcp`). Keyless
  answered a handful of calls on 2026-08-29 and then rate-limited for the day,
  so it is a demo, not a plan: create a key at https://dashboard.exa.ai/api-keys
  and set `EXA_API_KEY` (the plugin passes it as `?exaApiKey=`). Rate limits
  reach the model as `WEB_RATE_LIMITED`. The house gate allows three web calls per turn (`WEB_CALLS_PER_TURN`
  in the agent route), so one turn cannot loop searches.

- **Agent: swaps run on txnlab's free-tier key until we set our own.** The
  haystack plugin (`get_swap_quote`, `swap`) always registers; without
  `HAYSTACK_API_KEY` it uses the key txnlab publishes in the SDK README (60
  requests a minute, shared by everyone who copies it) — fine for a laptop,
  not for production: ask support@txnlab.dev for our own and set the env. `HAYSTACK_REFERRER`
  is the address that earns the referrer share of the router fee on every
  swap; the house address is
  `ST5CPUODRQLSIUIXE75GTH6YGX3L4NYHFATN4IKX7SDY3MENYIA2WXEO7A` (2026-08-29).
  Swaps are mainnet-only by construction: the plugin refuses other networks
  and the wallet is never pinned or switched for the user.

- **Agent: a credit can be lost between settlement and the ledger.** The
  facilitator settles the USDC transfer inside the same Vercel invocation that
  credits the payer; if the function dies in between, the money moved and the
  turns did not. Seen once on 2026-08-28 at the default 10s timeout (Safari:
  "Load failed" after Pera signed). `maxDuration = 60` on the credits route
  and a client that keeps its token and re-reads the balance make it rare;
  they do not make it impossible.

  Before mainnet, add `POST /api/credits/claim { txid }`: look the transaction
  up on the house's own indexer, require an asset transfer of the configured
  asset and a whole number of per-turn amounts to `X402_PAY_TO` with the
  `x402-payment-v2-` note, refuse a txid already claimed (KV `claimed:<txid>`),
  then credit the sender and bind the caller's `x-credit-token`. The receipt
  txid the wallet shows is then always enough to recover. About sixty lines
  and one test; the pieces (`ipOf`, `bindToken`, `credit`, the indexer host)
  already exist.
