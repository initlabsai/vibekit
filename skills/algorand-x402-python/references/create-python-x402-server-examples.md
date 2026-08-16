# x402 Python Server Middleware Examples

## FastAPI: Basic Middleware Setup (Function-Based)

```python
from fastapi import FastAPI, Request
from x402.server import x402ResourceServer
from x402.http import HTTPFacilitatorClient, FacilitatorConfig, PaymentOption
from x402.http.types import RouteConfig
from x402.http.middleware.fastapi import payment_middleware
from x402.mechanisms.avm.exact import ExactAvmServerScheme

app = FastAPI()

facilitator = HTTPFacilitatorClient(FacilitatorConfig(url="https://x402.org/facilitator"))
server = x402ResourceServer(facilitator)
server.register(
    "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    ExactAvmServerScheme(),
)

routes = {
    "GET /api/data/*": RouteConfig(
        accepts=PaymentOption(
            scheme="exact",
            network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            pay_to="YOUR_ALGORAND_ADDRESS",
            price="$0.01",
        ),
    ),
}

x402_mw = payment_middleware(routes=routes, server=server)

@app.middleware("http")
async def x402_middleware(request: Request, call_next):
    return await x402_mw(request, call_next)

@app.get("/api/data/weather")
async def get_weather():
    return {"temperature": 72, "unit": "F", "condition": "sunny"}
```

## FastAPI: ASGI Middleware Class

```python
from fastapi import FastAPI
from x402.server import x402ResourceServer
from x402.http import HTTPFacilitatorClient, FacilitatorConfig, PaymentOption
from x402.http.types import RouteConfig
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.mechanisms.avm.exact import ExactAvmServerScheme

app = FastAPI()

facilitator = HTTPFacilitatorClient(FacilitatorConfig(url="https://x402.org/facilitator"))
server = x402ResourceServer(facilitator)
server.register(
    "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    ExactAvmServerScheme(),
)

routes = {
    "GET /weather": RouteConfig(
        accepts=PaymentOption(
            scheme="exact",
            pay_to="YOUR_ALGORAND_ADDRESS",
            price="$0.01",
            network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
        ),
        mime_type="application/json",
        description="Weather report",
    ),
}

app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)

@app.get("/weather")
async def get_weather():
    return {"report": {"weather": "sunny", "temperature": 70}}
```

## FastAPI: Middleware from Config

```python
from x402.http import HTTPFacilitatorClient, FacilitatorConfig
from x402.http.middleware.fastapi import payment_middleware_from_config
from x402.mechanisms.avm.exact import ExactAvmServerScheme

facilitator = HTTPFacilitatorClient(FacilitatorConfig(url="https://x402.org/facilitator"))

routes = {
    "GET /api/data/*": {
        "accepts": {
            "scheme": "exact",
            "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            "payTo": "YOUR_ALGORAND_ADDRESS",
            "maxAmountRequired": "10000",
            "asset": "10458941",
        }
    }
}

mw = payment_middleware_from_config(
    routes=routes,
    facilitator_client=facilitator,
    schemes=[
        {
            "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            "server": ExactAvmServerScheme(),
        },
    ],
)

@app.middleware("http")
async def x402_middleware(request, call_next):
    return await mw(request, call_next)
```

## FastAPI: Simple String Price

```python
routes = {
    "GET /api/weather": RouteConfig(
        accepts=PaymentOption(
            scheme="exact",
            network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            pay_to="RECEIVER_ALGORAND_ADDRESS",
            price="$0.01",
        ),
    ),
}
```

## FastAPI: Explicit AssetAmount

```python
from x402.schemas import AssetAmount

routes = {
    "GET /api/premium/*": RouteConfig(
        accepts=PaymentOption(
            scheme="exact",
            network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            pay_to="RECEIVER_ALGORAND_ADDRESS",
            price=AssetAmount(
                amount="10000",
                asset="10458941",
                extra={"name": "USDC", "decimals": 6},
            ),
        ),
    ),
}
```

