# x402 Python HTTP Client Examples

## httpx: Basic Usage with x402HttpxClient

```python
import asyncio
from x402 import x402Client
from x402.http.clients.httpx import x402HttpxClient

async def main():
    x402 = x402Client()
    # ... register schemes ...

    async with x402HttpxClient(x402) as client:
        response = await client.get("https://api.example.com/paid-resource")
        print(response.status_code)
        print(response.text)

asyncio.run(main())
```

## httpx: x402HttpxClient with Extra Options

```python
async with x402HttpxClient(x402, timeout=30.0, follow_redirects=True) as client:
    response = await client.get("https://api.example.com/paid-resource")
```

## httpx: wrapHttpxWithPayment

```python
import asyncio
from x402 import x402Client
from x402.http.clients.httpx import wrapHttpxWithPayment

async def main():
    x402 = x402Client()
    # ... register schemes ...

    async with wrapHttpxWithPayment(x402, timeout=30.0) as client:
        response = await client.get("https://api.example.com/paid-resource")
        print(response.status_code)
        print(response.text)

asyncio.run(main())
```

## httpx: Custom Transport Setup

```python
import asyncio
import httpx
from x402 import x402Client
from x402.http.clients.httpx import x402_httpx_transport

async def main():
    x402 = x402Client()
    # ... register schemes ...

    # Default underlying transport
    transport = x402_httpx_transport(x402)

    # Custom underlying transport (e.g., with retries)
    custom_transport = httpx.AsyncHTTPTransport(retries=3)
    transport = x402_httpx_transport(x402, transport=custom_transport)

    async with httpx.AsyncClient(transport=transport) as client:
        response = await client.get("https://api.example.com/paid-resource")
        print(response.status_code)

asyncio.run(main())
```

## httpx: Config-Based Setup

```python
import asyncio
from x402 import x402ClientConfig, SchemeRegistration
from x402.http.clients.httpx import wrapHttpxWithPaymentFromConfig
from x402.mechanisms.avm.exact import ExactAvmClientScheme

config = x402ClientConfig(
    schemes=[
        SchemeRegistration(
            network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            client=ExactAvmClientScheme(signer=my_avm_signer),
        ),
    ],
)

async def main():
    async with wrapHttpxWithPaymentFromConfig(config) as client:
        response = await client.get("https://api.example.com/paid-resource")
        print(response.text)

asyncio.run(main())
```

## httpx: Complete Algorand Example

```python
"""Complete x402-avm httpx example with Algorand payment handling."""

import asyncio
import base64
import os

import algosdk
from x402 import x402Client
from x402.http import x402HTTPClient
from x402.http.clients.httpx import x402HttpxClient
from x402.mechanisms.avm.exact.register import register_exact_avm_client


class AlgorandSigner:
    """Implements the ClientAvmSigner protocol using algosdk."""

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
                txn = algosdk.encoding.msgpack_decode(
                    base64.b64encode(txn_bytes).decode()
                )
                signed = txn.sign(sk_b64)
                result.append(
                    base64.b64decode(algosdk.encoding.msgpack_encode(signed))
                )
            else:
                result.append(None)
        return result


async def main():
    avm_private_key = os.environ["AVM_PRIVATE_KEY"]
    secret_key = base64.b64decode(avm_private_key)
    if len(secret_key) != 64:
        raise ValueError("AVM_PRIVATE_KEY must be a Base64-encoded 64-byte key")

    avm_address = algosdk.encoding.encode_address(secret_key[32:])
    print(f"Algorand address: {avm_address}")

    signer = AlgorandSigner(secret_key, avm_address)
    x402 = x402Client()
    register_exact_avm_client(x402, signer)

    resource_url = os.environ.get(
        "RESOURCE_URL", "https://api.example.com/paid-resource"
    )

    async with x402HttpxClient(x402) as client:
        response = await client.get(resource_url)
        await response.aread()

        print(f"Status: {response.status_code}")
        print(f"Body: {response.text}")

        if response.is_success:
            http_client = x402HTTPClient(x402)
            try:
                settle = http_client.get_payment_settle_response(
                    lambda name: response.headers.get(name)
                )
                print(f"Settlement: {settle.model_dump_json(indent=2)}")
            except ValueError:
                print("No payment response header found")


if __name__ == "__main__":
    asyncio.run(main())
```

## httpx: Error Handling

```python
from x402.http.clients.httpx import (
    PaymentError,
    PaymentAlreadyAttemptedError,
    MissingRequestConfigError,
)

async with x402HttpxClient(x402) as client:
    try:
        response = await client.get("https://api.example.com/paid")
    except PaymentAlreadyAttemptedError:
        print("Payment was already attempted but failed")
    except PaymentError as e:
        print(f"Payment handling failed: {e}")
    except httpx.HTTPError as e:
        print(f"HTTP error: {e}")
```

## httpx: Register with Specific Network

```python
# Testnet only
register_exact_avm_client(x402, signer, networks="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=")

# Mainnet only
register_exact_avm_client(x402, signer, networks="algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=")

# Both explicitly
register_exact_avm_client(x402, signer, networks=[
    "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=",
])
```

## httpx: Custom Algod Endpoint

```python
register_exact_avm_client(
    x402,
    signer,
    algod_url="https://my-private-algod.example.com",
)
```

---

## requests: Basic Usage with x402_requests

