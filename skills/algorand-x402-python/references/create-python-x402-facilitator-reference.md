# Python x402 Facilitator and Bazaar Discovery Reference

Detailed API reference for building x402 facilitator services in Python with Algorand (AVM) support, including Bazaar discovery extension.

## FacilitatorAvmSigner Protocol

The `FacilitatorAvmSigner` is a Python Protocol class (structural typing -- no inheritance required). Any class implementing all six methods satisfies the protocol.

**Import:**
```python
from x402.mechanisms.avm.signer import FacilitatorAvmSigner
```

### Method: `get_addresses()`

```python
def get_addresses(self) -> list[str]:
```

Returns all managed fee payer addresses. The facilitator uses these addresses to identify which transactions it is responsible for signing in an atomic group.

- **Returns:** List of 58-character Algorand addresses
- **Typical implementation:** Returns a single-element list with the facilitator's address

### Method: `sign_transaction()`

```python
def sign_transaction(
    self, txn_bytes: bytes, fee_payer: str, network: str,
) -> bytes:
```

Signs a single transaction with the fee payer's private key.

- **Parameters:**
  - `txn_bytes` -- Raw msgpack-encoded unsigned transaction bytes
  - `fee_payer` -- 58-character Algorand address of the fee payer
  - `network` -- CAIP-2 network identifier (e.g., `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="`)
- **Returns:** Raw msgpack-encoded signed transaction bytes
- **Encoding note:** Must convert `txn_bytes` to base64 before calling `msgpack_decode()`, then convert `msgpack_encode()` result back from base64

### Method: `sign_group()`

```python
def sign_group(
    self,
    group_bytes: list[bytes],
    fee_payer: str,
    indexes_to_sign: list[int],
    network: str,
) -> list[bytes]:
```

Signs specified transactions in an atomic group.

- **Parameters:**
  - `group_bytes` -- List of raw msgpack-encoded transaction bytes (mix of signed and unsigned)
  - `fee_payer` -- 58-character Algorand address
  - `indexes_to_sign` -- Indexes of transactions this facilitator should sign
  - `network` -- CAIP-2 network identifier
- **Returns:** Updated list with signed bytes at specified indexes, unchanged bytes elsewhere
- **Typical pattern:** Delegates to `sign_transaction()` for each index

### Method: `simulate_group()`

```python
def simulate_group(
    self, group_bytes: list[bytes], network: str,
) -> None:
```

Simulates a transaction group to verify it would succeed on-chain. Raises an exception if simulation fails.

- **Parameters:**
  - `group_bytes` -- List of raw msgpack-encoded transaction bytes
  - `network` -- CAIP-2 network identifier
- **Returns:** None (raises on failure)
- **Key pattern:** Wrap unsigned `Transaction` objects with `SignedTransaction(txn, None)` and set `allow_empty_signatures=True`
- **Checks:** Iterates `txn-groups` in simulation result for `failure-message`

### Method: `send_group()`

```python
def send_group(
    self, group_bytes: list[bytes], network: str,
) -> str:
```

Sends a fully signed transaction group to the network.

- **Parameters:**
  - `group_bytes` -- List of raw msgpack-encoded signed transaction bytes
  - `network` -- CAIP-2 network identifier
- **Returns:** Transaction ID string
- **Key pattern:** Use `send_raw_transaction(base64.b64encode(b"".join(group_bytes)))` to concatenate and send all transactions efficiently
- **Important:** Do NOT use `send_transactions()` which asserts inputs are NOT `Transaction` type

### Method: `confirm_transaction()`

```python
def confirm_transaction(
    self, txid: str, network: str, rounds: int = 4,
) -> None:
```

Waits for transaction confirmation on the blockchain.

- **Parameters:**
  - `txid` -- Transaction ID returned by `send_group()`
  - `network` -- CAIP-2 network identifier
  - `rounds` -- Maximum number of rounds to wait (default: 4)
- **Returns:** None (raises on timeout)
- **Note:** Algorand has instant finality; once confirmed, the transaction is permanent

---

## register_exact_avm_facilitator

```python
from x402.mechanisms.avm.exact import register_exact_avm_facilitator

register_exact_avm_facilitator(
    facilitator: x402Facilitator,
    signer: FacilitatorAvmSigner,
    networks: list[str] = None,
)
```

