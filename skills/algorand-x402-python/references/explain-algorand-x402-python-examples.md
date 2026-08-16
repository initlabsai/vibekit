# x402-avm Python AVM Mechanism Examples

## ClientAvmSigner Protocol

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
        """Sign specified transactions in a group.

        Args:
            unsigned_txns: List of unsigned transaction bytes (msgpack encoded).
            indexes_to_sign: Indexes of transactions this signer should sign.

        Returns:
            List parallel to unsigned_txns, with signed bytes at
            indexes_to_sign and None elsewhere.
        """
        ...
```

## FacilitatorAvmSigner Protocol

```python
from x402.mechanisms.avm.signer import FacilitatorAvmSigner

class FacilitatorAvmSigner(Protocol):
    def get_addresses(self) -> list[str]:
        """Get all managed fee payer addresses."""
        ...

    def sign_transaction(
        self, txn_bytes: bytes, fee_payer: str, network: str,
    ) -> bytes:
        """Sign a single transaction with the fee payer's key."""
        ...

    def sign_group(
        self,
        group_bytes: list[bytes],
        fee_payer: str,
        indexes_to_sign: list[int],
        network: str,
    ) -> list[bytes]:
        """Sign specified transactions in a group."""
        ...

    def simulate_group(
        self, group_bytes: list[bytes], network: str,
    ) -> None:
        """Simulate a transaction group (raises on failure)."""
        ...

    def send_group(
        self, group_bytes: list[bytes], network: str,
    ) -> str:
        """Send a transaction group, returns txid."""
        ...

    def confirm_transaction(
        self, txid: str, network: str, rounds: int = 4,
    ) -> None:
        """Wait for transaction confirmation."""
        ...
```

## Client Signer Implementation

```python
import os
import base64
from x402.mechanisms.avm.signer import ClientAvmSigner
from algosdk import encoding


class PrivateKeySigner:
    """ClientAvmSigner implementation using a base64-encoded private key."""

    def __init__(self, private_key_b64: str):
        self._secret_key = base64.b64decode(private_key_b64)
        if len(self._secret_key) != 64:
            raise ValueError(
                f"Invalid key length: expected 64, got {len(self._secret_key)}"
            )
        self._address = encoding.encode_address(self._secret_key[32:])
        self._signing_key = base64.b64encode(self._secret_key).decode()

    @property
    def address(self) -> str:
        return self._address

    def sign_transactions(
        self,
        unsigned_txns: list[bytes],
        indexes_to_sign: list[int],
    ) -> list[bytes | None]:
        result: list[bytes | None] = []
        for i, txn_bytes in enumerate(unsigned_txns):
            if i not in indexes_to_sign:
                result.append(None)
                continue

            b64_txn = base64.b64encode(txn_bytes).decode("utf-8")
            txn_obj = encoding.msgpack_decode(b64_txn)
            signed_txn = txn_obj.sign(self._signing_key)
            signed_b64 = encoding.msgpack_encode(signed_txn)
            signed_bytes = base64.b64decode(signed_b64)
            result.append(signed_bytes)
        return result


signer = PrivateKeySigner(os.environ["AVM_PRIVATE_KEY"])
print(f"Signer address: {signer.address}")
```

## Facilitator Signer Implementation

```python
import base64
from x402.mechanisms.avm.signer import FacilitatorAvmSigner
from x402.mechanisms.avm.constants import (
    ALGORAND_TESTNET_CAIP2,
    ALGORAND_MAINNET_CAIP2,
    NETWORK_CONFIGS,
)
from algosdk import encoding, transaction
from algosdk.v2client import algod


class AlgorandFacilitatorSigner:
    """Production FacilitatorAvmSigner implementation."""

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

    def sign_transaction(
        self, txn_bytes: bytes, fee_payer: str, network: str,
    ) -> bytes:
        b64_txn = base64.b64encode(txn_bytes).decode("utf-8")
        txn_obj = encoding.msgpack_decode(b64_txn)
        signed = txn_obj.sign(self._signing_key)
        return base64.b64decode(encoding.msgpack_encode(signed))

    def sign_group(
        self,
        group_bytes: list[bytes],
        fee_payer: str,
        indexes_to_sign: list[int],
        network: str,
    ) -> list[bytes]:
        result = list(group_bytes)
        for i in indexes_to_sign:
            result[i] = self.sign_transaction(group_bytes[i], fee_payer, network)
        return result

    def simulate_group(self, group_bytes: list[bytes], network: str) -> None:
        client = self._get_client(network)
        stxns = []
        for txn_bytes in group_bytes:
            b64 = base64.b64encode(txn_bytes).decode("utf-8")
            obj = encoding.msgpack_decode(b64)
            if isinstance(obj, transaction.SignedTransaction):
                stxns.append(obj)
            elif isinstance(obj, transaction.Transaction):
                stxns.append(transaction.SignedTransaction(obj, None))
            else:
                stxns.append(obj)

        request = transaction.SimulateRequest(
            txn_groups=[
                transaction.SimulateRequestTransactionGroup(txns=stxns)
            ],
            allow_empty_signatures=True,
        )
        result = client.simulate_raw_transactions(request)
        for group in result.get("txn-groups", []):
            if group.get("failure-message"):
                raise Exception(f"Simulation failed: {group['failure-message']}")

    def send_group(self, group_bytes: list[bytes], network: str) -> str:
        client = self._get_client(network)
        raw = base64.b64encode(b"".join(group_bytes))
        return client.send_raw_transaction(raw)

    def confirm_transaction(
        self, txid: str, network: str, rounds: int = 4,
    ) -> None:
        client = self._get_client(network)
        transaction.wait_for_confirmation(client, txid, rounds)


