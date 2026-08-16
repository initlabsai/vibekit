# Python x402 Facilitator and Bazaar Discovery Examples

## FacilitatorAvmSigner Protocol

```python
from x402.mechanisms.avm.signer import FacilitatorAvmSigner

# Protocol definition:
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

---

## AlgorandFacilitatorSigner Implementation

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
    """
    Production FacilitatorAvmSigner implementation.

    Key encoding notes (algosdk v2.11.1):
    - msgpack_decode(s) expects base64 string, NOT raw bytes
    - msgpack_encode(obj) returns base64 string, NOT raw bytes
    - Transaction.sign(pk) expects base64 string private key
    - SDK protocol passes raw msgpack bytes between methods
    - Boundary: msgpack_decode(base64.b64encode(raw).decode()) for decode
    - Boundary: base64.b64decode(msgpack_encode(obj)) for encode
    """

    def __init__(self, private_key_b64: str, algod_url: str = "", algod_token: str = ""):
        self._secret_key = base64.b64decode(private_key_b64)
        self._address = encoding.encode_address(self._secret_key[32:])
        self._signing_key = base64.b64encode(self._secret_key).decode()

        # Create algod clients per network
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
        """Sign a single transaction."""
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
        """Sign specified transactions in a group."""
        result = list(group_bytes)
        for i in indexes_to_sign:
            result[i] = self.sign_transaction(group_bytes[i], fee_payer, network)
        return result

    def simulate_group(self, group_bytes: list[bytes], network: str) -> None:
        """Simulate a transaction group.

        Key pattern: wrap unsigned transactions with SignedTransaction(txn, None)
        and use allow_empty_signatures=True.
        """
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
                raise Exception(
                    f"Simulation failed: {group['failure-message']}"
                )

    def send_group(self, group_bytes: list[bytes], network: str) -> str:
        """Send a transaction group.

        Key pattern: use send_raw_transaction(base64.b64encode(b''.join(group_bytes)))
        to avoid decode/re-encode overhead.
        """
        client = self._get_client(network)
        raw = base64.b64encode(b"".join(group_bytes))
        return client.send_raw_transaction(raw)

    def confirm_transaction(
        self, txid: str, network: str, rounds: int = 4,
    ) -> None:
        """Wait for transaction confirmation."""
        client = self._get_client(network)
        transaction.wait_for_confirmation(client, txid, rounds)


# Usage:
import os

signer = AlgorandFacilitatorSigner(
    private_key_b64=os.environ["AVM_PRIVATE_KEY"],
    algod_url="https://testnet-api.algonode.cloud",
)
print(f"Fee payer addresses: {signer.get_addresses()}")
```

---

## Facilitator Registration

```python
from x402 import x402Facilitator
from x402.mechanisms.avm.exact import register_exact_avm_facilitator
from x402.mechanisms.avm import ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2

facilitator = x402Facilitator()

# Single network
register_exact_avm_facilitator(
    facilitator, signer, networks=[ALGORAND_TESTNET_CAIP2]
)

# Multiple networks
register_exact_avm_facilitator(
    facilitator, signer, networks=[ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2]
)
```

---

## Complete FastAPI Facilitator Service

```python
# facilitator_service.py
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

# Build signer
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


# Initialize facilitator
signer = FacilitatorSigner()
facilitator = x402Facilitator()
register_exact_avm_facilitator(
    facilitator,
    signer,
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
        return JSONResponse(
            status_code=400, content={"error": str(e)}
        )


@app.post("/settle")
async def settle(request: Request):
    body = await request.json()
    try:
        result = await facilitator.settle(
            body["paymentPayload"], body["paymentRequirements"]
        )
        return result
    except Exception as e:
        return JSONResponse(
            status_code=400, content={"error": str(e)}
        )


@app.on_event("startup")
async def startup():
    print(f"Facilitator service started")
    print(f"Fee payer address: {ADDRESS}")
    print(f"Networks: Testnet + Mainnet")


# Run: uvicorn facilitator_service:app --port 4000
```

