# x402-avm Python Package Reference

Detailed reference for the `x402-avm` Python package covering package structure, extras, async/sync variants, signer protocols, registration functions, constants, utilities, and algosdk encoding.

## Package Structure

The package is published on PyPI as `x402-avm` but all imports use the `x402` namespace:

```
x402/
  __init__.py                  # x402Client, x402ClientSync, x402Facilitator, etc.
  server.py                    # x402ResourceServer, x402ResourceServerSync
  schemas.py                   # AssetAmount, Network, PaymentRequirements, etc.
  http/
    __init__.py                # HTTPFacilitatorClient, HTTPFacilitatorClientSync, PaymentOption, etc.
    types.py                   # RouteConfig, RoutesConfig, FacilitatorConfig
    clients/
      __init__.py              # Lazy imports for httpx/requests
      httpx.py                 # x402HttpxClient, wrapHttpxWithPayment, etc.
      requests.py              # x402_requests, wrapRequestsWithPayment, etc.
    middleware/
      __init__.py              # Lazy imports for fastapi/flask
      fastapi.py               # PaymentMiddlewareASGI, payment_middleware, etc.
      flask.py                 # PaymentMiddleware, payment_middleware, etc.
  mechanisms/
    avm/
      __init__.py              # Re-exports constants
      constants.py             # Network IDs, USDC config, algod URLs
      signer.py                # ClientAvmSigner, FacilitatorAvmSigner Protocols
      utils.py                 # Address validation, encoding, network utils
      exact/
        __init__.py            # ExactAvmClientScheme, ExactAvmServerScheme, etc.
        register.py            # register_exact_avm_client, register_exact_avm_server, etc.
    evm/                       # EVM mechanism (same structure)
    svm/                       # SVM mechanism (same structure)
```

## Extras

| Extra | Installs | Use Case |
|-------|----------|----------|
| `[avm]` | `py-algorand-sdk>=2.0.0` | Algorand transaction signing |
| `[evm]` | `web3`, `eth-account` | Ethereum/EVM transaction signing |
| `[svm]` | `solders`, `solana-py` | Solana/SVM transaction signing |
| `[fastapi]` | `fastapi[standard]>=0.115.0`, `starlette>=0.27.0` | FastAPI async middleware |
| `[flask]` | `flask>=3.0.0` | Flask sync middleware |
| `[httpx]` | `httpx>=0.28.1` | Async HTTP client |
| `[requests]` | `requests>=2.31.0` | Sync HTTP client |
| `[mechanisms]` | All mechanism extras | All blockchain mechanisms |
| `[clients]` | `httpx`, `requests` | All HTTP clients |
| `[servers]` | `fastapi`, `flask` | All server frameworks |
| `[extensions]` | Extensions dependencies | Optional extensions |
| `[all]` | Everything | Full installation |

Installation examples:

```bash
pip install "x402-avm[avm]"
pip install "x402-avm[fastapi,avm]"
pip install "x402-avm[flask,avm]"
pip install "x402-avm[httpx,avm]"
pip install "x402-avm[requests,avm]"
pip install "x402-avm[avm,httpx,requests]"
```

## Async vs Sync Component Table

| Component | Async (FastAPI/httpx) | Sync (Flask/requests) |
|-----------|----------------------|----------------------|
| x402 Client | `x402Client` | `x402ClientSync` |
| Resource Server | `x402ResourceServer` | `x402ResourceServerSync` |
| Facilitator Client | `HTTPFacilitatorClient` | `HTTPFacilitatorClientSync` |
| HTTP Resource Server | `x402HTTPResourceServer` | `x402HTTPResourceServerSync` |
| HTTP Client wrapper | `x402HTTPClient` | `x402HTTPClientSync` |
| Middleware (FastAPI) | `PaymentMiddlewareASGI` | N/A |
| Middleware (Flask) | N/A | `PaymentMiddleware` |
| HTTP Client (httpx) | `x402HttpxClient` | N/A |
| HTTP Client (requests) | N/A | `x402_requests` |
| Payment info storage | `request.state.payment_payload` | `flask.g.payment_payload` |

## ClientAvmSigner Protocol

Defined in `x402.mechanisms.avm.signer`. Structural typing -- no inheritance required.

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
        """Sign specified transactions in a group.

        Args:
            unsigned_txns: Raw msgpack-encoded unsigned transactions.
            indexes_to_sign: Indexes this signer should sign.

        Returns:
            Parallel list: signed bytes at signed indexes, None elsewhere.
        """
        ...
