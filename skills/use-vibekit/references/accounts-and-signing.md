# Accounts and signing

Use this guide when a task needs an account, signer, or key-management action.

## Account model

Keys live in the OS keychain behind the managed keystore daemon. The VibeKit
server does not hold raw key material, and agents never need a mnemonic.

- **List accounts:** call `list_signing_addresses`. Pass
  `{"includeBalances": true}` when balances help choose a sender.
- **Create an account:** call `create_signing_account` with an optional `name`.
  The key is generated inside the daemon and remains unextractable.
- **Choose a sender:** remember the user's selected address in the current
  conversation and pass it explicitly to every write.
- **Delete an account:** hand `vibekit keystore remove <address|name>` to the
  user. Removal is human-only and can make funds permanently inaccessible.

Labels are fixed at creation; do not promise a rename operation.

## Key derivation and post-quantum keys

The daemon is the Algorand Foundation's general-purpose keystore, reached
through `vibekit keystore <cmd>` — every subcommand except `start`, `stop`,
`status`, `generate`, `accounts`, and `remove` is passed straight to it.
`vibekit keystore algorithms` lists its capabilities, which include encryption
and mnemonic encodings, not only signature schemes. Do not pick a scheme from
that list; Algorand accounts are Ed25519.

```bash
vibekit keystore generate seed    [--name <label>]  # BIP39; PRINTS PHRASE ONCE
vibekit keystore generate root    --seed <id>        # BIP32-Ed25519 root
vibekit keystore generate account --root <id>        # next Ed25519 account
vibekit keystore generate ed25519 [--name <label>]   # standalone Ed25519
vibekit keystore generate falcon  --seed <id>        # Falcon-1024 keypair
```

**Never run `generate seed` on the user's behalf without saying so first, and
never echo, log, or screenshot the phrase.** Prefer an existing seed: find it
with `vibekit keystore list` and pass its id.

`generate falcon` produces a real Falcon-1024 keypair that signs and verifies
(compressed, variable-length signatures around 1.2 KB against Ed25519's 64
bytes). It is **not** an Algorand post-quantum account, and must not be
described as one:

- it has a key id but no address — it never appears in `keystore accounts` or
  `list_signing_addresses`, so it cannot hold or send anything;
- the keystore implements none of the account derivation from
  <https://dev.algorand.co/concepts/accounts/post-quantum/> — no
  `SHA512-256("PQK" || scheme || entropy)` seed step, no canonical-salt search
  for an off-curve address, no `SHA512-256("PQA" || scheme || salt || pubkey)`
  address. Without the `PQK` step the same mnemonic yields a different keypair
  here than in a spec-compliant wallet, so these keys are not portable;
- post-quantum signatures are live: MainNet and TestNet both run algod
  5.0.0, which carries the v42 consensus upgrade. The chain is not the
  blocker; the derivation below is.

**Do not derive an address for it yourself.** `algosdk` 3.7.0 exports
`addressFromPQKey(scheme, publicKey)`, and it will happily return a
well-formed address for a keystore Falcon key — verified byte-identical to a
hand-rolled derivation of the spec. That address is a trap: the SDK derives
the *keypair* from a 25-word Algorand mnemonic through
`pq25WordMnemonicToSeed` (the `PQK` step), while the keystore derives it
straight from a BIP39 seed. Same words, different key, different address. An
account funded at such an address would not be recoverable from the mnemonic
in any other wallet.

Treat it as post-quantum signing available in the keystore today, and say so
in those words.

## Daemon lifecycle

The MCP server and `vibekit explore` start the daemon in the background when it
is not running; `vibekit keystore stop` stops one they (or `start`) started.

```bash
vibekit keystore start       # managed background daemon
vibekit keystore stop
vibekit keystore status
vibekit keystore serve       # foreground daemon for debugging
vibekit keystore accounts    # signing addresses and labels
```

Prefer the agent-facing account tools over raw keystore commands. Mnemonic and
seed generation, import, and export remain human-only because their output must
never enter model context.

## Signing modes

- **Execute mode:** the daemon signs and submits write groups. Tools return
  transaction IDs and confirmation data.
- **Compose mode:** actions return `unsignedGroup` entries as base64 for an
  external signer.

If the user expects execution but only compose results are available, have
them start the daemon and restart the MCP server or agent session.

An account created through a raw keystore command may not appear in an already
running daemon until it restarts. `create_signing_account` avoids that stale
process boundary.
