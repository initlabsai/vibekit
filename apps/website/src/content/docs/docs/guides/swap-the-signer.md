---
title: Swap the signer
description: The keystore, a wallet, a mnemonic, or a hardware device — one interface, two sockets.
draft: false
---

A signer is an `algosdk.TransactionSigner`: `(txns, indexes) => Promise<Uint8Array[]>`.
It plugs in at one of two places, and the deployment decides which.

**Server side, `mode: 'execute'`** — tools sign inside the process:

```ts
resolveSigner: async (address) => signer   // keystore daemon, KMD, a mnemonic, your HSM
```

Example: [`examples/signer.ts`](https://github.com/initlabsai/vibekit/blob/main/packages/vibekit/examples/signer.ts).
The keystore daemon (`createKeystoreSigner`) is one such signer.

**Client side, `mode: 'compose'`** — tools return a draft; a wallet signs after
a human approves:

```ts
import { createWalletSignDraft } from '@initlabs/vibekit/actions'
signDraft: createWalletSignDraft({ network, walletNetwork: () => wallet.activeNetwork, signer: wallet.transactionSigner, record })
```

`record` turns the signed bytes into the signed record — a server route that
verifies them, or `signedGroupRecordFor` in-process. Only the legs the draft
leaves to the wallet are offered to it; a router's pre-signed legs are spliced
back in place.

Example of the whole action, no UI:
[`packages/vibekit/examples/action.ts`](https://github.com/initlabsai/vibekit/blob/main/packages/vibekit/examples/action.ts).