Registers the AVM exact payment scheme on a facilitator instance.

- **Parameters:**
  - `facilitator` -- An `x402Facilitator` instance
  - `signer` -- Any object implementing the `FacilitatorAvmSigner` protocol
  - `networks` -- List of CAIP-2 network identifiers to register for. Defaults to `[ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2]`

---

## ExactAvmFacilitatorScheme

The scheme class registered by `register_exact_avm_facilitator`. It handles:

- **Verification:** Decodes the payment group, validates transaction structure, simulates on-chain
- **Settlement:** Signs the fee payer transaction, sends the atomic group, confirms on-chain
- **Security validation:** Checks for rekey attacks, close-to exploits, blocked transaction types

---

## Multi-Network Facilitator (EVM + SVM + AVM)

A facilitator can support multiple blockchain networks simultaneously:

```python
from x402 import x402Facilitator

# EVM registration
from x402.mechanisms.evm.exact import register_exact_evm_facilitator
# SVM registration
from x402.mechanisms.svm.exact import register_exact_svm_facilitator
# AVM registration
from x402.mechanisms.avm.exact import register_exact_avm_facilitator

facilitator = x402Facilitator()

# Register all networks
register_exact_evm_facilitator(facilitator, evm_signer)
register_exact_svm_facilitator(facilitator, svm_signer)
register_exact_avm_facilitator(facilitator, avm_signer, networks=[ALGORAND_TESTNET_CAIP2])
```

**Signer types by network:**

| Network | Signer Type | Import |
|---------|------------|--------|
| EVM | `FacilitatorWeb3Signer` | `from x402.mechanisms.evm.signer import FacilitatorWeb3Signer` |
| SVM | `FacilitatorKeypairSigner` | `from x402.mechanisms.svm.signer import FacilitatorKeypairSigner` |
| AVM | `FacilitatorAvmSigner` | `from x402.mechanisms.avm.signer import FacilitatorAvmSigner` |

---

## Facilitator Lifecycle Hooks

| Hook | Signature | Description |
|------|-----------|-------------|
| `on_before_verify` | `(payload, requirements) -> None` | Called before payment verification |
| `on_after_verify` | `(payload, requirements, result) -> None` | Called after verification completes |
| `on_before_settle` | `(payload, requirements) -> None` | Called before settlement submission |
| `on_after_settle` | `(payload, requirements, result) -> None` | Called after settlement completes |

---

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `AVM_PRIVATE_KEY` | Yes | Base64-encoded 64-byte key (32-byte seed + 32-byte pubkey) | -- |
| `ALGOD_SERVER` | No | Custom Algod node URL | AlgoNode public endpoint |
| `ALGOD_TOKEN` | No | Algod API token | `""` |
| `ALGOD_MAINNET_URL` | No | Mainnet Algod URL | `https://mainnet-api.algonode.cloud` |
| `ALGOD_TESTNET_URL` | No | Testnet Algod URL | `https://testnet-api.algonode.cloud` |

---

## algosdk Encoding Reference (v2.11.1)

The Python `algosdk` has different encoding conventions than the TypeScript version. This is the most common source of bugs:

| Operation | Python algosdk | TypeScript algosdk |
|-----------|---------------|-------------------|
| `msgpack_decode(s)` | Expects **base64 string** | N/A (uses `decodeUnsignedTransaction(Uint8Array)`) |
| `msgpack_encode(obj)` | Returns **base64 string** | N/A (uses `txn.toByte()` returning `Uint8Array`) |
| `Transaction.sign(key)` | Expects **base64 string** key | `signTransaction(txn, Uint8Array)` |
| SDK protocol | Passes **raw msgpack bytes** | Passes **raw `Uint8Array`** |

**Boundary conversion patterns:**

```python
import base64
from algosdk import encoding

# Raw bytes -> algosdk object (DECODE)
raw_bytes: bytes = ...
b64_string = base64.b64encode(raw_bytes).decode("utf-8")
txn_obj = encoding.msgpack_decode(b64_string)

# algosdk object -> raw bytes (ENCODE)
b64_string = encoding.msgpack_encode(txn_obj)
raw_bytes = base64.b64decode(b64_string)
```

