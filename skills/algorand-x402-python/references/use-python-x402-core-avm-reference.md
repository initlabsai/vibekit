# x402-avm Python Core and AVM Mechanism Reference

Detailed API reference for the x402-avm Python package core components and AVM mechanism.

## Core Package Exports

### Client Components

| Export | Import | Description |
|--------|--------|-------------|
| `x402Client` | `from x402 import x402Client` | Async client that handles 402 responses automatically |
| `x402ClientSync` | `from x402 import x402ClientSync` | Synchronous variant of x402Client |

### Server Components

| Export | Import | Description |
|--------|--------|-------------|
| `x402ResourceServer` | `from x402 import x402ResourceServer` | Async resource server with payment middleware |
| `x402ResourceServerSync` | `from x402 import x402ResourceServerSync` | Synchronous variant |

### Facilitator Components

| Export | Import | Description |
|--------|--------|-------------|
| `x402Facilitator` | `from x402 import x402Facilitator` | Async facilitator for payment verification and settlement |
| `x402FacilitatorSync` | `from x402 import x402FacilitatorSync` | Synchronous variant |

### Schema Types

| Export | Import | Description |
|--------|--------|-------------|
| `PaymentRequirements` | `from x402.schemas import PaymentRequirements` | V2 payment requirements structure |
| `PaymentPayload` | `from x402.schemas import PaymentPayload` | Payment payload sent in PAYMENT-SIGNATURE header |
| `Network` | `from x402.schemas import Network` | Network identifier type (CAIP-2 string) |

---

## AVM Mechanism Exports

### Signer Protocols

| Export | Import | Description |
|--------|--------|-------------|
| `ClientAvmSigner` | `from x402.mechanisms.avm.signer import ClientAvmSigner` | Protocol for client-side transaction signing |
| `FacilitatorAvmSigner` | `from x402.mechanisms.avm.signer import FacilitatorAvmSigner` | Protocol for facilitator-side operations |

### Scheme Classes

| Export | Import | Description |
|--------|--------|-------------|
| `ExactAvmScheme` | `from x402.mechanisms.avm.exact import ExactAvmScheme` | Base AVM exact payment scheme |
| `ExactAvmClientScheme` | `from x402.mechanisms.avm.exact import ExactAvmClientScheme` | Client-specific scheme |
| `ExactAvmServerScheme` | `from x402.mechanisms.avm.exact import ExactAvmServerScheme` | Server-specific scheme |
| `ExactAvmFacilitatorScheme` | `from x402.mechanisms.avm.exact import ExactAvmFacilitatorScheme` | Facilitator-specific scheme |

### Registration Functions

| Function | Import | Description |
|----------|--------|-------------|
| `register_exact_avm_client` | `from x402.mechanisms.avm.exact import register_exact_avm_client` | Register AVM on a client |
| `register_exact_avm_server` | `from x402.mechanisms.avm.exact import register_exact_avm_server` | Register AVM on a server |
| `register_exact_avm_facilitator` | `from x402.mechanisms.avm.exact import register_exact_avm_facilitator` | Register AVM on a facilitator |

---

## Constants Reference

### Network Identifiers

| Constant | Value | Import |
|----------|-------|--------|
| `ALGORAND_MAINNET_CAIP2` | `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` | `from x402.mechanisms.avm.constants import ALGORAND_MAINNET_CAIP2` |
| `ALGORAND_TESTNET_CAIP2` | `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` | `from x402.mechanisms.avm.constants import ALGORAND_TESTNET_CAIP2` |
| `SUPPORTED_NETWORKS` | `[MAINNET_CAIP2, TESTNET_CAIP2]` | `from x402.mechanisms.avm.constants import SUPPORTED_NETWORKS` |

### Genesis Hashes

| Constant | Value |
|----------|-------|
| `MAINNET_GENESIS_HASH` | `"wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` |
| `TESTNET_GENESIS_HASH` | `"SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` |

### V1 Compatibility

| Constant | Value | Description |
|----------|-------|-------------|
| `V1_NETWORKS` | `["algorand-mainnet", "algorand-testnet"]` | Legacy network names |
| `V1_TO_V2_NETWORK_MAP` | `{"algorand-mainnet": CAIP2, ...}` | V1 to CAIP-2 mapping |
| `V2_TO_V1_NETWORK_MAP` | `{CAIP2: "algorand-mainnet", ...}` | CAIP-2 to V1 mapping |