## FastAPI: Accessing Payment Info in Route Handlers

```python
from fastapi import FastAPI, Request

@app.get("/api/paid-resource")
async def paid_resource(request: Request):
    payment_payload = getattr(request.state, "payment_payload", None)
    payment_requirements = getattr(request.state, "payment_requirements", None)

    if payment_payload:
        payer_address = payment_payload.payload.get("from", "unknown")
        return {
            "data": "premium content",
            "paid_by": payer_address,
        }

    return {"data": "premium content"}
```

## FastAPI: Multiple Routes with Different Prices

```python
from x402.http import PaymentOption
from x402.http.types import RouteConfig
from x402.schemas import AssetAmount

routes = {
    "GET /api/status": RouteConfig(
        accepts=PaymentOption(
            scheme="exact", pay_to=AVM_ADDRESS,
            price="$0.001", network=AVM_NETWORK,
        ),
    ),
    "GET /api/weather/*": RouteConfig(
        accepts=PaymentOption(
            scheme="exact", pay_to=AVM_ADDRESS,
            price="$0.01", network=AVM_NETWORK,
        ),
        description="Weather data",
    ),
    "GET /api/analytics/*": RouteConfig(
        accepts=PaymentOption(
            scheme="exact", pay_to=AVM_ADDRESS,
            price=AssetAmount(
                amount="100000",
                asset=str(USDC_TESTNET_ASA_ID),
                extra={"name": "USDC", "decimals": 6},
            ),
            network=AVM_NETWORK,
        ),
        description="Premium analytics",
    ),
    "POST /api/generate": RouteConfig(
        accepts=PaymentOption(
            scheme="exact", pay_to=AVM_ADDRESS,
            price="$0.05", network=AVM_NETWORK,
        ),
        description="AI generation",
    ),
}
```

## FastAPI: Multi-Network (AVM + EVM + SVM)

```python
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.http.types import RouteConfig
from x402.mechanisms.avm.exact import ExactAvmServerScheme
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.mechanisms.svm.exact import ExactSvmServerScheme
from x402.schemas import Network
from x402.server import x402ResourceServer

load_dotenv()

EVM_ADDRESS = os.getenv("EVM_ADDRESS")
SVM_ADDRESS = os.getenv("SVM_ADDRESS")
AVM_ADDRESS = os.getenv("AVM_ADDRESS")
AVM_NETWORK: Network = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
EVM_NETWORK: Network = "eip155:84532"
SVM_NETWORK: Network = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"

app = FastAPI()

facilitator = HTTPFacilitatorClient(FacilitatorConfig(url="https://x402.org/facilitator"))
server = x402ResourceServer(facilitator)
server.register(AVM_NETWORK, ExactAvmServerScheme())
server.register(EVM_NETWORK, ExactEvmServerScheme())
server.register(SVM_NETWORK, ExactSvmServerScheme())

routes = {
    "GET /weather": RouteConfig(
        accepts=[
            PaymentOption(scheme="exact", pay_to=AVM_ADDRESS, price="$0.01", network=AVM_NETWORK),
            PaymentOption(scheme="exact", pay_to=EVM_ADDRESS, price="$0.01", network=EVM_NETWORK),
            PaymentOption(scheme="exact", pay_to=SVM_ADDRESS, price="$0.01", network=SVM_NETWORK),
        ],
        mime_type="application/json",
        description="Weather report",
    ),
}

app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)

@app.get("/weather")
async def get_weather():
    return {"report": {"weather": "sunny", "temperature": 70}}
```

## FastAPI: Complete Algorand Example