---

## API Endpoints

A standard x402 facilitator exposes three endpoints:

| Endpoint | Method | Description | Request Body |
|----------|--------|-------------|-------------|
| `/supported` | GET | List supported networks | -- |
| `/verify` | POST | Verify a payment payload | `{paymentPayload, paymentRequirements}` |
| `/settle` | POST | Settle a verified payment | `{paymentPayload, paymentRequirements}` |

---

## Installation Commands

```bash
# Minimal facilitator
pip install "x402-avm[fastapi,avm]"

# With uvicorn for production
pip install "x402-avm[fastapi,avm]" uvicorn

# Multi-chain facilitator (EVM + SVM + AVM)
pip install "x402-avm[all,fastapi]"

# Everything
pip install "x402-avm[avm,httpx,requests]"
```

---

## Testing

```bash
# Start the facilitator
AVM_PRIVATE_KEY="your-key" uvicorn facilitator_service:app --port 4000

# Check supported networks
curl http://localhost:4000/supported

# Verify a payment (with actual payload)
curl -X POST http://localhost:4000/verify \
  -H "Content-Type: application/json" \
  -d '{"paymentPayload": {...}, "paymentRequirements": {...}}'
```

---

---

## Bazaar Extension API

### declare_discovery_extension()

```python
from x402.extensions.bazaar import declare_discovery_extension
```

Creates a discovery extension dict for route configuration.

**Signature:**
```python
def declare_discovery_extension(
    input: dict,
    input_schema: dict,
    body_type: str | None = None,
    output: OutputConfig | None = None,
) -> dict:
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | `dict` | Yes | Example values for query parameters or request body |
| `input_schema` | `dict` | Yes | JSON Schema describing the expected input |
| `body_type` | `str` or `None` | No | `None` for query (GET), `"json"` / `"form-data"` / `"text"` for body (POST) |
| `output` | `OutputConfig` or `None` | No | Output configuration with example and optional schema |

**Returns:** `{"bazaar": {"info": {...}, "schema": {...}}}`

**body_type values:**

| Value | HTTP Methods | Description |
|-------|-------------|-------------|
| `None` (default) | GET, HEAD, DELETE | Query parameter extension |
| `"json"` | POST, PUT, PATCH | JSON body extension |
| `"form-data"` | POST, PUT, PATCH | Form-data body extension |
| `"text"` | POST, PUT, PATCH | Plain text body extension |

---

### extract_discovery_info()

```python
from x402.extensions.bazaar import extract_discovery_info
```

Extracts discovery info from a payment request. Handles both v2 (extensions in PaymentPayload) and v1 (output_schema in PaymentRequirements) formats.

**Signature:**
```python
def extract_discovery_info(
    payment_payload: PaymentPayload | dict,
    payment_requirements: PaymentRequirements | dict,
    validate: bool = True,
) -> DiscoveredResource | None:
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `payment_payload` | `PaymentPayload` or `dict` | Yes | The payment payload from the client |
| `payment_requirements` | `PaymentRequirements` or `dict` | Yes | The payment requirements from the server |
| `validate` | `bool` | No | Validate v2 extensions before extracting (default: `True`) |

**Returns:** `DiscoveredResource` or `None` if no Bazaar extension found

---

### extract_discovery_info_from_extension()

```python
from x402.extensions.bazaar import extract_discovery_info_from_extension
```

Extracts discovery info from an extension object directly.

**Signature:**
```python
def extract_discovery_info_from_extension(
    extension: dict | DiscoveryExtension,
    validate: bool = True,
) -> DiscoveryInfo:
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `extension` | `dict` or `DiscoveryExtension` | Yes | Extension with `"info"` and `"schema"` keys |
| `validate` | `bool` | No | Raises `ValueError` if validation fails (default: `True`) |

**Returns:** `QueryDiscoveryInfo` or `BodyDiscoveryInfo`

---

### validate_discovery_extension()

```python
from x402.extensions.bazaar import validate_discovery_extension
```

Validates that an extension's `info` data conforms to its `schema`.

**Signature:**
```python
def validate_discovery_extension(
    extension: dict | DiscoveryExtension,
) -> ValidationResult:
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `extension` | `dict` or `DiscoveryExtension` | Yes | Extension to validate |

