## Error handling

### LogicError — catch smart contract failures

Catch AVM execution failures with structured error details including program counter and source map trace.

```python
from algokit_utils import LogicError

try:
    result = app_client.send.call(AppClientMethodCallParams(method="fail_method"))
except LogicError as e:
    print(e.transaction_id)  # The transaction ID that failed
    print(e.message)         # The error message from the AVM
    print(e.pc)              # Program counter where the error occurred
    print(e.line_no)         # Source line number (None if no source map)
    print(e.trace())         # Formatted TEAL trace around the error line
```

**What just happened:** `LogicError` is raised when AVM execution fails (e.g., an `assert` fails in your contract). It parses the raw algod error string to extract the transaction ID, error message, and program counter. When a source map is available, `trace()` returns a formatted TEAL snippet centered on the error line with an `<-- Error` marker.

### Parse a raw logic error string

Extract structured data from a raw algod error string without raising an exception.

```python
from algokit_utils import parse_logic_error

error_str = "transaction ABC123: logic eval error: assert failed. Details: pc=42"
parsed = parse_logic_error(error_str)
if parsed:
    print(parsed["transaction_id"])  # "ABC123"
    print(parsed["message"])         # "assert failed"
    print(parsed["pc"])              # 42
```

**What just happened:** `parse_logic_error` uses regex to extract `transaction_id`, `message`, and `pc` from a raw error string. Returns a `LogicErrorData` TypedDict, or `None` if the string doesn't match the expected pattern.

### TransactionComposerError — group failure details

Inspect transaction group failures with simulation traces and submitted transaction details.

```python
from algokit_utils import TransactionComposerError

try:
    result = algorand.send.payment(PaymentParams(
        sender=sender.addr,
        receiver=receiver.addr,
        amount=AlgoAmount.from_algo(100_000),
    ))
except TransactionComposerError as e:
    print(str(e))              # Human-readable error message
    print(e.traces)            # Simulation execution traces per transaction
    print(e.sent_transactions) # Transactions that were submitted
    print(e.simulate_response) # Full simulate response from algod
    print(e.__cause__)         # Original underlying exception
```

**What just happened:** `TransactionComposerError` extends `RuntimeError` and is raised when `TransactionComposer.send()` or `.simulate()` fails. The `traces` contain opcode-level execution traces from the AVM simulator, letting you see exactly what happened in each transaction of the group.

### Register a custom error transformer

Register an error transformer to intercept and rewrite errors thrown by any transaction group.

```python
from algokit_utils import AlgorandClient

algorand = AlgorandClient.default_localnet()

def my_transformer(error: Exception) -> Exception:
    if "logic eval error" in str(error):
        return RuntimeError(f"[MyApp] Contract failed: {error}")
    return error

algorand.register_error_transformer(my_transformer)

# Later, remove it
algorand.unregister_error_transformer(my_transformer)
```

**What just happened:** `register_error_transformer` adds a callable that intercepts errors during transaction composition. Transformers run sequentially — each receives the output of the previous one. A transformer must return an `Exception` instance; return the original error unchanged if it doesn't apply. `AppClient` automatically registers its own transformer to enrich errors with source map traces.