---

## algosdk Encoding Boundary Patterns

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

## Inline FacilitatorSigner (Minimal)

```python
import os
import base64
from algosdk import encoding, transaction
from algosdk.v2client import algod

SECRET = base64.b64decode(os.environ["AVM_PRIVATE_KEY"])
ADDR = encoding.encode_address(SECRET[32:])
KEY = base64.b64encode(SECRET).decode()
CLIENT = algod.AlgodClient("", "https://testnet-api.algonode.cloud")


class MinimalSigner:
    def get_addresses(self):
        return [ADDR]

    def sign_transaction(self, txn_bytes, fee_payer, network):
        obj = encoding.msgpack_decode(base64.b64encode(txn_bytes).decode())
        return base64.b64decode(encoding.msgpack_encode(obj.sign(KEY)))

    def sign_group(self, group_bytes, fee_payer, indexes, network):
        r = list(group_bytes)
        for i in indexes:
            r[i] = self.sign_transaction(group_bytes[i], fee_payer, network)
        return r

    def simulate_group(self, group_bytes, network):
        stxns = []
        for b in group_bytes:
            obj = encoding.msgpack_decode(base64.b64encode(b).decode())
            stxns.append(
                obj if isinstance(obj, transaction.SignedTransaction)
                else transaction.SignedTransaction(obj, None)
            )
        req = transaction.SimulateRequest(
            txn_groups=[transaction.SimulateRequestTransactionGroup(txns=stxns)],
            allow_empty_signatures=True,
        )
        res = CLIENT.simulate_raw_transactions(req)
        for g in res.get("txn-groups", []):
            if g.get("failure-message"):
                raise Exception(g["failure-message"])

    def send_group(self, group_bytes, network):
        return CLIENT.send_raw_transaction(base64.b64encode(b"".join(group_bytes)))

    def confirm_transaction(self, txid, network, rounds=4):
        transaction.wait_for_confirmation(CLIENT, txid, rounds)
```

---

## Declaring Discovery Extension (GET with Query Parameters)

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
# discovery is: {"bazaar": {"info": {...}, "schema": {...}}}
```

---

## Declaring Discovery Extension (POST with JSON Body)

```python
from x402.extensions.bazaar import declare_discovery_extension, OutputConfig

discovery = declare_discovery_extension(
    input={"prompt": "Tell me about Algorand", "max_tokens": 100},
    input_schema={
        "properties": {
            "prompt": {"type": "string", "description": "The text prompt"},
            "max_tokens": {"type": "integer", "description": "Maximum tokens"},
        },
        "required": ["prompt"],
    },
    body_type="json",
    output=OutputConfig(
        example={"text": "Algorand is a...", "tokens_used": 42},
        schema={
            "properties": {
                "text": {"type": "string"},
                "tokens_used": {"type": "integer"},
            },
            "required": ["text"],
        },
    ),
)
```

---

## Minimal Declaration (No Output)

```python
from x402.extensions.bazaar import declare_discovery_extension

discovery = declare_discovery_extension(
    input={"query": "example search term"},
    input_schema={
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
    },
)
```

---

## Route Configuration with Bazaar Discovery (FastAPI)

```python
from x402.extensions.bazaar import declare_discovery_extension, OutputConfig
from x402.http import PaymentOption
from x402.http.types import RouteConfig
from x402.schemas import Network