### USDC Configuration

| Constant | Value | Description |
|----------|-------|-------------|
| `USDC_MAINNET_ASA_ID` | `31566704` | Mainnet USDC ASA ID |
| `USDC_TESTNET_ASA_ID` | `10458941` | Testnet USDC ASA ID |
| `DEFAULT_DECIMALS` | `6` | USDC decimal places |

### Transaction Limits

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_GROUP_SIZE` | `16` | Maximum transactions in an atomic group |
| `MIN_TXN_FEE` | `1000` | Minimum transaction fee in microAlgos |

### Algod Endpoints

| Constant | Value | Description |
|----------|-------|-------------|
| `FALLBACK_ALGOD_MAINNET` | `"https://mainnet-api.algonode.cloud"` | Default mainnet Algod URL |
| `FALLBACK_ALGOD_TESTNET` | `"https://testnet-api.algonode.cloud"` | Default testnet Algod URL |
| `MAINNET_ALGOD_URL` | `env ALGOD_MAINNET_URL` or fallback | Resolved mainnet URL |
| `TESTNET_ALGOD_URL` | `env ALGOD_TESTNET_URL` or fallback | Resolved testnet URL |
| `MAINNET_INDEXER_URL` | `env` or AlgoNode | Mainnet indexer URL |
| `TESTNET_INDEXER_URL` | `env` or AlgoNode | Testnet indexer URL |

### NETWORK_CONFIGS Structure

```python
NETWORK_CONFIGS = {
    ALGORAND_TESTNET_CAIP2: {
        "algod_url": "https://testnet-api.algonode.cloud",
        "indexer_url": "https://testnet-idx.algonode.cloud",
        "genesis_hash": "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
        "genesis_id": "testnet-v1.0",
        "default_asset": {"asa_id": 10458941, "name": "USDC", "decimals": 6},
    },
    ALGORAND_MAINNET_CAIP2: {
        "algod_url": "https://mainnet-api.algonode.cloud",
        "indexer_url": "https://mainnet-idx.algonode.cloud",
        "genesis_hash": "wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=",
        "genesis_id": "mainnet-v1.0",
        "default_asset": {"asa_id": 31566704, "name": "USDC", "decimals": 6},
    },
}
```

---

## Utility Functions Reference

### Address Validation

| Function | Signature | Description |
|----------|-----------|-------------|
| `is_valid_address` | `(address: str) -> bool` | Validate 58-character Algorand address |

### Amount Conversion

| Function | Signature | Description |
|----------|-----------|-------------|
| `to_atomic_amount` | `(amount: float, decimals: int = 6) -> int` | Convert decimal to atomic units |
| `from_atomic_amount` | `(amount: int, decimals: int = 6) -> float` | Convert atomic units to decimal |

### Transaction Encoding/Decoding

| Function | Signature | Description |
|----------|-----------|-------------|
| `decode_transaction_bytes` | `(raw_bytes: bytes) -> DecodedTransactionInfo` | Decode raw msgpack transaction |
| `decode_base64_transaction` | `(b64_str: str) -> DecodedTransactionInfo` | Decode base64-encoded transaction |
| `decode_payment_group` | `(payment_group: list[str], payment_index: int) -> DecodedGroupInfo` | Decode a full payment group |
| `encode_transaction_group` | `(raw_bytes_list: list[bytes]) -> list[str]` | Encode transaction list to base64 |

### DecodedTransactionInfo Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `str` | Transaction type: `"pay"`, `"axfer"`, `"appl"`, etc. |
| `sender` | `str` | Sender Algorand address |
| `receiver` | `str` or `None` | Receiver address (payments/transfers) |
| `fee` | `int` | Transaction fee in microAlgos |
| `is_signed` | `bool` | Whether the transaction is signed |
| `asset_amount` | `int` or `None` | Asset amount (for asset transfers) |
| `asset_id` | `int` or `None` | ASA ID (for asset transfers) |

### DecodedGroupInfo Fields

| Field | Type | Description |
|-------|------|-------------|
| `transactions` | `list[DecodedTransactionInfo]` | All decoded transactions |
| `group_id` | `str` | Base64-encoded group ID |
| `total_fee` | `int` | Sum of all transaction fees |
| `has_fee_payer` | `bool` | Whether a fee payer transaction is detected |
| `fee_payer_index` | `int` or `None` | Index of the fee payer transaction |

### Network Utilities

| Function | Signature | Description |
|----------|-----------|-------------|
| `normalize_network` | `(network: str) -> str` | Convert V1 name or CAIP-2 to CAIP-2 |
| `is_valid_network` | `(network: str) -> bool` | Check if network is supported |
| `get_network_config` | `(network: str) -> dict` | Get full network configuration |
| `get_usdc_asa_id` | `(network: str) -> int` | Get USDC ASA ID for network |
| `get_genesis_hash` | `(network: str) -> str` | Get genesis hash for network |
| `network_from_genesis_hash` | `(hash: str) -> str` | Resolve CAIP-2 from genesis hash |

### Security Validation

| Function | Signature | Description |
|----------|-----------|-------------|
| `validate_no_security_risks` | `(info: DecodedTransactionInfo) -> str or None` | Check for rekey, close-to, blocked types |
| `validate_fee_payer_transaction` | `(info: DecodedTransactionInfo, expected_fee_payer: str) -> str or None` | Validate fee payer txn structure |
| `is_blocked_transaction_type` | `(type: str) -> bool` | Check if transaction type is blocked |

---

## Encoding Boundary Patterns

The Python `algosdk` (v2.11.1) uses base64 strings at API boundaries, while the x402 SDK protocol uses raw bytes internally:

| Direction | Pattern |
|-----------|---------|
| Raw bytes to algosdk | `encoding.msgpack_decode(base64.b64encode(raw_bytes).decode("utf-8"))` |
| algosdk to raw bytes | `base64.b64decode(encoding.msgpack_encode(obj))` |
| Sign transaction | `txn_obj.sign(base64.b64encode(secret_key).decode())` |
| Address from key | `encoding.encode_address(secret_key[32:])` |

### Comparison with TypeScript algosdk

| Operation | Python algosdk | TypeScript algosdk |
|-----------|---------------|-------------------|
| Decode unsigned txn | `msgpack_decode(base64_string)` | `decodeUnsignedTransaction(Uint8Array)` |
| Encode txn | `msgpack_encode(obj)` returns base64 | `txn.toByte()` returns `Uint8Array` |
| Sign | `txn.sign(base64_key_string)` | `signTransaction(txn, Uint8Array)` |

---

## Fee Abstraction Flow

Fee abstraction uses Algorand atomic transaction groups with pooled fees:

```
Step 1: Create 2-txn atomic group
  Txn 0: USDC transfer (sender -> receiver, fee = 0)
  Txn 1: Self-payment (fee_payer -> fee_payer, fee = 2 * MIN_TXN_FEE)

Step 2: Assign group ID
  gid = calculate_group_id([txn_0, txn_1])
  txn_0.group = gid
  txn_1.group = gid

Step 3: Client signs Txn 0, leaves Txn 1 unsigned
Step 4: Client sends paymentGroup = [signed_txn_0, unsigned_txn_1]
Step 5: Facilitator signs Txn 1, submits atomic group
Step 6: Both execute atomically (all-or-nothing)
```

**Security guarantees:**
- Fee payer Txn 1 must be a self-payment (receiver == sender) with amount == 0
- No rekey, close-to, or other dangerous fields
- Fee is capped at a reasonable maximum
- Atomic group ensures all-or-nothing execution

---

## Installation

```bash
# Core + AVM mechanism
pip install "x402-avm[avm]"

# With web framework
pip install "x402-avm[fastapi,avm]"
pip install "x402-avm[flask,avm]"

# Multi-chain
pip install "x402-avm[avm,httpx,requests]"
```

---

## External Resources

- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402-avm AVM Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [algosdk Python SDK](https://py-algorand-sdk.readthedocs.io/)
- [Algorand Developer Portal](https://developer.algorand.org/)
- [CAIP-2 Chain ID Specification](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md)