```python
"""FastAPI resource server accepting USDC payments on Algorand Testnet via x402."""

import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from pydantic import BaseModel

from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.http.types import RouteConfig
from x402.mechanisms.avm import USDC_TESTNET_ASA_ID
from x402.mechanisms.avm.exact import ExactAvmServerScheme
from x402.schemas import AssetAmount, Network
from x402.server import x402ResourceServer

load_dotenv()

AVM_ADDRESS = os.getenv("AVM_ADDRESS")
if not AVM_ADDRESS:
    raise ValueError("AVM_ADDRESS environment variable is required")

AVM_NETWORK: Network = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
FACILITATOR_URL = os.getenv("FACILITATOR_URL", "https://x402.org/facilitator")


class WeatherReport(BaseModel):
    weather: str
    temperature: int
    unit: str


class WeatherResponse(BaseModel):
    report: WeatherReport


app = FastAPI(title="x402 AVM Resource Server")

facilitator = HTTPFacilitatorClient(FacilitatorConfig(url=FACILITATOR_URL))
server = x402ResourceServer(facilitator)
server.register(AVM_NETWORK, ExactAvmServerScheme())

routes = {
    "GET /weather": RouteConfig(
        accepts=PaymentOption(
            scheme="exact",
            pay_to=AVM_ADDRESS,
            price="$0.01",
            network=AVM_NETWORK,
        ),
        mime_type="application/json",
        description="Weather report",
    ),
    "GET /premium/*": RouteConfig(
        accepts=PaymentOption(
            scheme="exact",
            pay_to=AVM_ADDRESS,
            price=AssetAmount(
                amount="50000",
                asset=str(USDC_TESTNET_ASA_ID),
                extra={"name": "USDC", "decimals": 6},
            ),
            network=AVM_NETWORK,
        ),
        mime_type="application/json",
        description="Premium content",
    ),
}

app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/weather")
async def get_weather(request: Request):
    return WeatherResponse(
        report=WeatherReport(weather="sunny", temperature=72, unit="F")
    )


@app.get("/premium/content")
async def get_premium_content(request: Request):
    return {"content": "Premium Algorand analytics data.", "tier": "gold"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4021)
```

---

## Flask: Basic Middleware Setup (PaymentMiddleware Class)

```python
from flask import Flask
from x402.server import x402ResourceServerSync
from x402.http import HTTPFacilitatorClientSync, FacilitatorConfig, PaymentOption
from x402.http.types import RouteConfig
from x402.http.middleware.flask import PaymentMiddleware
from x402.mechanisms.avm.exact import ExactAvmServerScheme

app = Flask(__name__)

facilitator = HTTPFacilitatorClientSync(FacilitatorConfig(url="https://x402.org/facilitator"))
server = x402ResourceServerSync(facilitator)
server.register(
    "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    ExactAvmServerScheme(),
)

routes = {
    "GET /api/data/*": RouteConfig(
        accepts=PaymentOption(
            scheme="exact",
            network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            pay_to="YOUR_ALGORAND_ADDRESS",
            price="$0.01",
        ),
    ),
}

PaymentMiddleware(app, routes, server)

@app.route("/api/data/weather")
def get_weather():
    return {"temperature": 72, "unit": "F", "condition": "sunny"}
```

## Flask: Factory Function

```python
from flask import Flask
from x402.server import x402ResourceServerSync
from x402.http import HTTPFacilitatorClientSync, FacilitatorConfig, PaymentOption
from x402.http.types import RouteConfig
from x402.http.middleware.flask import payment_middleware
from x402.mechanisms.avm.exact import ExactAvmServerScheme

app = Flask(__name__)

facilitator = HTTPFacilitatorClientSync(FacilitatorConfig(url="https://x402.org/facilitator"))
server = x402ResourceServerSync(facilitator)
server.register(
    "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    ExactAvmServerScheme(),
)

routes = {
    "GET /weather": RouteConfig(
        accepts=PaymentOption(
            scheme="exact",
            pay_to="YOUR_ALGORAND_ADDRESS",
            price="$0.01",
            network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
        ),
        mime_type="application/json",
        description="Weather report",
    ),
}

middleware_instance = payment_middleware(app, routes=routes, server=server)

@app.route("/weather")
def get_weather():
    return {"report": {"weather": "sunny", "temperature": 70}}
```

