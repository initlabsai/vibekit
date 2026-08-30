---
title: Run an action
description: Walk a payment from draft to confirmed with no UI, and see where the human step is.
draft: false
---

`examples/action.ts` is the action machine with nothing around it. Read it
once and the approval screens make sense.

## Set up

LocalNet and the keystore daemon, with one funded account:

```bash
vibekit localnet start
vibekit keystore start
vibekit keystore generate ed25519 --name alice
vibekit localnet fund <alice's address>
```

## Run it

```bash
SENDER=<alice's address> bun packages/vibekit/examples/action.ts
```

It prints one line per stage:

```
drafted
simulated
inspected
awaiting-approval
signed
confirmed
{ transactionId: '…', confirmedRound: 42 }
```

## What each line is

- **drafted** — `host.draft('send_payment', args)` ran the tool in compose
  mode and wrapped the unsigned group as a record. The facts an approval shows
  (sender, amount, fee) were decoded from the bytes, not copied from `args`.
- **simulated** — the exact bytes went to algod's simulate; the record says
  whether they would succeed and what they cost.
- **inspected, awaiting-approval** — the machine has everything a person
  needs and stops. This is the only place it stops.
- The line between those and **signed** is `performActionStep({ kind: 'approve' })`
  — in the example, that is you, reading the code. In an app it is a button.
- **signed** — the keystore's `TransactionSigner` signed the drafted bytes;
  `signDraftWith` refused anything else.
- **confirmed** — broadcast, and waited for a round.

## Change one thing

- A different action: replace `'send_payment'` and its args with any action
  in the [tools reference](../../reference/tools/); a swap with a router's
  pre-signed leg goes through the same stages.
- A different signer: `signDraftWith` takes any `algosdk.TransactionSigner`.
  See [swap the signer](../swap-the-signer/).
- A browser: the same machine, with the host over HTTP
  (`createRemoteActionHost`) and the wallet as the signer — that is what the
  [reference app](../../reference/examples/) does.
