## AlgoAmount and value handling

### Create amounts with helper functions

Use the `algo()` and `micro_algo()` shorthand functions for quick, readable amount creation.

```python
from algokit_utils import algo, micro_algo

five_algo = algo(5)
ten_thousand_micro_algo = micro_algo(10_000)

print(five_algo.algo)                    # Decimal('5')
print(five_algo.micro_algo)              # 5_000_000
print(ten_thousand_micro_algo.algo)      # Decimal('0.01')
print(ten_thousand_micro_algo.micro_algo)  # 10_000
```

**What just happened:** You created type-safe `AlgoAmount` values using the `algo()` and `micro_algo()` helper functions. Each `AlgoAmount` exposes both `.algo` (as a `Decimal`) and `.micro_algo` (as an `int`) so you can read the value in whichever unit you need. The type system prevents you from accidentally mixing Algo and microAlgo values.

### Create amounts with static constructors

Use the `AlgoAmount` class directly for a more explicit, self-documenting style.

```python
from algokit_utils import AlgoAmount

five_algo = AlgoAmount.from_algo(5)
ten_thousand_micro_algo = AlgoAmount.from_micro_algo(10_000)

print(five_algo.algo)                    # Decimal('5')
print(ten_thousand_micro_algo.micro_algo)  # 10_000
```

**What just happened:** You created `AlgoAmount` instances using the static factory methods `AlgoAmount.from_algo()` and `AlgoAmount.from_micro_algo()`. These are equivalent to the `algo()` and `micro_algo()` helpers — choose whichever style fits your codebase.

### Convert between Algo and microAlgo

Read an amount in either unit via the `.algo` and `.micro_algo` properties.

```python
from algokit_utils import algo, micro_algo

amount = algo(1)
print(amount.algo)        # Decimal('1')
print(amount.micro_algo)  # 1_000_000

small = micro_algo(500)
print(small.algo)        # Decimal('0.0005')
print(small.micro_algo)  # 500
```

**What just happened:** Every `AlgoAmount` stores the value once and converts on the fly. The `.algo` property returns a `Decimal` (safe for precise arithmetic and display), while `.micro_algo` returns an `int` (the native on-chain unit).

### Calculate transaction fees

Use `transaction_fees()` to compute the minimum fee for a given number of transactions.

```python
from algokit_utils import transaction_fees, ALGORAND_MIN_TX_FEE

fee_for_three = transaction_fees(3)
print(fee_for_three.micro_algo)  # 3_000 (3 × 1_000 µAlgo)

print(ALGORAND_MIN_TX_FEE.micro_algo)  # 1_000
```

**What just happened:** `transaction_fees(n)` multiplies the Algorand minimum transaction fee (1,000 microAlgo) by the number of transactions you pass in. This is useful when budgeting fees for atomic groups or inner transactions. The `ALGORAND_MIN_TX_FEE` constant is also exported if you need the single-transaction fee directly.