import os

signer = AlgorandFacilitatorSigner(
    private_key_b64=os.environ["AVM_PRIVATE_KEY"],
    algod_url="https://testnet-api.algonode.cloud",
)
print(f"Fee payer addresses: {signer.get_addresses()}")
```

## Network Constants

```python
from x402.mechanisms.avm.constants import (
    ALGORAND_MAINNET_CAIP2,
    ALGORAND_TESTNET_CAIP2,
    SUPPORTED_NETWORKS,
    MAINNET_GENESIS_HASH,
    TESTNET_GENESIS_HASH,
    V1_NETWORKS,
    V1_TO_V2_NETWORK_MAP,
    V2_TO_V1_NETWORK_MAP,
)
```

## USDC Configuration

```python
from x402.mechanisms.avm.constants import (
    USDC_MAINNET_ASA_ID,
    USDC_TESTNET_ASA_ID,
    DEFAULT_DECIMALS,
    NETWORK_CONFIGS,
)

testnet_config = NETWORK_CONFIGS[ALGORAND_TESTNET_CAIP2]
usdc_info = testnet_config["default_asset"]
```

## Algod Endpoints

```python
from x402.mechanisms.avm.constants import (
    MAINNET_ALGOD_URL,
    TESTNET_ALGOD_URL,
    FALLBACK_ALGOD_MAINNET,
    FALLBACK_ALGOD_TESTNET,
    MAINNET_INDEXER_URL,
    TESTNET_INDEXER_URL,
)
```

## Transaction Limits

```python
from x402.mechanisms.avm.constants import (
    MAX_GROUP_SIZE,
    MIN_TXN_FEE,
)
```

## Address Validation

```python
from x402.mechanisms.avm.constants import AVM_ADDRESS_REGEX
from x402.mechanisms.avm.utils import is_valid_address
import re