```python
from x402 import x402ClientSync
from x402.http.clients.requests import x402_requests

x402 = x402ClientSync()
# ... register schemes ...

session = x402_requests(x402)
response = session.get("https://api.example.com/paid-resource")
print(response.status_code)
print(response.text)
```

## requests: Context Manager

```python
with x402_requests(x402) as session:
    response = session.get("https://api.example.com/paid-resource")
    print(response.text)
```

## requests: wrapRequestsWithPayment

```python
import requests
from x402 import x402ClientSync
from x402.http.clients.requests import wrapRequestsWithPayment

x402 = x402ClientSync()
# ... register schemes ...

session = requests.Session()
session.headers.update({"Authorization": "Bearer my-token"})

wrapRequestsWithPayment(session, x402)

response = session.get("https://api.example.com/paid-resource")
print(response.text)
```

## requests: Manual Adapter Mounting

```python
import requests
from x402 import x402ClientSync
from x402.http.clients.requests import x402_http_adapter

x402 = x402ClientSync()
# ... register schemes ...

session = requests.Session()

adapter = x402_http_adapter(x402)
session.mount("https://api.example.com/", adapter)

response = session.get("https://api.example.com/paid-resource")
```

## requests: Using x402HTTPAdapter Directly

```python
from x402.http.clients.requests import x402HTTPAdapter

adapter = x402HTTPAdapter(x402, max_retries=3, pool_connections=10)
session.mount("https://", adapter)
session.mount("http://", adapter)
```

## requests: Config-Based Setup

```python
import requests
from x402 import x402ClientConfig, SchemeRegistration
from x402.http.clients.requests import wrapRequestsWithPaymentFromConfig
from x402.mechanisms.avm.exact import ExactAvmClientScheme

config = x402ClientConfig(
    schemes=[
        SchemeRegistration(
            network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            client=ExactAvmClientScheme(signer=my_avm_signer),
        ),
    ],
)

session = wrapRequestsWithPaymentFromConfig(requests.Session(), config)
response = session.get("https://api.example.com/paid-resource")
```

## requests: Complete Algorand Example

```python
"""Complete x402-avm requests example with Algorand payment handling."""

import base64
import os

import algosdk
from x402 import x402ClientSync
from x402.http import x402HTTPClientSync
from x402.http.clients.requests import x402_requests
from x402.mechanisms.avm.exact.register import register_exact_avm_client


class AlgorandSigner:
    """Implements the ClientAvmSigner protocol using algosdk."""

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
                txn = algosdk.encoding.msgpack_decode(
                    base64.b64encode(txn_bytes).decode()
                )
                signed = txn.sign(sk_b64)
                result.append(
                    base64.b64decode(algosdk.encoding.msgpack_encode(signed))
                )
            else:
                result.append(None)
        return result


def main():
    avm_private_key = os.environ["AVM_PRIVATE_KEY"]
    secret_key = base64.b64decode(avm_private_key)
    if len(secret_key) != 64:
        raise ValueError("AVM_PRIVATE_KEY must be a Base64-encoded 64-byte key")

    avm_address = algosdk.encoding.encode_address(secret_key[32:])
    print(f"Algorand address: {avm_address}")

    signer = AlgorandSigner(secret_key, avm_address)
    x402 = x402ClientSync()
    register_exact_avm_client(x402, signer)

    resource_url = os.environ.get(
        "RESOURCE_URL", "https://api.example.com/paid-resource"
    )

    with x402_requests(x402) as session:
        response = session.get(resource_url)

        print(f"Status: {response.status_code}")
        print(f"Body: {response.text}")

        if response.ok:
            http_client = x402HTTPClientSync(x402)
            try:
                settle = http_client.get_payment_settle_response(
                    lambda name: response.headers.get(name)
                )
                print(f"Settlement: {settle.model_dump_json(indent=2)}")
            except ValueError:
                print("No payment response header found")


if __name__ == "__main__":
    main()
```

## requests: Error Handling

```python
from x402.http.clients.requests import PaymentError

with x402_requests(x402) as session:
    try:
        response = session.get("https://api.example.com/paid")
    except PaymentError as e:
        print(f"Payment handling failed: {e}")
    except requests.RequestException as e:
        print(f"HTTP error: {e}")
```

## requests: Register with Specific Network

```python
# Testnet only
register_exact_avm_client(x402, signer, networks="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=")

# Mainnet only
register_exact_avm_client(x402, signer, networks="algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=")

# Both explicitly
register_exact_avm_client(x402, signer, networks=[
    "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=",
])
```

## requests: Custom Algod Endpoint

```python
register_exact_avm_client(
    x402,
    signer,
    algod_url="https://my-private-algod.example.com",
)
```

## ClientAvmSigner: Encoding Boundary Pattern

```python
import base64
from algosdk import encoding

# Inside sign_transactions():

# 1. Raw bytes -> base64 string for algosdk
b64_txn = base64.b64encode(txn_bytes).decode("utf-8")
txn_obj = encoding.msgpack_decode(b64_txn)

# 2. Sign with base64 private key
sk_b64 = base64.b64encode(self._secret_key).decode()
signed_txn = txn_obj.sign(sk_b64)

# 3. Base64 string from algosdk -> raw bytes for SDK
signed_b64 = encoding.msgpack_encode(signed_txn)
signed_bytes = base64.b64decode(signed_b64)
```