## Flask: Middleware from Config

```python
from flask import Flask
from x402.http import HTTPFacilitatorClientSync, FacilitatorConfig
from x402.http.middleware.flask import payment_middleware_from_config
from x402.mechanisms.avm.exact import ExactAvmServerScheme

app = Flask(__name__)

facilitator = HTTPFacilitatorClientSync(FacilitatorConfig(url="https://x402.org/facilitator"))

routes = {
    "GET /api/data/*": {
        "accepts": {
            "scheme": "exact",
            "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            "payTo": "YOUR_ALGORAND_ADDRESS",
            "maxAmountRequired": "10000",
            "asset": "10458941",
        }
    }
}

payment_middleware_from_config(
    app,
    routes=routes,
    facilitator_client=facilitator,
    schemes=[
        {
            "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            "server": ExactAvmServerScheme(),
        },
    ],
)

@app.route("/api/data/weather")
def get_weather():
    return {"temperature": 72}
```

## Flask: Accessing Payment Info in Route Handlers

```python
from flask import g, jsonify

@app.route("/api/paid-resource")
def paid_resource():
    payment_payload = getattr(g, "payment_payload", None)
    payment_requirements = getattr(g, "payment_requirements", None)

    if payment_payload:
        return jsonify({
            "data": "premium content",
            "paid": True,
        })

    return jsonify({"data": "premium content"})
```

## Flask: Multi-Network (AVM + EVM + SVM)

```python
import os
from dotenv import load_dotenv
from flask import Flask, jsonify
from x402.http import FacilitatorConfig, HTTPFacilitatorClientSync, PaymentOption
from x402.http.middleware.flask import payment_middleware
from x402.http.types import RouteConfig
from x402.mechanisms.avm.exact import ExactAvmServerScheme
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.mechanisms.svm.exact import ExactSvmServerScheme
from x402.schemas import Network
from x402.server import x402ResourceServerSync

load_dotenv()

EVM_ADDRESS = os.getenv("EVM_ADDRESS")
SVM_ADDRESS = os.getenv("SVM_ADDRESS")
AVM_ADDRESS = os.getenv("AVM_ADDRESS")
AVM_NETWORK: Network = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
EVM_NETWORK: Network = "eip155:84532"
SVM_NETWORK: Network = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"

app = Flask(__name__)

facilitator = HTTPFacilitatorClientSync(FacilitatorConfig(url="https://x402.org/facilitator"))
server = x402ResourceServerSync(facilitator)
server.register(AVM_NETWORK, ExactAvmServerScheme())
server.register(EVM_NETWORK, ExactEvmServerScheme())
server.register(SVM_NETWORK, ExactSvmServerScheme())

routes = {
    "GET /weather": RouteConfig(
        accepts=[
            PaymentOption(scheme="exact", pay_to=AVM_ADDRESS, price="$0.01", network=AVM_NETWORK),
            PaymentOption(scheme="exact", pay_to=EVM_ADDRESS, price="$0.01", network=EVM_NETWORK),
            PaymentOption(scheme="exact", pay_to=SVM_ADDRESS, price="$0.01", network=SVM_NETWORK),
        ],
        mime_type="application/json",
        description="Weather report",
    ),
}

payment_middleware(app, routes=routes, server=server)

@app.route("/weather")
def get_weather():
    return jsonify({"report": {"weather": "sunny", "temperature": 70}})
```

## Flask: Complete Algorand Example

