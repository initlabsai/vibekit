## AlgoAmount and value handling

### Create amounts with helper functions

Use the `algo()` and `microAlgo()` shorthand functions for quick, readable amount creation.

```typescript
import { algo, microAlgo } from "@algorandfoundation/algokit-utils";

const fiveAlgo = algo(5);
const tenThousandMicroAlgo = microAlgo(10_000);

console.log(fiveAlgo.algo); // 5
console.log(fiveAlgo.microAlgo); // 5_000_000n
console.log(tenThousandMicroAlgo.algo); // 0.01
console.log(tenThousandMicroAlgo.microAlgo); // 10_000n
```

**What just happened:** You created type-safe `AlgoAmount` values using the `algo()`
and `microAlgo()` helper functions. Each `AlgoAmount` exposes both `.algo` (as a
`number`) and `.microAlgo` (as a `bigint`) so you can read the value in whichever
unit you need. The type system prevents you from accidentally mixing Algo and
microAlgo values.

### Create amounts with static constructors

Use the `AlgoAmount` class directly for a more explicit, self-documenting style.

```typescript
import { AlgoAmount } from "@algorandfoundation/algokit-utils";

const fiveAlgo = AlgoAmount.Algo(5);
const tenThousandMicroAlgo = AlgoAmount.MicroAlgo(10_000);

console.log(fiveAlgo.algo); // 5
console.log(tenThousandMicroAlgo.microAlgo); // 10_000n
```

**What just happened:** You created `AlgoAmount` instances using the static factory
methods `AlgoAmount.Algo()` and `AlgoAmount.MicroAlgo()`. These are equivalent to the
`algo()` and `microAlgo()` helpers — choose whichever style fits your codebase.

### Convert between Algo and microAlgo

Read an amount in either unit via the `.algo` and `.microAlgo` accessors.

```typescript
import { algo, microAlgo } from "@algorandfoundation/algokit-utils";

const amount = algo(1.5);
console.log(amount.algo); // 1.5
console.log(amount.microAlgo); // 1_500_000n

const small = microAlgo(500);
console.log(small.algo); // 0.0005
console.log(small.microAlgo); // 500n
```

**What just happened:** Every `AlgoAmount` stores the value once and converts on the
fly. The `.algo` getter returns a `number` (convenient for display), while `.microAlgo`
returns a `bigint` (safe for arithmetic and on-chain values where precision matters).

### Use number and bigint prototype extensions

Call `.algo()` or `.microAlgo()` directly on number and bigint literals for the most
concise syntax.

```typescript
import "@algorandfoundation/algokit-utils";

const fiveAlgo = (5).algo();
const tenMicroAlgo = (10).microAlgo();
const largeBigintAlgo = 1_000_000n.algo();
const largeBigintMicroAlgo = 1_000_000n.microAlgo();

console.log(fiveAlgo.microAlgo); // 5_000_000n
console.log(tenMicroAlgo.algo); // 0.00001
console.log(largeBigintAlgo.microAlgo); // 1_000_000_000_000n
console.log(largeBigintMicroAlgo.algo); // 1
```

**What just happened:** Importing the library augments the `Number` and `BigInt`
prototypes with `.algo()` and `.microAlgo()` methods. This lets you write amounts
inline — `(5).algo()` reads as "5 Algo". `Number` also supports the plural forms
`.algos()` and `.microAlgos()`.

### Calculate transaction fees

Use `transactionFees()` to compute the minimum fee for a given number of transactions.

```typescript
import {
  transactionFees,
  ALGORAND_MIN_TX_FEE,
} from "@algorandfoundation/algokit-utils";

const feeForThree = transactionFees(3);
console.log(feeForThree.microAlgo); // 3_000n (3 × 1_000 µALGO)

console.log(ALGORAND_MIN_TX_FEE.microAlgo); // 1_000n
```

**What just happened:** `transactionFees(n)` multiplies the Algorand minimum transaction
fee (1,000 microAlgo) by the number of transactions you pass in. This is useful when
budgeting fees for atomic groups or inner transactions. The `ALGORAND_MIN_TX_FEE`
constant is also exported if you need the single-transaction fee directly.
