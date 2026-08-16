## Payment transactions

### Send a simple payment

Transfer Algo from one account to another.

```typescript
import { AlgorandClient } from "@algorandfoundation/algokit-utils";

const algorand = AlgorandClient.defaultLocalNet();

const sender = algorand.account.random();
const receiver = algorand.account.random();

const result = await algorand.send.payment({
  sender: sender.addr,
  receiver: receiver.addr,
  amount: (1).algo(),
});

console.log(`Transaction ID: ${result.txIds[0]}`);
```

**What just happened?** `algorand.send.payment()` built, signed, and submitted a
payment transaction that transfers 1 Algo from `sender` to `receiver`. The
returned `result` contains the transaction ID and the confirmation details.

### Create an unsigned payment

Build a payment transaction without signing or sending it.

```typescript
const txn = await algorand.createTransaction.payment({
  sender: sender.addr,
  receiver: receiver.addr,
  amount: (2).algo(),
});

console.log(`Unsigned transaction type: ${txn.type}`);
```

**What just happened?** `algorand.createTransaction.payment()` returned a raw
`Transaction` object you can inspect, serialize, or sign manually. Nothing was
sent to the network.

### Send a payment with a note

Attach arbitrary data to a payment using the `note` field.

```typescript
const result = await algorand.send.payment({
  sender: sender.addr,
  receiver: receiver.addr,
  amount: (0.5).algo(),
  note: "Hello from AlgoKit!",
});
```

**What just happened?** The `note` field accepts a `string` or `Uint8Array`
(max 1 000 bytes). The note is stored on-chain and visible to anyone inspecting
the transaction.

### Send a payment with a lease

Prevent duplicate transactions within a validity window using a lease.

```typescript
const result = await algorand.send.payment({
  sender: sender.addr,
  receiver: receiver.addr,
  amount: (1).algo(),
  lease: "unique-invoice-001",
});
```

**What just happened?** The `lease` field ensures that only one transaction with
this lease value from the same sender can be confirmed within the validity
window. This is useful for preventing accidental double-payments.

### Send a payment with explicit fee control

Override the suggested fee or cap the maximum fee you are willing to pay.

```typescript
// Set a static fee (replaces the suggested fee entirely)
const result1 = await algorand.send.payment({
  sender: sender.addr,
  receiver: receiver.addr,
  amount: (1).algo(),
  staticFee: (2000).microAlgo(),
});

// Add an extra fee on top of the suggested fee (useful for covering inner txn fees)
const result2 = await algorand.send.payment({
  sender: sender.addr,
  receiver: receiver.addr,
  amount: (1).algo(),
  extraFee: (1000).microAlgo(),
});

// Cap the fee to prevent overspending during congestion
const result3 = await algorand.send.payment({
  sender: sender.addr,
  receiver: receiver.addr,
  amount: (1).algo(),
  maxFee: (3000).microAlgo(),
});
```

**What just happened?** `staticFee` sets an exact fee, `extraFee` adds to the
network-suggested fee (handy when your outer transaction must cover fees for
inner transactions), and `maxFee` throws an error if the calculated fee exceeds
the specified cap — protecting you from overspending during high-congestion
periods.
