# Using x402-avm Python Core and AVM Mechanism

Use the x402-avm Python package core components and AVM mechanism directly for building custom payment integrations on Algorand.

## Prerequisites

Before using this skill, ensure:

1. **Python 3.10+** is installed
2. **x402-avm package** is available: `pip install "x402-avm[avm]"`
3. **Understanding of x402 payment flow** -- client sends payment, server returns 402, facilitator verifies/settles

## Core Architecture

The x402-avm Python SDK has two layers:

```
x402-avm Core                          AVM Mechanism
+----------------------------------+   +----------------------------------+
| x402Client / x402ClientSync      |   | ClientAvmSigner (Protocol)       |
| x402ResourceServer / ...Sync     |   | FacilitatorAvmSigner (Protocol)  |
| x402Facilitator / ...Sync        |   | ExactAvmScheme                   |
| schemas, types                   |   | constants, utils                 |
+----------------------------------+   +----------------------------------+
         |                                        |
         +--- register_exact_avm_* ---------------+
```

## How to Proceed

### Step 1: Install the Package

```bash
# Core + AVM mechanism
pip install "x402-avm[avm]"

# With a web framework
pip install "x402-avm[fastapi,avm]"
pip install "x402-avm[flask,avm]"
```

### Step 2: Understand the Signer Protocols

The SDK defines signer protocols (structural typing -- no inheritance required) that separate protocol definitions from implementations.

**ClientAvmSigner** -- for clients making payments:

```python
from x402.mechanisms.avm.signer import ClientAvmSigner

class ClientAvmSigner(Protocol):
    @property
    def address(self) -> str:
        """58-character Algorand address."""
        ...

    def sign_transactions(
        self,
        unsigned_txns: list[bytes],
        indexes_to_sign: list[int],
    ) -> list[bytes | None]:
        """Sign specified transactions in a group."""
        ...
```

**FacilitatorAvmSigner** -- for facilitators verifying/settling payments:

```python
from x402.mechanisms.avm.signer import FacilitatorAvmSigner

class FacilitatorAvmSigner(Protocol):
    def get_addresses(self) -> list[str]: ...
    def sign_transaction(self, txn_bytes: bytes, fee_payer: str, network: str) -> bytes: ...
    def sign_group(self, group_bytes: list[bytes], fee_payer: str, indexes_to_sign: list[int], network: str) -> list[bytes]: ...
    def simulate_group(self, group_bytes: list[bytes], network: str) -> None: ...
    def send_group(self, group_bytes: list[bytes], network: str) -> str: ...
    def confirm_transaction(self, txid: str, network: str, rounds: int = 4) -> None: ...
```

### Step 3: Use Constants

```python
from x402.mechanisms.avm.constants import (
    ALGORAND_TESTNET_CAIP2,     # "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
    ALGORAND_MAINNET_CAIP2,     # "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="
    USDC_TESTNET_ASA_ID,        # 10458941
    USDC_MAINNET_ASA_ID,        # 31566704
    MIN_TXN_FEE,                # 1000
    MAX_GROUP_SIZE,             # 16
    NETWORK_CONFIGS,
)
```

### Step 4: Use Utility Functions

```python
from x402.mechanisms.avm.utils import (
    is_valid_address,
    to_atomic_amount,
    from_atomic_amount,
    decode_transaction_bytes,
    normalize_network,
    get_usdc_asa_id,
)

# Validate address
is_valid_address("AAAA...")  # True/False

# Convert amounts
to_atomic_amount(1.50)     # 1500000
from_atomic_amount(100000) # 0.1

# Decode transactions
info = decode_transaction_bytes(raw_txn_bytes)
print(info.type, info.sender, info.fee, info.is_signed)
```

### Step 5: Register Schemes

```python
from x402 import x402Client
from x402.mechanisms.avm.exact import register_exact_avm_client

client = x402Client()
register_exact_avm_client(client, signer)

# Now client.fetch() handles 402 responses automatically
response = await client.fetch("https://api.example.com/paid-resource")
```

### Step 6: Understand Fee Abstraction

Fee abstraction uses Algorand's atomic transaction groups and pooled fees:

```
Transaction 0: USDC transfer (client -> resource owner, fee = 0)
Transaction 1: Self-payment (fee payer -> fee payer, fee covers both txns)

Client signs Txn 0, Facilitator signs Txn 1
Both execute atomically (all-or-nothing)
```

## Important Rules / Guidelines

1. **Signer separation** -- Protocol definitions live in the SDK (`signer.py`), implementations live in examples. Zero algosdk imports in SDK core.
2. **First-class AVM** -- AVM is treated identically to EVM/SVM. Never conditional, always registered unconditionally.
3. **algosdk encoding boundaries** -- `msgpack_decode()` expects base64 string. `msgpack_encode()` returns base64 string. The SDK protocol passes raw msgpack bytes between methods. Convert at boundaries.
4. **Import constants from SDK** -- Use `ALGORAND_TESTNET_CAIP2` from imports, not hardcoded strings, in SDK code.
5. **Raw bytes contract** -- The x402 SDK passes raw msgpack bytes between signer methods. This matches the @txnlab/use-wallet ecosystem standard.

## Common Errors / Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `ImportError: x402.mechanisms.avm` | Missing `[avm]` extra | Install with `pip install "x402-avm[avm]"` |
| `msgpack_decode expects string` | Passing raw bytes | Wrap: `base64.b64encode(raw).decode()` |
| `Invalid address` | Wrong address format | Must be 58-character Algorand address |
| `to_atomic_amount overflow` | Value too large | Check decimal places (6 for USDC/ALGO) |
| `Network not supported` | Unregistered network | Register with `register_exact_avm_*` first |

## References / Further Reading

- [use-python-x402-core-avm-reference.md](./use-python-x402-core-avm-reference.md) -- Detailed API reference for all exports
- [use-python-x402-core-avm-examples.md](./use-python-x402-core-avm-examples.md) -- Complete code examples
- [x402-avm AVM Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