**Returns:** `ValidationResult` with `valid: bool` and `errors: list[str]`

---

### validate_and_extract()

```python
from x402.extensions.bazaar import validate_and_extract
```

Validates and extracts discovery info in one step.

**Signature:**
```python
def validate_and_extract(
    extension: dict | DiscoveryExtension,
) -> ValidationExtractResult:
```

**Returns:** Object with `valid: bool`, `errors: list[str]`, and `info: DiscoveryInfo | None`

---

### bazaar_resource_server_extension

```python
from x402.extensions.bazaar import bazaar_resource_server_extension
```

A server-side extension that enriches discovery declarations with HTTP method information at runtime. Must be registered on an `x402ResourceServer` or `x402ResourceServerSync` instance.

**Usage:**
```python
server.register_extension(bazaar_resource_server_extension)
```

**What it does at runtime:**
1. Intercepts the declaration enrichment step when an HTTP request arrives for a payment-protected route with a `"bazaar"` extension
2. Reads the HTTP method from the transport context (e.g., `request.method`)
3. Injects the method into `info.input.method` and updates the schema
4. The enriched extension is included in the 402 Payment Required response

---

### with_bazaar()

```python
from x402.extensions.bazaar import with_bazaar
```

Extends a facilitator client with discovery query capabilities.

**Signature:**
```python
def with_bazaar(
    client: HTTPFacilitatorClient,
) -> BazaarExtendedClient:
```

**Returns:** Extended client with `client.extensions.discovery.list_resources()` method. All original facilitator client methods are delegated transparently.

---

### OutputConfig

```python
from x402.extensions.bazaar import OutputConfig
```

Configuration for the output portion of a discovery extension.

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `example` | `dict` | Yes | Example response value |
| `schema` | `dict` or `None` | No | JSON Schema for the response |

---

## Bazaar Data Types

### DiscoveredResource

```python
@dataclass
class DiscoveredResource:
    resource_url: str          # Normalized URL (no query/hash)
    method: str                # HTTP method (GET, POST, etc.)
    x402_version: int          # 1 or 2
    discovery_info: DiscoveryInfo  # QueryDiscoveryInfo or BodyDiscoveryInfo
    description: str | None    # From resource info or requirements
    mime_type: str | None      # From resource info or requirements
```

### DiscoveryInfo (Union Type)

```python
DiscoveryInfo = QueryDiscoveryInfo | BodyDiscoveryInfo
```

### ValidationResult

```python
@dataclass
class ValidationResult:
    valid: bool
    errors: list[str]  # Empty when valid
```

---

## Bazaar Pydantic Models (from `x402.extensions.bazaar.types`)

| Type | Fields | Description |
|------|--------|-------------|
| `QueryInput` | `type`, `method`, `query_params`, `headers` | Input spec for GET/HEAD/DELETE |
| `BodyInput` | `type`, `method`, `body_type`, `body`, `query_params`, `headers` | Input spec for POST/PUT/PATCH |
| `OutputInfo` | `type`, `format`, `example` | Output specification |
| `QueryDiscoveryInfo` | `input: QueryInput`, `output: OutputInfo` | Discovery info for query methods |
| `BodyDiscoveryInfo` | `input: BodyInput`, `output: OutputInfo` | Discovery info for body methods |
| `QueryDiscoveryExtension` | `info: QueryDiscoveryInfo`, `schema_: dict` | Full extension with schema (query) |
| `BodyDiscoveryExtension` | `info: BodyDiscoveryInfo`, `schema_: dict` | Full extension with schema (body) |

### Bazaar Union Types

| Name | Members | Description |
|------|---------|-------------|
| `DiscoveryInfo` | `QueryDiscoveryInfo \| BodyDiscoveryInfo` | Any discovery info |
| `DiscoveryExtension` | `QueryDiscoveryExtension \| BodyDiscoveryExtension` | Any extension |

---

## Bazaar Type Constants and Literals

| Name | Value | Description |
|------|-------|-------------|
| `BAZAAR` | `"bazaar"` | Extension key identifier in route configs |

