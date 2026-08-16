# Creating x402 Payment-Protected Servers in Python

Build FastAPI (async) or Flask (sync) servers that protect API endpoints behind Algorand USDC payments using x402 middleware.

## Prerequisites

Before using this skill, ensure:

1. **Python 3.10+** is installed
2. **An Algorand address** to receive payments (the `payTo` address)
3. **A facilitator URL** -- use `https://x402.org/facilitator` or run your own
4. **Understanding of FastAPI or Flask** basics

## Core Workflow: Middleware-Based Payment Protection

The middleware intercepts requests to protected routes, checks for payment headers, verifies payments through the facilitator, and settles on success.

```
Client Request
      |
      v
x402 Middleware (checks route config)
      |
      +-- Not protected -> Pass through to handler
      |
      +-- Protected, no payment -> Return 402 with PaymentRequirements
      |
      +-- Protected, has payment -> Verify via Facilitator
            |
            +-- Invalid -> Return 402
            |
            +-- Valid -> Call handler, then settle payment
```

## How to Proceed

### Step 1: Install Dependencies

For FastAPI (async):
```bash
pip install "x402-avm[fastapi,avm]"
```

For Flask (sync):
```bash
pip install "x402-avm[flask,avm]"
```

### Step 2: Choose Your Framework Pattern

**FastAPI** uses async components:
- `x402ResourceServer` (async)
- `HTTPFacilitatorClient` (async)
- `PaymentMiddlewareASGI` or `payment_middleware`

**Flask** uses sync components:
- `x402ResourceServerSync` (sync)
- `HTTPFacilitatorClientSync` (sync)
- `PaymentMiddleware` or `payment_middleware`

### Step 3: Set Up the Resource Server

Create a facilitator client, resource server, and register the AVM scheme:

**FastAPI:**
```python
from x402.server import x402ResourceServer
from x402.http import HTTPFacilitatorClient, FacilitatorConfig
from x402.mechanisms.avm.exact import ExactAvmServerScheme

facilitator = HTTPFacilitatorClient(FacilitatorConfig(url="https://x402.org/facilitator"))
server = x402ResourceServer(facilitator)
server.register("algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=", ExactAvmServerScheme())
```

**Flask:**
```python
from x402.server import x402ResourceServerSync
from x402.http import HTTPFacilitatorClientSync, FacilitatorConfig
from x402.mechanisms.avm.exact import ExactAvmServerScheme

facilitator = HTTPFacilitatorClientSync(FacilitatorConfig(url="https://x402.org/facilitator"))
server = x402ResourceServerSync(facilitator)
server.register("algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=", ExactAvmServerScheme())
```

### Step 4: Define Route Configurations

Routes map HTTP method + path patterns to payment requirements:

```python
from x402.http import PaymentOption
from x402.http.types import RouteConfig

routes = {
    "GET /api/weather": RouteConfig(
        accepts=PaymentOption(
            scheme="exact",
            network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
            pay_to="YOUR_ALGORAND_ADDRESS",
            price="$0.01",
        ),
    ),
}
```

### Step 5: Apply Middleware

**FastAPI -- Option A (ASGI class, recommended):**
```python
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)
```

**FastAPI -- Option B (function-based):**
```python
from x402.http.middleware.fastapi import payment_middleware
x402_mw = payment_middleware(routes=routes, server=server)

@app.middleware("http")
async def x402_middleware(request, call_next):
    return await x402_mw(request, call_next)
```

**Flask:**
```python
from x402.http.middleware.flask import PaymentMiddleware
PaymentMiddleware(app, routes, server)
```

### Step 6: Define Route Handlers

Routes listed in the configuration require payment. Unlisted routes pass through freely.

**FastAPI:**
```python
@app.get("/api/weather")
async def get_weather():
    return {"temperature": 72, "unit": "F"}
```

**Flask:**
```python
@app.route("/api/weather")
def get_weather():
    return {"temperature": 72, "unit": "F"}
```

## Important Rules / Guidelines

1. **Match async/sync variants** -- FastAPI uses `x402ResourceServer` + `HTTPFacilitatorClient`, Flask uses `x402ResourceServerSync` + `HTTPFacilitatorClientSync`
2. **Route format** -- Keys must be `"METHOD /path"` (e.g., `"GET /api/weather"`, `"POST /api/generate/*"`)
3. **Wildcard paths** -- Use `/*` suffix to match all sub-paths (e.g., `"GET /api/premium/*"`)
4. **Unlisted routes pass through** -- Only routes in the config require payment
5. **Register scheme before middleware** -- Call `server.register(...)` before adding middleware
6. **Price format** -- Use `"$0.01"` for auto-conversion or `AssetAmount(amount="10000", asset="10458941")` for explicit control
7. **CAIP-2 network IDs** -- Use full CAIP-2 identifiers like `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="`

## Pricing Options

### Simple String Price

```python
PaymentOption(
    scheme="exact",
    network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    pay_to="YOUR_ADDRESS",
    price="$0.01",  # Auto-converts to 10000 microUSDC
)
```

### Explicit AssetAmount

```python
from x402.schemas import AssetAmount

PaymentOption(
    scheme="exact",
    network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    pay_to="YOUR_ADDRESS",
    price=AssetAmount(
        amount="50000",       # 50000 microUSDC = $0.05
        asset="10458941",     # USDC ASA ID on testnet
        extra={"name": "USDC", "decimals": 6},
    ),
)
```

### Multi-Network (AVM + EVM + SVM)

```python
routes = {
    "GET /api/data/*": RouteConfig(
        accepts=[
            PaymentOption(scheme="exact", pay_to=AVM_ADDRESS, price="$0.01",
                         network="algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="),
            PaymentOption(scheme="exact", pay_to=EVM_ADDRESS, price="$0.01",
                         network="eip155:84532"),
            PaymentOption(scheme="exact", pay_to=SVM_ADDRESS, price="$0.01",
                         network="solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"),
        ],
    ),
}
```

## Common Errors / Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `TypeError: async` errors in Flask | Using async variants with Flask | Use `x402ResourceServerSync` and `HTTPFacilitatorClientSync` |
| 402 returned to all requests | Middleware applied but facilitator unreachable | Check `FACILITATOR_URL` and network connectivity |
| Route not protected | Path pattern mismatch | Verify route key format matches: `"GET /exact/path"` or `"GET /prefix/*"` |
| Settlement fails | Facilitator cannot reach Algorand network | Check facilitator logs and algod endpoint |
| `ImportError` on middleware | Missing extras | `pip install "x402-avm[fastapi,avm]"` or `"x402-avm[flask,avm]"` |

## References / Further Reading

- [create-python-x402-server-reference.md](./create-python-x402-server-reference.md) - Detailed API reference for middleware
- [create-python-x402-server-examples.md](./create-python-x402-server-examples.md) - Complete code examples for FastAPI and Flask
- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402 Algorand Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