AVM_NETWORK: Network = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
AVM_ADDRESS = "YOUR_ALGORAND_ADDRESS..."

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
                    schema={
                        "properties": {
                            "weather": {"type": "string"},
                            "temperature": {"type": "number"},
                        },
                        "required": ["weather", "temperature"],
                    },
                ),
            )
        },
    ),
}
```

---

## Multi-Chain Route (Algorand + EVM)

```python
routes = {
    "GET /weather": RouteConfig(
        accepts=[
            PaymentOption(
                scheme="exact",
                pay_to=AVM_ADDRESS,
                price="$0.001",
                network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            ),
            PaymentOption(
                scheme="exact",
                pay_to=EVM_ADDRESS,
                price="$0.001",
                network="eip155:84532",
            ),
        ],
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

---

## Registering Bazaar Extension on Async Server (FastAPI)

```python
from x402.server import x402ResourceServer
from x402.http import FacilitatorConfig, HTTPFacilitatorClient
from x402.extensions.bazaar import bazaar_resource_server_extension
from x402.mechanisms.avm.exact import ExactAvmServerScheme
from x402.schemas import Network

AVM_NETWORK: Network = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="

facilitator = HTTPFacilitatorClient(
    FacilitatorConfig(url="https://x402.org/facilitator")
)
server = x402ResourceServer(facilitator)
server.register(AVM_NETWORK, ExactAvmServerScheme())
server.register_extension(bazaar_resource_server_extension)
```

---

## Registering Bazaar Extension on Sync Server (Flask)

```python
from x402.server import x402ResourceServerSync
from x402.http import FacilitatorConfig, HTTPFacilitatorClientSync
from x402.extensions.bazaar import bazaar_resource_server_extension
from x402.mechanisms.avm.exact import ExactAvmServerScheme
from x402.schemas import Network

AVM_NETWORK: Network = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="

facilitator = HTTPFacilitatorClientSync(
    FacilitatorConfig(url="https://x402.org/facilitator")
)
server = x402ResourceServerSync(facilitator)
server.register(AVM_NETWORK, ExactAvmServerScheme())
server.register_extension(bazaar_resource_server_extension)
```

---

## Extracting Discovery Info (Facilitator Side)

```python
from x402.extensions.bazaar import extract_discovery_info

discovered = extract_discovery_info(
    payment_payload=payment_payload,
    payment_requirements=payment_requirements,
    validate=True,
)

if discovered:
    print(f"Resource URL: {discovered.resource_url}")
    print(f"HTTP Method: {discovered.method}")
    print(f"x402 Version: {discovered.x402_version}")
    print(f"Description: {discovered.description}")
    print(f"MIME Type: {discovered.mime_type}")

    info = discovered.discovery_info
    if hasattr(info.input, "query_params"):
        print(f"Query params: {info.input.query_params}")
    elif hasattr(info.input, "body"):
        print(f"Body: {info.input.body}")

    if info.output:
        print(f"Output example: {info.output.example}")
```

---

## Validating Discovery Extensions

```python
from x402.extensions.bazaar import (
    declare_discovery_extension,
    validate_discovery_extension,
    OutputConfig,
)
from x402.extensions.bazaar.types import parse_discovery_extension

ext_dict = declare_discovery_extension(
    input={"city": "San Francisco"},
    input_schema={
        "properties": {"city": {"type": "string"}},
        "required": ["city"],
    },
    output=OutputConfig(example={"weather": "sunny", "temperature": 70}),
)

extension = parse_discovery_extension(ext_dict["bazaar"])

result = validate_discovery_extension(extension)

if result.valid:
    print("Extension is valid")
else:
    print("Validation errors:", result.errors)
```

---

## Validate and Extract in One Step

```python
from x402.extensions.bazaar import validate_and_extract

result = validate_and_extract(extension_data)

if result.valid and result.info:
    print(f"Method: {result.info.input.method}")
else:
    print("Validation errors:", result.errors)
```

---

## Querying Discovery Resources (Client Side)

```python
from x402.http import HTTPFacilitatorClient, FacilitatorConfig
from x402.extensions.bazaar import with_bazaar, ListDiscoveryResourcesParams

facilitator = HTTPFacilitatorClient(
    FacilitatorConfig(url="https://x402.org/facilitator")
)
client = with_bazaar(facilitator)

response = client.extensions.discovery.list_resources()
for resource in response.resources:
    print(f"URL: {resource.url}")
    print(f"Type: {resource.type}")
    print(f"Metadata: {resource.metadata}")

# Filter and paginate
response = client.extensions.discovery.list_resources(
    ListDiscoveryResourcesParams(type="http", limit=10, offset=0)
)
print(f"Total resources: {response.total}")
```

---

## Complete FastAPI Server with Bazaar Discovery

```python
"""Algorand-gated weather API with Bazaar discovery."""

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

from x402.extensions.bazaar import (
    OutputConfig,
    bazaar_resource_server_extension,
    declare_discovery_extension,
)
from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.http.types import RouteConfig
from x402.mechanisms.avm.exact import ExactAvmServerScheme
from x402.schemas import Network
from x402.server import x402ResourceServer

load_dotenv()

AVM_ADDRESS = os.environ["AVM_ADDRESS"]
AVM_NETWORK: Network = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
FACILITATOR_URL = os.getenv("FACILITATOR_URL", "https://x402.org/facilitator")


class WeatherReport(BaseModel):
    weather: str
    temperature: int


class WeatherResponse(BaseModel):
    report: WeatherReport


app = FastAPI(title="Weather API (x402 + Algorand + Bazaar)")

facilitator = HTTPFacilitatorClient(FacilitatorConfig(url=FACILITATOR_URL))
server = x402ResourceServer(facilitator)
server.register(AVM_NETWORK, ExactAvmServerScheme())
server.register_extension(bazaar_resource_server_extension)

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
        description="Get weather data for a city",
        mime_type="application/json",
        extensions={
            **declare_discovery_extension(
                input={"city": "San Francisco"},
                input_schema={
                    "properties": {
                        "city": {
                            "type": "string",
                            "description": "City name to get weather for",
                        },
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
        },
    ),
}

app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)


@app.get("/weather")
async def get_weather(city: str = "San Francisco") -> WeatherResponse:
    return WeatherResponse(
        report=WeatherReport(weather="sunny", temperature=70)
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=4021)
```

---

## Complete Flask Server with Bazaar Discovery

```python
"""Flask version of the Algorand-gated weather API with Bazaar discovery."""

import os

from dotenv import load_dotenv
from flask import Flask, jsonify

from x402.extensions.bazaar import (
    OutputConfig,
    bazaar_resource_server_extension,
    declare_discovery_extension,
)
from x402.http import FacilitatorConfig, HTTPFacilitatorClientSync, PaymentOption
from x402.http.middleware.flask import payment_middleware
from x402.http.types import RouteConfig
from x402.mechanisms.avm.exact import ExactAvmServerScheme
from x402.schemas import Network
from x402.server import x402ResourceServerSync

load_dotenv()

AVM_ADDRESS = os.environ["AVM_ADDRESS"]
AVM_NETWORK: Network = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="

app = Flask(__name__)

facilitator = HTTPFacilitatorClientSync(
    FacilitatorConfig(url=os.getenv("FACILITATOR_URL", "https://x402.org/facilitator"))
)
server = x402ResourceServerSync(facilitator)
server.register(AVM_NETWORK, ExactAvmServerScheme())
server.register_extension(bazaar_resource_server_extension)

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
payment_middleware(app, routes=routes, server=server)


@app.route("/weather")
def get_weather():
    return jsonify({"report": {"weather": "sunny", "temperature": 70}})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4021, debug=False)
```

---

## Client Discovering and Calling the API

```python
"""Client that discovers and calls the Algorand-gated weather API."""

import httpx

from x402.http import FacilitatorConfig, HTTPFacilitatorClient
from x402.extensions.bazaar import with_bazaar, ListDiscoveryResourcesParams

FACILITATOR_URL = "https://x402.org/facilitator"

facilitator = HTTPFacilitatorClient(FacilitatorConfig(url=FACILITATOR_URL))
client = with_bazaar(facilitator)

resources = client.extensions.discovery.list_resources(
    ListDiscoveryResourcesParams(type="http", limit=50)
)

for resource in resources.resources:
    print(f"Discovered: {resource.url} ({resource.type})")
    if resource.metadata:
        print(f"  Metadata: {resource.metadata}")
```
