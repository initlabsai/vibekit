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

## Daemon lifecycle

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
- **Compose mode:** write tools return `unsignedGroup` entries as base64 for an
  external signer.

If the user expects execution but only compose results are available, have
them start the daemon and restart the MCP server or agent session.

An account created through a raw keystore command may not appear in an already
running daemon until it restarts. `create_signing_account` avoids that stale
process boundary.