```python
"""Flask resource server accepting USDC payments on Algorand Testnet via x402."""

import os

from dotenv import load_dotenv
from flask import Flask, g, jsonify

from x402.http import FacilitatorConfig, HTTPFacilitatorClientSync, PaymentOption
from x402.http.middleware.flask import payment_middleware
from x402.http.types import RouteConfig
from x402.mechanisms.avm import USDC_TESTNET_ASA_ID
from x402.mechanisms.avm.exact import ExactAvmServerScheme
from x402.schemas import AssetAmount, Network
from x402.server import x402ResourceServerSync

load_dotenv()

AVM_ADDRESS = os.getenv("AVM_ADDRESS")
if not AVM_ADDRESS:
    raise ValueError("AVM_ADDRESS environment variable is required")

AVM_NETWORK: Network = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
FACILITATOR_URL = os.getenv("FACILITATOR_URL", "https://x402.org/facilitator")

app = Flask(__name__)

facilitator = HTTPFacilitatorClientSync(FacilitatorConfig(url=FACILITATOR_URL))
server = x402ResourceServerSync(facilitator)
server.register(AVM_NETWORK, ExactAvmServerScheme())

routes = {
    "GET /weather": RouteConfig(
        accepts=PaymentOption(
            scheme="exact",
            pay_to=AVM_ADDRESS,
            price="$0.01",
            network=AVM_NETWORK,
        ),
        mime_type="application/json",
        description="Weather report",
    ),
    "GET /premium/*": RouteConfig(
        accepts=PaymentOption(
            scheme="exact",
            pay_to=AVM_ADDRESS,
            price=AssetAmount(
                amount="50000",
                asset=str(USDC_TESTNET_ASA_ID),
                extra={"name": "USDC", "decimals": 6},
            ),
            network=AVM_NETWORK,
        ),
        mime_type="application/json",
        description="Premium content",
    ),
}

payment_middleware(app, routes=routes, server=server)


@app.route("/health")
def health_check():
    return jsonify({"status": "ok"})


@app.route("/weather")
def get_weather():
    return jsonify({"report": {"weather": "sunny", "temperature": 72, "unit": "F"}})


@app.route("/premium/content")
def get_premium_content():
    payment = getattr(g, "payment_payload", None)
    return jsonify({
        "content": "Premium Algorand analytics data.",
        "tier": "gold",
        "paid": payment is not None,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4021, debug=False)
```

## Flask vs FastAPI: Sync/Async Comparison

```python
# Flask (sync)
from flask import Flask, g, jsonify
from x402.server import x402ResourceServerSync
from x402.http import HTTPFacilitatorClientSync, FacilitatorConfig
from x402.http.middleware.flask import payment_middleware

app = Flask(__name__)
facilitator = HTTPFacilitatorClientSync(FacilitatorConfig(url="https://x402.org/facilitator"))
server = x402ResourceServerSync(facilitator)
server.register(AVM_NETWORK, ExactAvmServerScheme())
payment_middleware(app, routes=routes, server=server)

@app.route("/weather")
def get_weather():
    payment = getattr(g, "payment_payload", None)
    return jsonify({"weather": "sunny"})
```

```python
# FastAPI (async)
from fastapi import FastAPI, Request
from x402.server import x402ResourceServer
from x402.http import HTTPFacilitatorClient, FacilitatorConfig
from x402.http.middleware.fastapi import PaymentMiddlewareASGI

app = FastAPI()
facilitator = HTTPFacilitatorClient(FacilitatorConfig(url="https://x402.org/facilitator"))
server = x402ResourceServer(facilitator)
server.register(AVM_NETWORK, ExactAvmServerScheme())
app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)

@app.get("/weather")
async def get_weather(request: Request):
    payment = getattr(request.state, "payment_payload", None)
    return {"weather": "sunny"}
```

## Custom Error Responses (Paywall Config)

```python
from x402.http import PaywallConfig

# FastAPI
app.add_middleware(
    PaymentMiddlewareASGI,
    routes=routes,
    server=server,
    paywall_config=PaywallConfig(...),
)

# Flask
PaymentMiddleware(
    app,
    routes,
    server,
    paywall_config=PaywallConfig(...),
)
```
