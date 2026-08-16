# Common LLM Mistakes

Anti-patterns that LLMs consistently get wrong when writing Algorand smart contracts.

## 1. Defaulting to PyTEAL, Beaker, or Raw TEAL

**Wrong:**

```python
from pyteal import *
approval_program = Approve()
```

**Right:**

```python
from algopy import ARC4Contract, arc4

class MyContract(ARC4Contract):
    @arc4.abimethod
    def hello(self, name: arc4.String) -> arc4.String:
        return "Hello, " + name
```

## 2. Treating Contract Code as Normal TypeScript/Python

**Wrong:**

```typescript
export class MyContract extends Contract {
  private data: Map<string, number> = new Map(); // No Map, no number
  public async processData(): Promise<void> {
    // No async, no Promise
    try {
      const result = JSON.parse(input);
    } catch (e) {
      // No JSON, no try/catch
      console.log(e);
    } // No console
  }
}
```

**Right:**

```typescript
export class MyContract extends Contract {
  data = BoxMap<string, uint64>({ keyPrefix: "d" });

  public processData(input: uint64): void {
    assert(input > Uint64(0));
    this.data("key").value = input;
  }
}
```

**Why:** Contract files compile to AVM bytecode. Only a strict subset of the language is available.

## 3. Ignoring Opcode Budget

**Wrong:**

```python
@arc4.abimethod
def process_all(self) -> None:
    for i in urange(100):  # Can easily exceed 700 opcode budget
        self.expensive_operation(i)
```

**Right:**

```python
@arc4.abimethod
def process_batch(self, start: UInt64, count: UInt64) -> None:
    end = start + count
    assert end <= UInt64(100)
    for i in urange(start, end):
        self.do_work(i)
```

**Why:** Each app call gets 700 budget (poolable to 11,200). Split work into batches or add extra app calls.

## 4. Exceeding State Limits

**Wrong:**

```typescript
export class MyContract extends Contract {
  // 100 global state keys — limit is 64
  key1 = GlobalState<uint64>({ key: "k1" });
  // ... 99 more
}
```

**Right:**

```typescript
export class MyContract extends Contract {
  records = BoxMap<uint64, RecordData>({ keyPrefix: "r" }); // Unlimited via MBR
  owner = GlobalState<Account>({ key: "owner" }); // GlobalState for config
}
```

**Why:** Global state: max 64 keys, values ≤ 128 bytes. Use Box storage for larger datasets.

## 5. Forgetting Box MBR Funding

The contract code is the same — the key is **client-side funding**:

```python
# Client: fund app account BEFORE creating boxes
algorand.send.payment(PaymentParams(
    sender=deployer.address,
    receiver=app_client.app_address,
    amount=AlgoAmount(algo=1),
))
# Now box creation works
app_client.send.create_record(key="mykey", data=b"mydata")
```

**Why:** Box MBR is `2,500 + 400 × (key_length + value_length)` µAlgo per box. The app account must be funded first.

## 6. Using JavaScript/Python Number Types

**Wrong:**

```typescript
// .algo.ts file
public calculate(a: number, b: number): number { return a + b }
```

**Right:**

```typescript
public calculate(a: uint64, b: uint64): uint64 { return a + b }
```

**Why:** The AVM only has `uint64` and `bytes`. Use `uint64`/`UInt64`, not `number`/`int`.

## 7. Reference Semantics Instead of Value Semantics (TypeScript)

**Wrong:**

```typescript
public updateField(newValue: uint64): void {
  const current = this.data.value   // Gets a COPY, not a reference
  current.field = newValue          // Modifies the copy — state NOT updated
}
```

**Right:**

```typescript
public updateField(newValue: uint64): void {
  const copy = clone(this.data.value)  // Clone to get a mutable copy
  copy.field = newValue
  this.data.value = copy               // Write back the modified copy
}
```

**Why:** Algorand TypeScript uses value semantics. Complex types are byte-encoded values, not heap objects. `clone()`, mutate, then write back. Python handles this more naturally.

## 8. Not Accounting for Resource Availability

**Wrong:**

```typescript
// Contract uses asset and account, but client doesn't declare them
public transferAsset(asset: Asset, to: Account, amount: uint64): void {
  itxn.assetTransfer({ xferAsset: asset, assetReceiver: to, assetAmount: amount, fee: Uint64(0) }).submit()
}
```

**Right:**

```typescript
// AlgoKit typed clients handle foreign references automatically
await client.send.transferAsset({
  args: { asset: assetId, to: recipientAddr, amount: 100n },
  coverAppCallInnerTransactionFees: true,
});
```

**Why:** The AVM requires accessed accounts, assets, apps, and boxes in the transaction's foreign arrays. `MaxAppTotalTxnReferences = 8` means the **combined total across all reference types is 8**, not 8 of each. AlgoKit typed clients resolve this automatically. In AVM v12+, the `txn.Access` list supports up to 16 entries.

## 9. Oversized Programs Without Extra Pages

**Right:**

```python
# Option 1: Request extra pages at deployment (up to 3, for max 8192 bytes)
# Option 2: Split into multiple contracts communicating via inner transactions
class CoreContract(ARC4Contract):
    # Core logic

class HelperContract(ARC4Contract):
    # Called via inner transactions from CoreContract
```

**Why:** Default program size is 2048 bytes. Extra pages extend to 8192 max but increase MBR.

## 10. Mixing On-Chain and Off-Chain Code

**Wrong:**

```typescript
// .algo.ts — cannot import npm packages or make HTTP requests
import axios from "axios";
export class MyContract extends Contract {
  public fetchPrice(): uint64 {
    /* impossible */
  }
}
```

**Right:**

```typescript
// .algo.ts — on-chain: accept data from trusted oracle
export class MyContract extends Contract {
  price = GlobalState<uint64>({ key: "price" });
  oracle = GlobalState<Account>({ key: "oracle" });

  public updatePrice(newPrice: uint64): void {
    assert(Txn.sender === this.oracle.value);
    this.price.value = newPrice;
  }
}

// scripts/update-price.ts — off-chain: fetch and submit
const response = await axios.get("https://api.example.com/price");
await client.send.updatePrice({
  args: { newPrice: BigInt(response.data.price) },
});
```

**Why:** Contracts execute on-chain — no internet, no filesystem. Use an oracle pattern.