```

### Implementation Notes

- `unsigned_txns` contains raw msgpack bytes, not base64 strings
- Convert at boundary: `base64.b64encode(txn_bytes).decode()` before `msgpack_decode`
- `Transaction.sign(key)` expects base64-encoded private key string
- Convert back: `base64.b64decode(msgpack_encode(signed))` to return raw bytes

## FacilitatorAvmSigner Protocol

Defined in `x402.mechanisms.avm.signer`. Required for facilitator services.

```python
class FacilitatorAvmSigner(Protocol):
    def get_addresses(self) -> list[str]: ...
    def sign_transaction(self, txn_bytes: bytes, fee_payer: str, network: str) -> bytes: ...
    def sign_group(self, group_bytes: list[bytes], fee_payer: str, indexes_to_sign: list[int], network: str) -> list[bytes]: ...
    def simulate_group(self, group_bytes: list[bytes], network: str) -> None: ...
    def send_group(self, group_bytes: list[bytes], network: str) -> str: ...
    def confirm_transaction(self, txid: str, network: str, rounds: int = 4) -> None: ...
```

### Implementation Patterns

| Method | Key Pattern |
|--------|-------------|
| `simulate_group` | Wrap unsigned `Transaction` with `SignedTransaction(txn, None)`, use `allow_empty_signatures=True` |
| `send_group` | Use `send_raw_transaction(base64.b64encode(b"".join(group_bytes)))` |
| `confirm_transaction` | Use `transaction.wait_for_confirmation(client, txid, rounds)` |

## Registration Functions

### `register_exact_avm_client(client, signer, networks=None, algod_url=None)`

Registers AVM payment scheme on an x402 client.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `x402Client \| x402ClientSync` | required | The x402 client instance |
| `signer` | `ClientAvmSigner` | required | Signer implementation |
| `networks` | `str \| list[str] \| None` | `None` | Specific networks; default registers `"algorand:*"` wildcard + V1 names |
| `algod_url` | `str \| None` | `None` | Custom algod endpoint |

### `register_exact_avm_server(server)`

Registers AVM scheme on a resource server.

| Parameter | Type | Description |
|-----------|------|-------------|
| `server` | `x402ResourceServer \| x402ResourceServerSync` | The resource server |

### `register_exact_avm_facilitator(facilitator, signer, networks)`

Registers AVM scheme on a facilitator.

| Parameter | Type | Description |
|-----------|------|-------------|
| `facilitator` | `x402Facilitator` | The facilitator instance |
| `signer` | `FacilitatorAvmSigner` | Facilitator signer implementation |
| `networks` | `list[str]` | CAIP-2 network identifiers to support |

## Constants

Defined in `x402.mechanisms.avm.constants`:

### Network Identifiers

| Constant | Value |
|----------|-------|
| `ALGORAND_MAINNET_CAIP2` | `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` |
| `ALGORAND_TESTNET_CAIP2` | `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` |
| `SUPPORTED_NETWORKS` | `[MAINNET_CAIP2, TESTNET_CAIP2]` |
| `MAINNET_GENESIS_HASH` | `"wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` |
| `TESTNET_GENESIS_HASH` | `"SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` |
| `V1_NETWORKS` | `["algorand-mainnet", "algorand-testnet"]` |

### USDC Configuration

| Constant | Value |
|----------|-------|
| `USDC_MAINNET_ASA_ID` | `31566704` |
| `USDC_TESTNET_ASA_ID` | `10458941` |
| `DEFAULT_DECIMALS` | `6` |

### Algod Endpoints

| Constant | Default Value |
|----------|---------------|
| `MAINNET_ALGOD_URL` | env `ALGOD_MAINNET_URL` or `"https://mainnet-api.algonode.cloud"` |
| `TESTNET_ALGOD_URL` | env `ALGOD_TESTNET_URL` or `"https://testnet-api.algonode.cloud"` |
| `FALLBACK_ALGOD_MAINNET` | `"https://mainnet-api.algonode.cloud"` |
| `FALLBACK_ALGOD_TESTNET` | `"https://testnet-api.algonode.cloud"` |

### Transaction Limits

| Constant | Value |
|----------|-------|
| `MAX_GROUP_SIZE` | `16` |
| `MIN_TXN_FEE` | `1000` (microAlgos) |

## Utility Functions

Defined in `x402.mechanisms.avm.utils`:

