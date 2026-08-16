# x402 Python HTTP Client Reference

Detailed API reference for httpx (async) and requests (sync) client integrations in the `x402-avm` Python package.

## httpx APIs

All httpx APIs are in `x402.http.clients.httpx`. They use `x402Client` (async).

### `x402HttpxClient(x402_client, **kwargs)`

Convenience class extending `httpx.AsyncClient` with built-in payment transport.

| Parameter | Type | Description |
|-----------|------|-------------|
| `x402_client` | `x402Client \| x402HTTPClient` | The async x402 client instance |
| `**kwargs` | `Any` | Additional arguments forwarded to `httpx.AsyncClient` |

**Returns**: `httpx.AsyncClient` subclass with payment handling.

**Usage**:
```python
async with x402HttpxClient(x402, timeout=30.0) as client:
    response = await client.get(url)
```

### `wrapHttpxWithPayment(x402_client, **httpx_kwargs)`

Factory function that creates a new `httpx.AsyncClient` with payment transport.

| Parameter | Type | Description |
|-----------|------|-------------|
| `x402_client` | `x402Client \| x402HTTPClient` | The async x402 client instance |
| `**httpx_kwargs` | `Any` | Additional arguments forwarded to `httpx.AsyncClient` |

**Returns**: `httpx.AsyncClient` (standard instance, not subclass).

### `wrapHttpxWithPaymentFromConfig(config, **httpx_kwargs)`

Creates an `httpx.AsyncClient` from a `x402ClientConfig` (builds `x402Client` internally).

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `x402ClientConfig` | Configuration with scheme registrations |
| `**httpx_kwargs` | `Any` | Additional arguments forwarded to `httpx.AsyncClient` |

**Returns**: `httpx.AsyncClient` with payment transport.

### `x402_httpx_transport(client, transport=None)`

Low-level function that returns an `x402AsyncTransport` for manual `httpx.AsyncClient` construction.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `x402Client \| x402HTTPClient` | required | The async x402 client |
| `transport` | `AsyncBaseTransport \| None` | `None` | Custom underlying transport |

**Returns**: `x402AsyncTransport` (an `httpx.AsyncBaseTransport`).

### `x402AsyncTransport`

The transport implementation that intercepts 402 responses and handles payments.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `x402Client \| x402HTTPClient` | required | The async x402 client |
| `transport` | `AsyncBaseTransport \| None` | `None` | Custom underlying transport |

**Behavior**:
1. Sends the original request via the underlying transport
2. If response is 402, parses PaymentRequirements from headers/body
3. Creates payment payload via the registered scheme
4. Retries request with `PAYMENT-SIGNATURE` header
5. If retry also returns 402, passes through as-is (no infinite loop)

## requests APIs

All requests APIs are in `x402.http.clients.requests`. They use `x402ClientSync` (sync).

### `x402_requests(client, **adapter_kwargs)`

Creates a new `requests.Session` with payment adapter pre-configured.

| Parameter | Type | Description |
|-----------|------|-------------|
| `client` | `x402ClientSync \| x402HTTPClientSync` | The sync x402 client instance |
| `**adapter_kwargs` | `Any` | Additional arguments forwarded to `x402HTTPAdapter` |

**Returns**: `requests.Session` with payment handling for `https://` and `http://`.

### `wrapRequestsWithPayment(session, client, **adapter_kwargs)`

Wraps an existing `requests.Session` with payment adapter.

| Parameter | Type | Description |
|-----------|------|-------------|
| `session` | `requests.Session` | Existing session to wrap |
| `client` | `x402ClientSync \| x402HTTPClientSync` | The sync x402 client instance |
| `**adapter_kwargs` | `Any` | Additional arguments forwarded to `x402HTTPAdapter` |

**Returns**: Same `requests.Session` (mutated in place). Mounts adapter for `https://` and `http://`.

### `wrapRequestsWithPaymentFromConfig(session, config, **adapter_kwargs)`

Wraps a session from a `x402ClientConfig` (builds `x402ClientSync` internally).

| Parameter | Type | Description |
|-----------|------|-------------|
| `session` | `requests.Session` | Existing session to wrap |
| `config` | `x402ClientConfig` | Configuration with scheme registrations |
| `**adapter_kwargs` | `Any` | Additional arguments forwarded to `x402HTTPAdapter` |

**Returns**: Same `requests.Session` with payment handling.

### `x402_http_adapter(client, **kwargs)`

Low-level function that returns an `x402HTTPAdapter` for manual `session.mount()`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `client` | `x402ClientSync \| x402HTTPClientSync` | The sync x402 client |
| `**kwargs` | `Any` | Additional arguments forwarded to `x402HTTPAdapter` |

**Returns**: `x402HTTPAdapter` (a `requests.adapters.HTTPAdapter`).

### `x402HTTPAdapter`

The adapter implementation that intercepts 402 responses and handles payments.

| Parameter | Type | Description |
|-----------|------|-------------|
| `client` | `x402ClientSync \| x402HTTPClientSync` | The sync x402 client |
| `**kwargs` | `Any` | Forwarded to `HTTPAdapter.__init__` (e.g., `max_retries`, `pool_connections`) |

