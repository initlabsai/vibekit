# Creating Python x402 Facilitator Services and Bazaar Discovery

Build FastAPI-based facilitator services that verify and settle x402 payments on-chain for Algorand (AVM), with optional multi-network support for EVM and SVM. Includes Bazaar discovery extension for automatic cataloging and indexing of payment-gated APIs.

## Prerequisites

Before using this skill, ensure:

1. **Python 3.10+** is installed
2. **x402-avm package** is available: `pip install "x402-avm[fastapi,avm]"`
3. **Algorand private key** is available as a Base64-encoded 64-byte key (32-byte seed + 32-byte pubkey) in `AVM_PRIVATE_KEY` environment variable
4. **Algod node access** via AlgoNode (default) or custom node via `ALGOD_SERVER` / `ALGOD_TOKEN`

## Core Workflow: Facilitator Payment Lifecycle

The facilitator sits between the resource server and the blockchain, handling payment verification and settlement:

```
Resource Server              Facilitator                   Blockchain
     |                           |                             |
     |--- /verify (payload) ---->|                             |
     |                           |-- simulate_group() -------->|
     |                           |<-- simulation result -------|
     |<-- {isValid: true} -------|                             |
     |                           |                             |
     |--- /settle (payload) ---->|                             |
     |                           |-- sign_group() ------------>|
     |                           |-- send_group() ------------>|
     |                           |<-- txid --------------------|
     |                           |-- confirm_transaction() --->|
     |<-- {success, txid} -------|                             |
```

## How to Proceed

### Step 1: Install Dependencies

```bash
pip install "x402-avm[fastapi,avm]"
```

This installs `py-algorand-sdk` (algosdk), FastAPI, uvicorn, and the x402-avm SDK.

### Step 2: Implement FacilitatorAvmSigner

The `FacilitatorAvmSigner` protocol defines six methods. Implement all of them using `algosdk`:

```python
import os
import base64
from algosdk import encoding, transaction
from algosdk.v2client import algod
from x402.mechanisms.avm.constants import NETWORK_CONFIGS


class AlgorandFacilitatorSigner:
    def __init__(self, private_key_b64: str, algod_url: str = "", algod_token: str = ""):
        self._secret_key = base64.b64decode(private_key_b64)
        self._address = encoding.encode_address(self._secret_key[32:])
        self._signing_key = base64.b64encode(self._secret_key).decode()
        self._clients: dict[str, algod.AlgodClient] = {}
        if algod_url:
            self._default_client = algod.AlgodClient(algod_token, algod_url)
        else:
            self._default_client = None

    def _get_client(self, network: str) -> algod.AlgodClient:
        if network not in self._clients:
            if self._default_client:
                self._clients[network] = self._default_client
            else:
                config = NETWORK_CONFIGS.get(network, {})
                url = config.get("algod_url", "https://testnet-api.algonode.cloud")
                self._clients[network] = algod.AlgodClient("", url)
        return self._clients[network]

    def get_addresses(self) -> list[str]:
        return [self._address]

    def sign_transaction(self, txn_bytes: bytes, fee_payer: str, network: str) -> bytes:
        b64 = base64.b64encode(txn_bytes).decode("utf-8")
        txn_obj = encoding.msgpack_decode(b64)
        signed = txn_obj.sign(self._signing_key)
        return base64.b64decode(encoding.msgpack_encode(signed))

    def sign_group(self, group_bytes, fee_payer, indexes_to_sign, network):
        result = list(group_bytes)
        for i in indexes_to_sign:
            result[i] = self.sign_transaction(group_bytes[i], fee_payer, network)
        return result

    def simulate_group(self, group_bytes, network):
        client = self._get_client(network)
        stxns = []
        for txn_bytes in group_bytes:
            b64 = base64.b64encode(txn_bytes).decode("utf-8")
            obj = encoding.msgpack_decode(b64)
            if isinstance(obj, transaction.SignedTransaction):
                stxns.append(obj)
            else:
                stxns.append(transaction.SignedTransaction(obj, None))
        req = transaction.SimulateRequest(
            txn_groups=[transaction.SimulateRequestTransactionGroup(txns=stxns)],
            allow_empty_signatures=True,
        )
        result = client.simulate_raw_transactions(req)
        for group in result.get("txn-groups", []):
            if group.get("failure-message"):
                raise Exception(f"Simulation failed: {group['failure-message']}")

    def send_group(self, group_bytes, network):
        client = self._get_client(network)
        return client.send_raw_transaction(base64.b64encode(b"".join(group_bytes)))

    def confirm_transaction(self, txid, network, rounds=4):
        client = self._get_client(network)
        transaction.wait_for_confirmation(client, txid, rounds)
```

### Step 3: Register the Signer with x402Facilitator

