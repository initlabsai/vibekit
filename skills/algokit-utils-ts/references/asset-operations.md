## Asset operations

### Create a new asset

Mint a new Algorand Standard Asset (ASA) with full configuration.

```typescript
import { AlgorandClient } from "@algorandfoundation/algokit-utils";

const algorand = AlgorandClient.defaultLocalNet();

const creator = algorand.account.random();

const result = await algorand.send.assetCreate({
  sender: creator.addr,
  total: 1_000_000n,
  decimals: 6,
  assetName: "AlgoKit Gold",
  unitName: "AGOLD",
  url: "https://example.com/agold",
  manager: creator.addr,
  reserve: creator.addr,
  freeze: creator.addr,
  clawback: creator.addr,
  defaultFrozen: false,
});

const assetId = result.assetId;
console.log(`Created asset ${assetId}`);
```

**What just happened?** `algorand.send.assetCreate()` built, signed, and submitted
an asset-creation transaction. The returned `result` includes the new `assetId`
alongside the usual transaction confirmation. The four role addresses (`manager`,
`reserve`, `freeze`, `clawback`) control post-creation management — omit any of
them to permanently lock that capability.

### Opt in to an asset

An account must opt in before it can receive a non-Algo asset.

```typescript
const receiver = algorand.account.random();

await algorand.send.assetOptIn({
  sender: receiver.addr,
  assetId,
});
```

**What just happened?** `assetOptIn` sends a zero-amount asset transfer from the
account to itself, which is how Algorand records "this account is willing to hold
this asset". Until an account opts in, any transfer to it will fail.

### Transfer an asset

Move ASA units between two opted-in accounts.

```typescript
await algorand.send.assetTransfer({
  sender: creator.addr,
  receiver: receiver.addr,
  assetId,
  amount: 100n,
});
```

**What just happened?** 100 base units of the asset were transferred from `creator`
to `receiver`. Because the asset has 6 decimals, this represents 0.000100 of the
display unit.

### Opt out of an asset

Close out an asset holding by returning remaining units to the asset creator.

```typescript
await algorand.send.assetOptOut({
  sender: receiver.addr,
  assetId,
  creator: creator.addr,
  ensureZeroBalance: true,
});
```

**What just happened?** `assetOptOut` removes the asset holding from the account
and sends any remaining balance to the `creator` address. Setting
`ensureZeroBalance: true` makes the call throw if the account still holds a
non-zero balance — protecting against accidental asset loss. If you omit
`creator`, it will be looked up from algod automatically.

### Freeze and unfreeze an asset

The freeze-role account can toggle an account's ability to transact a specific asset.

```typescript
// Freeze the receiver's holding
await algorand.send.assetFreeze({
  sender: creator.addr,
  assetId,
  freezeTarget: receiver.addr,
  frozen: true,
});

// Unfreeze it later
await algorand.send.assetFreeze({
  sender: creator.addr,
  assetId,
  freezeTarget: receiver.addr,
  frozen: false,
});
```

**What just happened?** The `freeze`-role account toggled the `frozen` flag on
`receiver`'s holding. While frozen, the target account cannot send or receive that
asset. Only the address assigned as the `freeze` role during asset creation (or
reconfiguration) can issue this transaction.

### Configure (reconfigure) an asset

Update the management addresses of an existing asset.

```typescript
const newManager = algorand.account.random();

await algorand.send.assetConfig({
  sender: creator.addr,
  assetId,
  manager: newManager.addr,
  reserve: creator.addr,
  freeze: creator.addr,
  clawback: creator.addr,
});
```

**What just happened?** `assetConfig` updated the asset's manager address to a new
account. All four role addresses must be supplied in a config transaction — any
address you omit will be permanently cleared, irrevocably removing that
capability. Only the current `manager` can submit this transaction.

### Destroy an asset

Permanently delete an asset once all units have been returned to the creator.

```typescript
await algorand.send.assetDestroy({
  sender: creator.addr,
  assetId,
});
```

**What just happened?** `assetDestroy` removed the asset from the ledger entirely.
This is only possible when the creator holds all issued units (i.e. the full
`total` supply). Only the `manager`-role account can destroy the asset.

### Bulk opt in to multiple assets

Opt a single account in to several assets at once.

```typescript
const assets = [assetIdA, assetIdB, assetIdC];

const results = await algorand.asset.bulkOptIn(account.addr, assets);

console.log(`Opted in to ${results.length} assets`);
results.forEach((r) =>
  console.log(`  Asset ${r.assetId}: txn ${r.transactionId}`),
);
```

**What just happened?** `algorand.asset.bulkOptIn()` batches opt-in transactions
into atomic groups of up to 16 and sends them sequentially. Each entry in the
returned array contains the `assetId` and `transactionId` for the opt-in.

### Bulk opt out of multiple assets

Remove multiple asset holdings in a single call.

```typescript
const results = await algorand.asset.bulkOptOut(account.addr, assets);

console.log(`Opted out of ${results.length} assets`);
```

**What just happened?** `bulkOptOut` works like `bulkOptIn` but in reverse — it
closes each asset holding and sends remaining balances to the respective asset
creators. By default it checks for zero balances before opting out; pass
`{ ensureZeroBalance: false }` in the third argument to skip this check (any
remaining units will be forfeited to the creator).

### Get asset information

Look up the current on-chain parameters for an asset.

```typescript
const info = await algorand.asset.getById(assetId);

console.log(`Asset name: ${info.assetName}`);
console.log(`Total supply: ${info.total}`);
console.log(`Decimals: ${info.decimals}`);
console.log(`Creator: ${info.creator}`);
console.log(`Manager: ${info.manager}`);
```

**What just happened?** `algorand.asset.getById()` fetched the asset's current
parameters from algod — including supply, decimals, name, URL, and all four role
addresses. This is useful for verifying asset configuration or displaying metadata.
