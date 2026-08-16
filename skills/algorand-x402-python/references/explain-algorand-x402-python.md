# x402-avm Python Package for Algorand

The `x402-avm` Python package provides Algorand (AVM) payment protocol support through a modular extras system, Protocol-based signer interfaces, and async/sync variants for every component.

## Prerequisites

Before using this skill, ensure:

1. **Python 3.10+** is installed
2. **pip** is available for package installation
3. **Understanding of x402 protocol** -- client sends request, gets 402, creates payment, retries with payment header

## Core Concept: Extras-Based Installation

The `x402-avm` package uses pip extras to install only what you need. The package name on PyPI is `x402-avm` but all imports use `from x402...` (not `from x402...`).

```bash
# Minimal AVM support
pip install "x402-avm[avm]"

# Server frameworks
pip install "x402-avm[fastapi,avm]"
pip install "x402-avm[flask,avm]"

# HTTP clients
pip install "x402-avm[httpx,avm]"
pip install "x402-avm[requests,avm]"

# Everything
pip install "x402-avm[avm,httpx,requests]"
```

## Core Workflow: Signer Protocol Pattern

The key insight is that x402 defines **Protocol classes** (structural typing) for signers. Your implementation does not need to inherit -- it just needs matching methods.

```
Private Key (env var)
        |
        v
Signer Implementation (satisfies Protocol)
        |
        v
register_exact_avm_client(x402_client, signer)
        |
        v
HTTP Client (httpx or requests) handles 402 automatically
```

## How to Proceed

### Step 1: Choose Your Extras

| Use Case | Install Command |
|----------|----------------|
| Client with httpx (async) | `pip install "x402-avm[httpx,avm]"` |
| Client with requests (sync) | `pip install "x402-avm[requests,avm]"` |
| Server with FastAPI (async) | `pip install "x402-avm[fastapi,avm]"` |
| Server with Flask (sync) | `pip install "x402-avm[flask,avm]"` |
| Facilitator service | `pip install "x402-avm[fastapi,avm]"` or `"x402-avm[flask,avm]"` |
| Full installation | `pip install "x402-avm[avm,httpx,requests]"` |

### Step 2: Understand Async vs Sync Variants

Every core class has both async and sync variants. Using the wrong variant causes runtime errors.

| Component | Async (FastAPI/httpx) | Sync (Flask/requests) |
|-----------|----------------------|----------------------|
| x402 Client | `x402Client` | `x402ClientSync` |
| Resource Server | `x402ResourceServer` | `x402ResourceServerSync` |
| Facilitator Client | `HTTPFacilitatorClient` | `HTTPFacilitatorClientSync` |
| HTTP Resource Server | `x402HTTPResourceServer` | `x402HTTPResourceServerSync` |

### Step 3: Implement a Signer

For clients, implement `ClientAvmSigner`:

```python
from x402.mechanisms.avm.signer import ClientAvmSigner

# Protocol -- just match this shape:
class ClientAvmSigner(Protocol):
    @property
    def address(self) -> str: ...
    def sign_transactions(self, unsigned_txns: list[bytes], indexes_to_sign: list[int]) -> list[bytes | None]: ...
```

For facilitators, implement `FacilitatorAvmSigner`:

```python
from x402.mechanisms.avm.signer import FacilitatorAvmSigner

# Protocol -- match this shape:
class FacilitatorAvmSigner(Protocol):
    def get_addresses(self) -> list[str]: ...
    def sign_transaction(self, txn_bytes: bytes, fee_payer: str, network: str) -> bytes: ...
    def sign_group(self, group_bytes: list[bytes], fee_payer: str, indexes_to_sign: list[int], network: str) -> list[bytes]: ...
    def simulate_group(self, group_bytes: list[bytes], network: str) -> None: ...
    def send_group(self, group_bytes: list[bytes], network: str) -> str: ...
    def confirm_transaction(self, txid: str, network: str, rounds: int = 4) -> None: ...
```

### Step 4: Handle algosdk Encoding Boundaries

This is the most common source of bugs. The x402 SDK passes **raw msgpack bytes** between methods, but Python algosdk (v2.11.1) works with **base64 strings**:

| Operation | Python algosdk Expects/Returns |
|-----------|-------------------------------|
| `msgpack_decode(s)` | Expects **base64 string** |
| `msgpack_encode(obj)` | Returns **base64 string** |
| `Transaction.sign(key)` | Expects **base64 string** key |

Boundary conversion:

```python
import base64
from algosdk import encoding

# Raw bytes -> algosdk object (DECODE)
b64_string = base64.b64encode(raw_bytes).decode("utf-8")
txn_obj = encoding.msgpack_decode(b64_string)

# algosdk object -> raw bytes (ENCODE)
b64_string = encoding.msgpack_encode(txn_obj)
raw_bytes = base64.b64decode(b64_string)
```

### Step 5: Register and Use

```python
from x402 import x402Client
from x402.mechanisms.avm.exact import register_exact_avm_client

signer = MyClientSigner(os.environ["AVM_PRIVATE_KEY"])
client = x402Client()
register_exact_avm_client(client, signer)
# Now use with httpx or requests client wrappers
```

## Important Rules / Guidelines

1. **Always use base64 boundaries** -- `msgpack_decode` expects base64 string, not raw bytes
2. **Match async/sync variants** -- FastAPI uses `x402Client`, Flask uses `x402ClientSync`
3. **Private key format** -- `AVM_PRIVATE_KEY` is Base64-encoded 64 bytes (32-byte seed + 32-byte pubkey)
4. **Address derivation** -- `encode_address(secret_key[32:])` extracts address from public key portion
5. **Import as x402** -- install as `x402-avm` but import as `from x402...`
6. **Protocol typing** -- no inheritance needed, just match the method signatures

## Common Errors / Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `TypeError: a bytes-like object is required` | Passed raw bytes to `msgpack_decode` | Convert to base64 string first: `base64.b64encode(raw).decode()` |
| `TypeError: expected str, got bytes` | `msgpack_encode` returns base64 string, not bytes | Use `base64.b64decode(result)` to get raw bytes |
| `Invalid key length: expected 64` | Wrong key format | Ensure `AVM_PRIVATE_KEY` is Base64-encoded 64-byte key |
| `TypeError: x402HTTPAdapter requires sync client` | Used `x402Client` with requests | Use `x402ClientSync` for requests (sync) |
| `ImportError: AVM mechanism requires...` | Missing `py-algorand-sdk` | `pip install "x402-avm[avm]"` |
| `ModuleNotFoundError: x402_avm` | Wrong import name | Import as `from x402...` not `from x402...` |
| `Simulation failed: ...` | Transaction group invalid | Check group ID assignment, fee calculations, asset opt-in |

## References / Further Reading

- [explain-algorand-x402-python-reference.md](./explain-algorand-x402-python-reference.md) - Detailed API reference for all Python components
- [explain-algorand-x402-python-examples.md](./explain-algorand-x402-python-examples.md) - Complete code examples
- [x402-avm on PyPI](https://pypi.org/project/x402-avm/)
- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402 Algorand Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