```python
from x402 import x402Facilitator
from x402.mechanisms.avm.exact import register_exact_avm_facilitator
from x402.mechanisms.avm import ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2

signer = AlgorandFacilitatorSigner(
    private_key_b64=os.environ["AVM_PRIVATE_KEY"],
    algod_url=os.environ.get("ALGOD_SERVER", ""),
    algod_token=os.environ.get("ALGOD_TOKEN", ""),
)

facilitator = x402Facilitator()
register_exact_avm_facilitator(
    facilitator,
    signer,
    networks=[ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2],
)
```

### Step 4: Create FastAPI Endpoints

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI(title="x402-avm Facilitator Service")

@app.get("/supported")
async def supported():
    return facilitator.get_supported_networks()

@app.post("/verify")
async def verify(request: Request):
    body = await request.json()
    try:
        result = await facilitator.verify(
            body["paymentPayload"], body["paymentRequirements"]
        )
        return result
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@app.post("/settle")
async def settle(request: Request):
    body = await request.json()
    try:
        result = await facilitator.settle(
            body["paymentPayload"], body["paymentRequirements"]
        )
        return result
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
```

### Step 5: Run the Service

```bash
AVM_PRIVATE_KEY="your-base64-key" uvicorn facilitator_service:app --port 4000
```

## Important Rules / Guidelines

1. **algosdk encoding boundaries** -- `msgpack_decode()` expects a base64 string, not raw bytes. Always convert: `base64.b64encode(raw_bytes).decode("utf-8")` before decoding. `msgpack_encode()` returns a base64 string; convert back with `base64.b64decode()`.
2. **Private key format** -- `Transaction.sign()` expects a base64-encoded string of the 64-byte key, not raw bytes.
3. **send_group pattern** -- Use `send_raw_transaction(base64.b64encode(b"".join(group_bytes)))` to avoid unnecessary decode/re-encode overhead.
4. **simulate_group pattern** -- Wrap unsigned transactions with `SignedTransaction(txn, None)` and use `allow_empty_signatures=True`.
5. **Address derivation** -- Use `encoding.encode_address(secret_key[32:])` to derive the address from the 64-byte key.
6. **First-class AVM** -- Register AVM unconditionally, never behind `if (env.AVM_*)` guards.
7. **Network constants** -- Import `ALGORAND_TESTNET_CAIP2` and `ALGORAND_MAINNET_CAIP2` from the SDK; do not hardcode genesis hashes in application code.

## Lifecycle Hooks

The `x402Facilitator` supports lifecycle hooks for custom logic:

| Hook | When Called | Use Case |
|------|-----------|----------|
| `on_before_verify` | Before payment verification | Logging, rate limiting |
| `on_after_verify` | After verification completes | Analytics, caching |
| `on_before_settle` | Before settlement submission | Final validation |
| `on_after_settle` | After settlement completes | Notification, receipts |

## Common Errors / Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `msgpack_decode expects string` | Passing raw bytes to `msgpack_decode` | Wrap with `base64.b64encode(raw).decode()` |
| `Invalid key length` | Wrong private key format | Ensure `AVM_PRIVATE_KEY` is base64-encoded 64 bytes |
| `Simulation failed` | Transaction would fail on-chain | Check balances, asset opt-in, fee amounts |
| `send_raw_transaction expects bytes-like` | Wrong argument type | Use `base64.b64encode(b"".join(group_bytes))` |
| `Transaction not confirmed` | Node timeout or network issue | Increase `rounds` parameter or check node connectivity |
| `send_transactions asserts NOT Transaction` | Passing unsigned `Transaction` to `send_transactions` | Use `send_raw_transaction` instead |

---

## Bazaar Discovery Extension

Bazaar is a resource discovery protocol built into x402. It allows payment-gated APIs to advertise:

- **What they accept as input** -- query parameters for GET/HEAD/DELETE, or request body schemas for POST/PUT/PATCH
- **What they return as output** -- the shape, type, and examples of the response data

This metadata enables facilitators to automatically catalog and index x402-enabled resources, so clients can discover APIs by their capabilities rather than just by URL. It is a machine-readable menu for paid APIs.

```
Resource Server (declares)         Facilitator (catalogs)        Client (discovers)
+---------------------------+      +----------------------+      +-------------------+
| RouteConfig + extensions: |      | extract_discovery_   |      | with_bazaar()     |
|   **declare_discovery_    | ---> |   info()             | ---> |   .list_resources()|
|     extension(...)        |      | validate_discovery_  |      |                   |
+---------------------------+      |   extension()        |      +-------------------+
                                   +----------------------+
```

### Bazaar Prerequisites

1. **x402-avm with extensions** is available: `pip install "x402-avm[extensions,avm]"`
2. **Web framework** installed: `pip install "x402-avm[extensions,avm,fastapi]"` or `[...,flask]`

The `extensions` extra installs `jsonschema>=4.0.0` for schema validation.

### Step 6: Declare Discovery Extensions on Routes

Use `declare_discovery_extension()` on your route configurations to describe what each endpoint accepts and returns.

**For GET endpoints (query parameters):**

```python
from x402.extensions.bazaar import declare_discovery_extension, OutputConfig

