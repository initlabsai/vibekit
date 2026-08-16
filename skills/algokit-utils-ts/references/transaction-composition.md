## Transaction composition (atomic groups)

### Create a transaction group

Start composing an atomic group of transactions.

```typescript
import { AlgorandClient } from "@algorandfoundation/algokit-utils";

const algorand = AlgorandClient.defaultLocalNet();

const composer = algorand.newGroup();
```

**What just happened?** `algorand.newGroup()` created a new `TransactionComposer`
instance. Every transaction you add to this composer will be submitted as a single
atomic group — they all succeed together or all fail together.

### Add multiple transactions to a group

Combine a payment and an asset transfer into one atomic group.

```typescript
const sender = algorand.account.random();
const receiver = algorand.account.random();

const result = await algorand
  .newGroup()
  .addPayment({
    sender: sender.addr,
    receiver: receiver.addr,
    amount: (1).algo(),
  })
  .addAssetTransfer({
    sender: sender.addr,
    receiver: receiver.addr,
    assetId: 12345n,
    amount: 100n,
  })
  .send();

console.log(`Group ID: ${result.groupId}`);
console.log(`Transaction IDs: ${result.txIds.join(", ")}`);
```

**What just happened?** The `addPayment()` and `addAssetTransfer()` calls return
the composer for fluent chaining. When you call `.send()`, both transactions are
grouped, signed, and submitted atomically — the payment and asset transfer either
both confirm or both fail.

### Build and send an atomic group

Build the group to inspect transactions before sending.

```typescript
const composer = algorand
  .newGroup()
  .addPayment({
    sender: sender.addr,
    receiver: receiver.addr,
    amount: (1).algo(),
  })
  .addPayment({
    sender: sender.addr,
    receiver: receiver.addr,
    amount: (2).algo(),
  });

// Build to inspect the transactions
const built = await composer.build();
console.log(`Group contains ${built.transactions.length} transactions`);

// Then send the built group
const result = await composer.send();
console.log(`Confirmed in round: ${result.confirmations[0].confirmedRound}`);
```

**What just happened?** Calling `.build()` composes and returns the transaction
group with signers attached, letting you inspect the transactions before
committing. A subsequent `.send()` signs and submits the already-built group.

### Simulate a transaction group before sending

Dry-run a group to check for errors without spending Algo.

```typescript
const composer = algorand.newGroup().addPayment({
  sender: sender.addr,
  receiver: receiver.addr,
  amount: (5).algo(),
});

// Simulate without requiring real signatures
const simResult = await composer.simulate({ skipSignatures: true });

console.log(`Would succeed: ${simResult.confirmations.length > 0}`);
console.log(`Simulated round: ${simResult.simulateResponse.lastRound}`);
```

**What just happened?** `.simulate({ skipSignatures: true })` sends the group to
the node's simulate endpoint, which evaluates it without real signatures or
on-chain effects. The result includes a `simulateResponse` with detailed
execution info. This is useful for validating logic, checking opcode budgets, and
estimating fees before sending real transactions.

### Set fees on grouped transactions

Control fees at the per-transaction level within a group.

```typescript
const result = await algorand
  .newGroup()
  .addPayment({
    sender: sender.addr,
    receiver: receiver.addr,
    amount: (1).algo(),
    // This transaction covers extra fee for an inner transaction
    extraFee: (1000).microAlgo(),
  })
  .addPayment({
    sender: sender.addr,
    receiver: receiver.addr,
    amount: (2).algo(),
    // Cap the fee to prevent overspending
    maxFee: (3000).microAlgo(),
  })
  .send();
```

**What just happened?** Fee control is set per transaction, not per group.
`extraFee` adds to the network-suggested fee (useful when a transaction triggers
inner transactions that need fee coverage), and `maxFee` throws an error if the
calculated fee exceeds the cap — protecting you from overspending during
congestion.

### Clone a composer for reuse

Duplicate a composer so you can send the same group template multiple times.

```typescript
const template = algorand.newGroup().addPayment({
  sender: sender.addr,
  receiver: receiver.addr,
  amount: (1).algo(),
});

// Clone creates an independent copy with the same transactions
const copy = template.clone();

// Send the clone — the original is unaffected and can be cloned again
const result = await copy.send();
console.log(`Sent from clone: ${result.txIds[0]}`);
```

**What just happened?** `.clone()` creates a deep copy of the composer, including
all queued transactions. The original and the clone are fully independent — you
can modify or send one without affecting the other. This is handy for reusable
transaction templates.