is_valid = bool(re.match(AVM_ADDRESS_REGEX, some_address))
is_valid_address("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
```

## Amount Conversion

```python
from x402.mechanisms.avm.utils import to_atomic_amount, from_atomic_amount

to_atomic_amount(1.50)
from_atomic_amount(1500000)
```

## Transaction Encoding/Decoding

```python
from x402.mechanisms.avm.utils import (
    decode_transaction_bytes,
    decode_base64_transaction,
    decode_payment_group,
    encode_transaction_group,
)

info = decode_transaction_bytes(raw_txn_bytes)
print(info.type, info.sender, info.fee, info.is_signed)

group_info = decode_payment_group(
    payment_group=["base64txn1...", "base64txn2..."],
    payment_index=0,
)
print(group_info.transactions, group_info.group_id, group_info.total_fee)

encoded = encode_transaction_group([raw_bytes_1, raw_bytes_2])
```

## Network Utilities

```python
from x402.mechanisms.avm.utils import (
    normalize_network,
    is_valid_network,
    get_network_config,
    get_usdc_asa_id,
    get_genesis_hash,
    network_from_genesis_hash,
)

normalize_network("algorand-testnet")
is_valid_network("algorand-testnet")
config = get_network_config("algorand-testnet")
get_usdc_asa_id("algorand-testnet")
network_from_genesis_hash("SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=")
```

## Security Validation

```python
from x402.mechanisms.avm.utils import (
    validate_no_security_risks,
    validate_fee_payer_transaction,
    is_blocked_transaction_type,
)

info = decode_transaction_bytes(txn_bytes)
error_code = validate_no_security_risks(info)
error_code = validate_fee_payer_transaction(info, expected_fee_payer="ABC...")
is_blocked_transaction_type("keyreg")
```

## Simple Payment Group

```python
import base64
from algosdk import transaction, encoding
from algosdk.v2client import algod
from x402.mechanisms.avm.constants import (
    ALGORAND_TESTNET_CAIP2,
    USDC_TESTNET_ASA_ID,
    NETWORK_CONFIGS,
)


def create_simple_payment(sender: str, receiver: str, amount: int) -> list[bytes]:
    config = NETWORK_CONFIGS[ALGORAND_TESTNET_CAIP2]
    client = algod.AlgodClient("", config["algod_url"])
    params = client.suggested_params()

    txn = transaction.AssetTransferTxn(
        sender=sender,
        sp=params,
        receiver=receiver,
        amt=amount,
        index=USDC_TESTNET_ASA_ID,
    )
    return [base64.b64decode(encoding.msgpack_encode(txn))]
```

## Fee-Abstracted Payment Group

```python
import base64
from algosdk import transaction, encoding
from algosdk.v2client import algod
from x402.mechanisms.avm.constants import (
    ALGORAND_TESTNET_CAIP2,
    USDC_TESTNET_ASA_ID,
    MIN_TXN_FEE,
    NETWORK_CONFIGS,
)
from x402.mechanisms.avm.utils import encode_transaction_group


def create_fee_abstracted_payment(
    sender: str, receiver: str, fee_payer: str, amount: int,
) -> dict:
    config = NETWORK_CONFIGS[ALGORAND_TESTNET_CAIP2]
    client = algod.AlgodClient("", config["algod_url"])
    params = client.suggested_params()

    payment_params = transaction.SuggestedParams(
        fee=0, first=params.first, last=params.last,
        gh=params.gh, gen=params.gen, flat_fee=True,
    )
    payment_txn = transaction.AssetTransferTxn(
        sender=sender, sp=payment_params, receiver=receiver,
        amt=amount, index=USDC_TESTNET_ASA_ID,
    )

    fee_params = transaction.SuggestedParams(
        fee=MIN_TXN_FEE * 2, first=params.first, last=params.last,
        gh=params.gh, gen=params.gen, flat_fee=True,
    )
    fee_payer_txn = transaction.PaymentTxn(
        sender=fee_payer, sp=fee_params, receiver=fee_payer, amt=0,
    )

    gid = transaction.calculate_group_id([payment_txn, fee_payer_txn])
    payment_txn.group = gid
    fee_payer_txn.group = gid

    payment_bytes = base64.b64decode(encoding.msgpack_encode(payment_txn))
    fee_payer_bytes = base64.b64decode(encoding.msgpack_encode(fee_payer_txn))

    return {
        "paymentGroup": encode_transaction_group([payment_bytes, fee_payer_bytes]),
        "paymentIndex": 0,
        "rawBytes": [payment_bytes, fee_payer_bytes],
    }
```

## ExactAvmScheme Client Registration

```python
from x402 import x402Client
from x402.mechanisms.avm.exact import register_exact_avm_client

client = x402Client()
register_exact_avm_client(client, signer)
```

## ExactAvmScheme Server Registration

```python
from x402 import x402ResourceServer
from x402.mechanisms.avm.exact import register_exact_avm_server

server = x402ResourceServer(facilitator_url="https://facilitator.example.com")
register_exact_avm_server(server)
```

## ExactAvmScheme Facilitator Registration

```python
from x402 import x402Facilitator
from x402.mechanisms.avm.exact import register_exact_avm_facilitator
from x402.mechanisms.avm import ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2

facilitator = x402Facilitator()

register_exact_avm_facilitator(
    facilitator, signer, networks=[ALGORAND_TESTNET_CAIP2]
)

register_exact_avm_facilitator(
    facilitator, signer, networks=[ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2]
)
```

## algosdk Encoding Boundary Conversions

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

## Complete Example: FastAPI Facilitator Service

```python
import os
import base64
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from x402 import x402Facilitator
from x402.mechanisms.avm.exact import register_exact_avm_facilitator
from x402.mechanisms.avm import ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2
from x402.mechanisms.avm.constants import NETWORK_CONFIGS
from algosdk import encoding, transaction
from algosdk.v2client import algod

app = FastAPI(title="x402-avm Facilitator Service")

SECRET_KEY = base64.b64decode(os.environ["AVM_PRIVATE_KEY"])
ADDRESS = encoding.encode_address(SECRET_KEY[32:])
SIGNING_KEY = base64.b64encode(SECRET_KEY).decode()


class FacilitatorSigner:
    def __init__(self):
        self._clients: dict[str, algod.AlgodClient] = {}

    def _client(self, network: str) -> algod.AlgodClient:
        if network not in self._clients:
            config = NETWORK_CONFIGS.get(network, {})
            url = config.get("algod_url", "https://testnet-api.algonode.cloud")
            self._clients[network] = algod.AlgodClient("", url)
        return self._clients[network]

    def get_addresses(self) -> list[str]:
        return [ADDRESS]

    def sign_transaction(self, txn_bytes: bytes, fee_payer: str, network: str) -> bytes:
        b64 = base64.b64encode(txn_bytes).decode()
        txn_obj = encoding.msgpack_decode(b64)
        signed = txn_obj.sign(SIGNING_KEY)
        return base64.b64decode(encoding.msgpack_encode(signed))

    def sign_group(self, group_bytes, fee_payer, indexes, network):
        result = list(group_bytes)
        for i in indexes:
            result[i] = self.sign_transaction(group_bytes[i], fee_payer, network)
        return result

    def simulate_group(self, group_bytes, network):
        client = self._client(network)
        stxns = []
        for txn_bytes in group_bytes:
            b64 = base64.b64encode(txn_bytes).decode()
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
        client = self._client(network)
        return client.send_raw_transaction(
            base64.b64encode(b"".join(group_bytes))
        )

    def confirm_transaction(self, txid, network, rounds=4):
        client = self._client(network)
        transaction.wait_for_confirmation(client, txid, rounds)


signer = FacilitatorSigner()
facilitator = x402Facilitator()
register_exact_avm_facilitator(
    facilitator, signer,
    networks=[ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2],
)


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