discovery = declare_discovery_extension(
    input={"city": "San Francisco"},
    input_schema={
        "properties": {
            "city": {"type": "string", "description": "City name"},
        },
        "required": ["city"],
    },
    output=OutputConfig(
        example={"weather": "sunny", "temperature": 70},
        schema={
            "properties": {
                "weather": {"type": "string"},
                "temperature": {"type": "number"},
            },
            "required": ["weather", "temperature"],
        },
    ),
)
```

**For POST endpoints (JSON body):**

```python
discovery = declare_discovery_extension(
    input={"prompt": "Tell me about Algorand", "max_tokens": 100},
    input_schema={
        "properties": {
            "prompt": {"type": "string"},
            "max_tokens": {"type": "integer"},
        },
        "required": ["prompt"],
    },
    body_type="json",
    output=OutputConfig(
        example={"text": "Algorand is a...", "tokens_used": 42},
    ),
)
```

### Step 7: Add Extensions to Route Configuration

Spread the discovery dict into your route's `extensions` field:

```python
from x402.http import PaymentOption
from x402.http.types import RouteConfig
from x402.schemas import Network

AVM_NETWORK: Network = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="

routes = {
    "GET /weather": RouteConfig(
        accepts=[
            PaymentOption(
                scheme="exact",
                pay_to=AVM_ADDRESS,
                price="$0.001",
                network=AVM_NETWORK,
            ),
        ],
        description="Weather report",
        mime_type="application/json",
        extensions={
            **declare_discovery_extension(
                input={"city": "San Francisco"},
                input_schema={
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                },
                output=OutputConfig(
                    example={"weather": "sunny", "temperature": 70},
                ),
            )
        },
    ),
}
```

### Step 8: Register Bazaar Extension on Server

```python
from x402.server import x402ResourceServer
from x402.http import FacilitatorConfig, HTTPFacilitatorClient
from x402.extensions.bazaar import bazaar_resource_server_extension
from x402.mechanisms.avm.exact import ExactAvmServerScheme

facilitator = HTTPFacilitatorClient(FacilitatorConfig(url="https://x402.org/facilitator"))
server = x402ResourceServer(facilitator)
server.register(AVM_NETWORK, ExactAvmServerScheme())
server.register_extension(bazaar_resource_server_extension)
```

### Step 9: Extract and Validate on Facilitator Side

```python
from x402.extensions.bazaar import extract_discovery_info, validate_discovery_extension

# Extract discovery info from a payment request
discovered = extract_discovery_info(
    payment_payload=payment_payload,
    payment_requirements=payment_requirements,
    validate=True,
)

if discovered:
    print(f"URL: {discovered.resource_url}")
    print(f"Method: {discovered.method}")
    print(f"Description: {discovered.description}")
```

### Step 10: Apply Payment Middleware with Bazaar

**FastAPI:**

```python
from fastapi import FastAPI
from x402.http.middleware.fastapi import PaymentMiddlewareASGI

app = FastAPI()
app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)
```

**Flask:**

```python
from flask import Flask
from x402.http.middleware.flask import payment_middleware

app = Flask(__name__)
payment_middleware(app, routes=routes, server=server)
```

### Bazaar Rules / Guidelines

1. **Discovery is chain-agnostic** -- The same Bazaar metadata applies regardless of which payment network (AVM, EVM, SVM) the client uses.
2. **Extensions spread into routes** -- Use `**declare_discovery_extension(...)` to merge the `{"bazaar": {...}}` dict into the route's `extensions` dict.
3. **body_type determines input type** -- `None` (default) creates a query extension (GET/HEAD/DELETE). `"json"` creates a body extension (POST/PUT/PATCH).
4. **Server extension is required** -- Register `bazaar_resource_server_extension` on the server to enrich declarations with HTTP method at runtime.
5. **Validation uses jsonschema** -- The `[extensions]` extra installs jsonschema. Validation checks that `info` data conforms to its `schema`.

### Bazaar Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ImportError: jsonschema` | Missing `[extensions]` extra | Install with `pip install "x402-avm[extensions]"` |
| `KeyError: 'bazaar'` | Extension not declared on route | Add `**declare_discovery_extension(...)` to route config `extensions` |
| `ValidationResult.valid is False` | Extension info does not match schema | Check that example data matches the declared input/output schema |
| `discovered is None` | No Bazaar extension in the payment request | Ensure both server-side declaration and extension registration are in place |
| `body_type not set for POST` | POST route treated as query extension | Add `body_type="json"` to `declare_discovery_extension()` |

## References / Further Reading

- [create-python-x402-facilitator-reference.md](./create-python-x402-facilitator-reference.md) -- Detailed API reference for FacilitatorAvmSigner protocol and Bazaar extension
- [create-python-x402-facilitator-examples.md](./create-python-x402-facilitator-examples.md) -- Complete code examples (including Bazaar discovery)
- [Facilitator Example](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/python/facilitator)
- [Extensions Examples](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402-avm AVM Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