**Runtime check**: Raises `TypeError` if passed an async `x402Client` instead of `x402ClientSync`.

**Behavior**:
1. Sends the original request via the standard HTTPAdapter
2. If response is 402, parses PaymentRequirements from headers/body
3. Creates payment payload synchronously via the registered scheme
4. Clones request with `PAYMENT-SIGNATURE` header and `Payment-Retry: 1` marker
5. Retries request; if retry returns 402, passes through as-is

## ClientAvmSigner Implementation

The signer protocol that both httpx and requests clients depend on:

```python
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

### Encoding Boundaries

The x402 SDK passes raw msgpack bytes. Python algosdk (v2.11.1) uses base64 strings. The conversion happens inside `sign_transactions()`:

| Direction | Code |
|-----------|------|
| Raw bytes to algosdk | `encoding.msgpack_decode(base64.b64encode(raw).decode())` |
| algosdk to raw bytes | `base64.b64decode(encoding.msgpack_encode(obj))` |
| Private key for signing | `base64.b64encode(secret_key).decode()` |

### Complete Implementation

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

## Registration Functions

### `register_exact_avm_client(client, signer, networks=None, algod_url=None)`

Registers AVM payment scheme on an x402 client (works with both async and sync).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `x402Client \| x402ClientSync` | required | The x402 client instance |
| `signer` | `ClientAvmSigner` | required | Signer implementation |
| `networks` | `str \| list[str] \| None` | `None` | Default: registers `"algorand:*"` wildcard + V1 names |
| `algod_url` | `str \| None` | `None` | Custom algod endpoint |

### Network Registration Behavior

By default, `register_exact_avm_client` registers:
- V2: `"algorand:*"` wildcard (matches any Algorand CAIP-2 network)
- V1: All legacy network names (`"algorand-mainnet"`, `"algorand-testnet"`)

For specific networks:
```python
register_exact_avm_client(x402, signer, networks="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=")
```

## Error Classes

### httpx Errors

| Error | Description |
|-------|-------------|
| `PaymentError` | Base class for all payment errors |
| `PaymentAlreadyAttemptedError` | Payment retry already attempted (prevents infinite loop) |
| `MissingRequestConfigError` | Missing request configuration |

### requests Errors

| Error | Description |
|-------|-------------|
| `PaymentError` | Payment handling failed |
| `TypeError` | Passed async `x402Client` instead of `x402ClientSync` |

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AVM_PRIVATE_KEY` | Base64-encoded 64-byte key (32-byte seed + 32-byte pubkey) | `base64(seed \|\| pubkey)` |
| `RESOURCE_URL` | The paid endpoint URL | `https://api.example.com/paid` |
| `ALGOD_TESTNET_URL` | Custom algod testnet endpoint (optional) | `https://testnet-api.algonode.cloud` |
| `ALGOD_MAINNET_URL` | Custom algod mainnet endpoint (optional) | `https://mainnet-api.algonode.cloud` |

### Private Key Format

The `AVM_PRIVATE_KEY` is a Base64-encoded 64-byte key:
- First 32 bytes: Ed25519 seed (private key)
- Last 32 bytes: Ed25519 public key
- Address derivation: `encoding.encode_address(secret_key[32:])`

## Payment Flow

1. The HTTP client sends a GET request to the resource URL
2. If the server returns HTTP 402, the transport/adapter intercepts the response
3. It parses the `PaymentRequired` data from response headers (V2) or body (V1)
4. The registered `ExactAvmScheme` creates an atomic transaction group (ASA transfer) and signs it via the signer
5. Payment headers are added to a retry request
6. The server validates payment and returns the resource

## Sync vs Async Comparison

| Feature | httpx (async) | requests (sync) |
|---------|---------------|-----------------|
| x402 Client | `x402Client` | `x402ClientSync` |
| Convenience | `x402HttpxClient(x402)` | `x402_requests(x402)` |
| Wrap existing | `wrapHttpxWithPayment(x402)` | `wrapRequestsWithPayment(session, x402)` |
| From config | `wrapHttpxWithPaymentFromConfig(config)` | `wrapRequestsWithPaymentFromConfig(session, config)` |
| Low-level | `x402_httpx_transport(x402)` | `x402_http_adapter(x402)` |
| Transport class | `x402AsyncTransport` | `x402HTTPAdapter` |
| Context manager | `async with ... as client:` | `with ... as session:` |
| Payment creation | `await client.create_payment_payload(...)` | `client.create_payment_payload(...)` |

## pip Install Commands

```bash
# httpx (async) + Algorand
pip install "x402-avm[httpx,avm]"

# requests (sync) + Algorand
pip install "x402-avm[requests,avm]"

# Both clients + Algorand
pip install "x402-avm[httpx,requests,avm]"

# Everything
pip install "x402-avm[avm,httpx,requests]"
```

## External Resources

- [x402-avm on PyPI](https://pypi.org/project/x402-avm/)
- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402 Algorand Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [httpx Documentation](https://www.python-httpx.org/)
- [requests Documentation](https://docs.python-requests.org/)
- [py-algorand-sdk Documentation](https://py-algorand-sdk.readthedocs.io/)
- [Coinbase x402 Specification](https://github.com/coinbase/x402)
