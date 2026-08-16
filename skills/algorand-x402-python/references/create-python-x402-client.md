# Creating x402 HTTP Clients in Python

Build Python HTTP clients with httpx (async) or requests (sync) that automatically detect 402 Payment Required responses, create Algorand USDC payment transactions, and retry with payment headers.

## Prerequisites

Before using this skill, ensure:

1. **Python 3.10+** is installed
2. **An Algorand private key** -- Base64-encoded 64-byte key (set as `AVM_PRIVATE_KEY` env var)
3. **USDC opt-in** -- The paying address must have opted into the USDC ASA on the target network
4. **A payment-protected endpoint** -- A server running x402 middleware to test against

## Core Workflow: Automatic 402 Handling

The x402 HTTP client wraps your HTTP library's transport layer. When a 402 response is received, it automatically creates a payment and retries.

```
client.get("https://api.example.com/paid")
      |
      v
HTTP Transport sends request
      |
      v
Server returns 402 + PaymentRequirements
      |
      v
x402 Transport intercepts 402
      |
      v
ExactAvmScheme creates atomic transaction group
      |
      v
ClientAvmSigner signs payment transaction
      |
      v
Transport retries with PAYMENT-SIGNATURE header
      |
      v
Server verifies, settles, returns 200 + data
```

## How to Proceed

### Step 1: Choose Async or Sync

| Library | Variant | x402 Client | Install |
|---------|---------|-------------|---------|
| httpx (async) | `x402HttpxClient` | `x402Client` | `pip install "x402-avm[httpx,avm]"` |
| requests (sync) | `x402_requests` | `x402ClientSync` | `pip install "x402-avm[requests,avm]"` |

### Step 2: Implement ClientAvmSigner

Both async and sync clients need the same signer implementation:

```python
import base64
from algosdk import encoding


class AlgorandSigner:
    def __init__(self, secret_key: bytes, address: str):
        self._secret_key = secret_key
        self._address = address

    @property
    def address(self) -> str:
        return self._address

    def sign_transactions(
        self,
        unsigned_txns: list[bytes],
        indexes_to_sign: list[int],
    ) -> list[bytes | None]:
        sk_b64 = base64.b64encode(self._secret_key).decode()
        result: list[bytes | None] = []
        for i, txn_bytes in enumerate(unsigned_txns):
            if i in indexes_to_sign:
                txn = encoding.msgpack_decode(
                    base64.b64encode(txn_bytes).decode()
                )
                signed = txn.sign(sk_b64)
                result.append(
                    base64.b64decode(encoding.msgpack_encode(signed))
                )
            else:
                result.append(None)
        return result
```

### Step 3: Create Signer from Environment

```python
import os
import base64
from algosdk import encoding

avm_private_key = os.environ["AVM_PRIVATE_KEY"]
secret_key = base64.b64decode(avm_private_key)
if len(secret_key) != 64:
    raise ValueError("AVM_PRIVATE_KEY must be a Base64-encoded 64-byte key")

avm_address = encoding.encode_address(secret_key[32:])
signer = AlgorandSigner(secret_key, avm_address)
```

### Step 4: Register and Make Requests

**With httpx (async):**
```python
import asyncio
from x402 import x402Client
from x402.http.clients.httpx import x402HttpxClient
from x402.mechanisms.avm.exact.register import register_exact_avm_client

async def main():
    x402 = x402Client()
    register_exact_avm_client(x402, signer)

    async with x402HttpxClient(x402) as client:
        response = await client.get("https://api.example.com/paid-resource")
        print(response.status_code)
        print(response.text)

asyncio.run(main())
```

**With requests (sync):**
```python
from x402 import x402ClientSync
from x402.http.clients.requests import x402_requests
from x402.mechanisms.avm.exact.register import register_exact_avm_client

x402 = x402ClientSync()
register_exact_avm_client(x402, signer)

with x402_requests(x402) as session:
    response = session.get("https://api.example.com/paid-resource")
    print(response.status_code)
    print(response.text)
```

## Important Rules / Guidelines

1. **httpx uses `x402Client` (async), requests uses `x402ClientSync` (sync)** -- mixing causes `TypeError`
2. **Private key format** -- `AVM_PRIVATE_KEY` must be Base64-encoded 64 bytes (32-byte seed + 32-byte pubkey)
3. **algosdk encoding boundaries** -- `msgpack_decode` expects base64 string, `msgpack_encode` returns base64 string, `sign()` expects base64 key
4. **No infinite retry** -- The transport retries at most once; if the retry still returns 402, it passes through
5. **Register before creating HTTP client** -- Call `register_exact_avm_client` before wrapping with httpx/requests
6. **USDC opt-in required** -- The paying address must have opted into USDC on the target network

## Alternative Client Creation Methods

### `wrapHttpxWithPayment` (returns standard httpx.AsyncClient)

```python
from x402.http.clients.httpx import wrapHttpxWithPayment

async with wrapHttpxWithPayment(x402, timeout=30.0) as client:
    response = await client.get(url)
```

### `wrapRequestsWithPayment` (wraps existing session)

```python
from x402.http.clients.requests import wrapRequestsWithPayment

session = requests.Session()
session.headers.update({"Authorization": "Bearer token"})
wrapRequestsWithPayment(session, x402)
response = session.get(url)
```

### Config-based setup

```python
from x402 import x402ClientConfig, SchemeRegistration
from x402.mechanisms.avm.exact import ExactAvmClientScheme

config = x402ClientConfig(
    schemes=[
        SchemeRegistration(
            network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            client=ExactAvmClientScheme(signer=my_signer),
        ),
    ],
)
```

## Common Errors / Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `TypeError: x402HTTPAdapter requires sync client` | Used `x402Client` with requests | Use `x402ClientSync` for requests |
| `PaymentError: Failed to handle payment` | Payment creation or encoding failed | Check signer setup, private key, network registration |
| `ValueError: AVM_PRIVATE_KEY must be...` | Key is wrong length | Ensure key is Base64-encoded 64-byte key |
| `ImportError: AVM mechanism requires...` | `py-algorand-sdk` not installed | `pip install "x402-avm[avm]"` |
| `ImportError: requests client requires...` | `requests` not installed | `pip install "x402-avm[requests]"` |
| `ImportError: httpx client requires...` | `httpx` not installed | `pip install "x402-avm[httpx]"` |
| 402 returned after retry | Payment invalid or facilitator rejected | Check USDC balance, opt-in status, correct network |

## References / Further Reading

- [create-python-x402-client-reference.md](./create-python-x402-client-reference.md) - Detailed API reference for httpx and requests
- [create-python-x402-client-examples.md](./create-python-x402-client-examples.md) - Complete code examples
- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402 Algorand Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