| Function | Signature | Returns |
|----------|-----------|---------|
| `is_valid_address(addr)` | `str -> bool` | Whether address is valid 58-char Algorand address |
| `to_atomic_amount(amount)` | `float -> int` | Decimal to atomic units (e.g., 1.50 -> 1500000) |
| `from_atomic_amount(amount)` | `int -> float` | Atomic units to decimal (e.g., 1500000 -> 1.5) |
| `decode_transaction_bytes(raw)` | `bytes -> DecodedTransactionInfo` | Decoded transaction details |
| `decode_base64_transaction(b64)` | `str -> DecodedTransactionInfo` | Decode from base64 string |
| `decode_payment_group(group, index)` | `list[str], int -> PaymentGroupInfo` | Full group analysis |
| `encode_transaction_group(txns)` | `list[bytes] -> list[str]` | Encode raw bytes to base64 strings |
| `normalize_network(network)` | `str -> str` | Normalize V1 name to CAIP-2 |
| `is_valid_network(network)` | `str -> bool` | Check if network is recognized |
| `get_network_config(network)` | `str -> dict` | Full config for network |
| `get_usdc_asa_id(network)` | `str -> int` | USDC ASA ID for network |
| `get_genesis_hash(network)` | `str -> str` | Genesis hash for network |
| `network_from_genesis_hash(hash)` | `str -> str` | CAIP-2 from genesis hash |
| `validate_no_security_risks(info)` | `DecodedTransactionInfo -> str \| None` | Error code or None |
| `validate_fee_payer_transaction(info, addr)` | `DecodedTransactionInfo, str -> str \| None` | Error code or None |
| `is_blocked_transaction_type(type)` | `str -> bool` | Whether type is blocked (e.g., keyreg) |

## algosdk Encoding Notes (v2.11.1)

The Python `algosdk` has different encoding conventions than TypeScript algosdk:

| Operation | Python algosdk | TypeScript algosdk |
|-----------|---------------|-------------------|
| `msgpack_decode(s)` | Expects **base64 string** | N/A (uses `decodeUnsignedTransaction(Uint8Array)`) |
| `msgpack_encode(obj)` | Returns **base64 string** | N/A (uses `txn.toByte()` returning `Uint8Array`) |
| `Transaction.sign(key)` | Expects **base64 string** key | `signTransaction(txn, Uint8Array)` |
| SDK protocol | Passes **raw msgpack bytes** | Passes **raw `Uint8Array`** |

Boundary conversions:

```python
# Raw bytes -> algosdk object
txn_obj = encoding.msgpack_decode(base64.b64encode(raw_bytes).decode("utf-8"))

# algosdk object -> raw bytes
raw_bytes = base64.b64decode(encoding.msgpack_encode(txn_obj))
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AVM_PRIVATE_KEY` | Base64-encoded 64-byte key (32-byte seed + 32-byte pubkey) | Required |
| `ALGOD_MAINNET_URL` | Custom algod mainnet endpoint | `https://mainnet-api.algonode.cloud` |
| `ALGOD_TESTNET_URL` | Custom algod testnet endpoint | `https://testnet-api.algonode.cloud` |
| `INDEXER_MAINNET_URL` | Custom indexer mainnet endpoint | `https://mainnet-idx.algonode.cloud` |
| `INDEXER_TESTNET_URL` | Custom indexer testnet endpoint | `https://testnet-idx.algonode.cloud` |
| `ALGOD_SERVER` | Algod URL for facilitator examples | N/A |
| `ALGOD_TOKEN` | Algod token for facilitator examples | N/A |

### Private Key Format

The `AVM_PRIVATE_KEY` is a Base64-encoded 64-byte key:
- First 32 bytes: Ed25519 seed (private key)
- Last 32 bytes: Ed25519 public key
- Address derivation: `encoding.encode_address(secret_key[32:])`

## Payment Flow

```
Client -> Resource Server -> Facilitator -> Algorand Network
  |          |                  |                |
  | 1. GET   |                  |                |
  |--------->|                  |                |
  | 2. 402   |                  |                |
  |<---------|                  |                |
  | 3. Build |                  |                |
  |   payload|                  |                |
  | 4. GET + |                  |                |
  | PAYMENT- |                  |                |
  | SIGNATURE|                  |                |
  |--------->| 5. verify()      |                |
  |          |----------------->| 6. simulate    |
  |          |                  |--------------->|
  |          |                  |<---------------|
  |          |<-----------------|                |
  |          | 7. settle()      |                |
  |          |----------------->| 8. sign + send |
  |          |                  |--------------->|
  |          |                  |<---------------|
  |          |<-----------------| 9. txId        |
  | 10. 200  |                  |                |
  |<---------|                  |                |
```

## Testing Notes

- Use Algorand TestNet for development with free test ALGO from the [Algorand Faucet](https://bank.testnet.algorand.network/)
- USDC on TestNet uses ASA ID `10458941` -- ensure receiver has opted in
- Simulation (`simulate_group`) validates transactions without submitting
- Algorand has instant finality -- once confirmed, transactions are permanent
- AlgoNode public endpoints require no authentication token

## External Resources

- [x402-avm on PyPI](https://pypi.org/project/x402-avm/)
- [x402-avm GitHub Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/)
- [x402-avm Examples](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402 Algorand Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [Algorand Developer Portal](https://dev.algorand.co/)
- [py-algorand-sdk Documentation](https://py-algorand-sdk.readthedocs.io/)
- [Coinbase x402 Specification](https://github.com/coinbase/x402)