| Literal Type | Values | Description |
|-------------|--------|-------------|
| `QueryParamMethods` | `"GET"`, `"HEAD"`, `"DELETE"` | HTTP methods using query parameters |
| `BodyMethods` | `"POST"`, `"PUT"`, `"PATCH"` | HTTP methods using request bodies |
| `BodyType` | `"json"`, `"form-data"`, `"text"` | Content types for body requests |

---

## Bazaar Config Dataclasses

| Type | Fields | Description |
|------|--------|-------------|
| `OutputConfig` | `example`, `schema` | Configure output for `declare_discovery_extension` |
| `DeclareQueryDiscoveryConfig` | `input`, `input_schema`, `output` | Config for query discovery |
| `DeclareBodyDiscoveryConfig` | `input`, `input_schema`, `body_type`, `output` | Config for body discovery |

---

## Bazaar Client Types (from `x402.extensions.bazaar.facilitator_client`)

| Type | Description |
|------|-------------|
| `ListDiscoveryResourcesParams` | Params for `list_resources()`: `type`, `limit`, `offset` |
| `DiscoveryResource` | A discovered resource: `url`, `type`, `metadata` |
| `DiscoveryResourcesResponse` | Response: `resources`, `total`, `limit`, `offset` |
| `BazaarDiscoveryExtension` | Discovery query class with `list_resources()` method |
| `BazaarClientExtension` | Container with `.discovery` attribute |
| `BazaarExtendedClient` | Extended client with `.extensions` attribute |

---

## Bazaar Helper Functions (from `x402.extensions.bazaar.types`)

| Function | Import | Description |
|----------|--------|-------------|
| `parse_discovery_extension(data)` | `from x402.extensions.bazaar.types import parse_discovery_extension` | Parse raw dict into typed extension |
| `parse_discovery_info(data)` | `from x402.extensions.bazaar.types import parse_discovery_info` | Parse raw dict into typed info |
| `is_query_method(method)` | `from x402.extensions.bazaar.types import is_query_method` | Check if method is GET/HEAD/DELETE |
| `is_body_method(method)` | `from x402.extensions.bazaar.types import is_body_method` | Check if method is POST/PUT/PATCH |

---

## Bazaar Functions Summary Table

| Function | Import | Description |
|----------|--------|-------------|
| `declare_discovery_extension` | `from x402.extensions.bazaar import ...` | Create discovery extension dict for route config |
| `validate_discovery_extension` | `from x402.extensions.bazaar import ...` | Validate extension info against its schema |
| `extract_discovery_info` | `from x402.extensions.bazaar import ...` | Extract discovery info from payment request (v1 + v2) |
| `extract_discovery_info_from_extension` | `from x402.extensions.bazaar import ...` | Extract info from extension object directly |
| `validate_and_extract` | `from x402.extensions.bazaar import ...` | Validate and extract in one step |
| `with_bazaar` | `from x402.extensions.bazaar import ...` | Extend facilitator client with discovery queries |
| `parse_discovery_extension` | `from x402.extensions.bazaar.types import ...` | Parse raw dict into typed extension |
| `parse_discovery_info` | `from x402.extensions.bazaar.types import ...` | Parse raw dict into typed info |
| `is_query_method` | `from x402.extensions.bazaar.types import ...` | Check if method is GET/HEAD/DELETE |
| `is_body_method` | `from x402.extensions.bazaar.types import ...` | Check if method is POST/PUT/PATCH |

---

## Bazaar Installation Commands

```bash
# Extensions only
pip install "x402-avm[extensions]"

# Extensions + Algorand support
pip install "x402-avm[extensions,avm]"

# Extensions + Algorand + FastAPI
pip install "x402-avm[extensions,avm,fastapi]"

# Extensions + Algorand + Flask
pip install "x402-avm[extensions,avm,flask]"

# Everything
pip install "x402-avm[avm,httpx,requests]"
```

The `[extensions]` extra adds one dependency: `jsonschema>=4.0.0`.

---

## External Resources

- [Facilitator Example Source](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/python/facilitator)
- [Extensions Examples](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402-avm AVM Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [algosdk Python Reference](https://py-algorand-sdk.readthedocs.io/)
- [Algorand Developer Portal](https://developer.algorand.org/)
- [JSON Schema Specification](https://json-schema.org/)
- [CAIP-2 Chain ID Specification](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md)
