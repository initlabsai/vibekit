# x402 Python Server Middleware Reference

Detailed API reference for FastAPI and Flask payment middleware in the `x402-avm` Python package.

## FastAPI Middleware API

### `payment_middleware(routes, server, ...)`

Creates an async middleware callable for FastAPI.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `routes` | `RoutesConfig` | required | Route configuration for protected endpoints |
| `server` | `x402ResourceServer` | required | Pre-configured async resource server |
| `paywall_config` | `PaywallConfig \| None` | `None` | Optional paywall UI configuration |
| `paywall_provider` | `PaywallProvider \| None` | `None` | Optional custom paywall provider |
| `sync_facilitator_on_start` | `bool` | `True` | Fetch facilitator support on first request |

**Returns**: Async middleware callable `(Request, call_next) -> Response`

**Usage**:
```python
x402_mw = payment_middleware(routes=routes, server=server)

@app.middleware("http")
async def x402_middleware(request: Request, call_next):
    return await x402_mw(request, call_next)
```

### `payment_middleware_from_config(routes, facilitator_client, ...)`

Creates middleware with an internally-created resource server.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `routes` | `RoutesConfig` | required | Route configuration |
| `facilitator_client` | `Any` | `None` | Facilitator client for payment processing |
| `schemes` | `list[dict] \| None` | `None` | Scheme registrations (`{"network": ..., "server": ...}`) |
| `paywall_config` | `PaywallConfig \| None` | `None` | Optional paywall config |
| `paywall_provider` | `PaywallProvider \| None` | `None` | Optional custom paywall |
| `sync_facilitator_on_start` | `bool` | `True` | Lazy initialization flag |

**Returns**: Async middleware callable `(Request, call_next) -> Response`

### `PaymentMiddlewareASGI`

Starlette `BaseHTTPMiddleware` subclass. Accepts same parameters as `payment_middleware` via `app.add_middleware()`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `app` | `ASGIApp` | Passed automatically by Starlette |
| `routes` | `RoutesConfig` | Route configuration |
| `server` | `x402ResourceServer` | Pre-configured server instance |
| `paywall_config` | `PaywallConfig \| None` | Optional paywall UI config |
| `paywall_provider` | `PaywallProvider \| None` | Optional custom paywall |

**Usage**:
```python
app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)
```

### `FastAPIAdapter`

Implements the `HTTPAdapter` protocol for FastAPI/Starlette requests. Used internally.

| Method | Returns | Description |
|--------|---------|-------------|
| `get_header(name)` | `str \| None` | Case-insensitive header lookup |
| `get_method()` | `str` | HTTP method (GET, POST, etc.) |
| `get_path()` | `str` | Request path |
| `get_url()` | `str` | Full request URL |
| `get_accept_header()` | `str` | Accept header value |
| `get_user_agent()` | `str` | User-Agent header value |
| `get_query_params()` | `dict` | All query parameters |
| `get_query_param(name)` | `str \| None` | Single query parameter |
| `get_body()` | `None` | Returns None (body requires async access) |

## Flask Middleware API

### `PaymentMiddleware(app, routes, server, ...)`

The main WSGI middleware class. Replaces `app.wsgi_app` on initialization.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `app` | `Flask` | required | Flask application instance |
| `routes` | `RoutesConfig` | required | Route configuration for protected endpoints |
| `server` | `x402ResourceServerSync` | required | Pre-configured **sync** resource server |
| `paywall_config` | `PaywallConfig \| None` | `None` | Optional paywall UI configuration |
| `paywall_provider` | `PaywallProvider \| None` | `None` | Optional custom paywall provider |
| `sync_facilitator_on_start` | `bool` | `True` | Fetch facilitator support on first request |

**Side effect**: Replaces `app.wsgi_app` with the payment-checking WSGI middleware.

### `payment_middleware(app, routes, server, ...)`

Factory function. Accepts same parameters as `PaymentMiddleware`, returns `PaymentMiddleware` instance.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `app` | `Flask` | required | Flask application instance |
| `routes` | `RoutesConfig` | required | Route configuration |
| `server` | `x402ResourceServerSync` | required | Pre-configured **sync** resource server |
| `paywall_config` | `PaywallConfig \| None` | `None` | Optional paywall config |
| `paywall_provider` | `PaywallProvider \| None` | `None` | Optional custom paywall |
| `sync_facilitator_on_start` | `bool` | `True` | Lazy initialization flag |

**Returns**: `PaymentMiddleware` instance.

### `payment_middleware_from_config(app, routes, ...)`

Convenience function that creates the `x402ResourceServer` internally.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `app` | `Flask` | required | Flask application instance |
| `routes` | `RoutesConfig` | required | Route configuration |
| `facilitator_client` | `Any` | `None` | Facilitator client for payment processing |
| `schemes` | `list[dict] \| None` | `None` | Scheme registrations (`{"network": ..., "server": ...}`) |
| `paywall_config` | `PaywallConfig \| None` | `None` | Optional paywall config |
| `paywall_provider` | `PaywallProvider \| None` | `None` | Optional custom paywall |
| `sync_facilitator_on_start` | `bool` | `True` | Lazy initialization flag |

**Returns**: `PaymentMiddleware` instance.

### `FlaskAdapter`

Implements the `HTTPAdapter` protocol for Flask requests. Used internally.

| Method | Returns | Description |
|--------|---------|-------------|
| `get_header(name)` | `str \| None` | Case-insensitive header lookup |
| `get_method()` | `str` | HTTP method (GET, POST, etc.) |
| `get_path()` | `str` | Request path |
| `get_url()` | `str` | Full request URL |
| `get_accept_header()` | `str` | Accept header value |
| `get_user_agent()` | `str` | User-Agent header value |
| `get_query_params()` | `dict` | All query parameters |
| `get_query_param(name)` | `str \| None` | Single query parameter |
| `get_body()` | `Any \| None` | Parsed JSON body (via `request.get_json(silent=True)`) |

### `ResponseWrapper`

Internal class that captures and buffers the WSGI response for settlement processing.

| Method/Property | Description |
|-----------------|-------------|
| `status` | Captured HTTP status string |
| `status_code` | Parsed integer status code |
| `headers` | List of (name, value) header tuples |
| `add_header(name, value)` | Add a header to the response |
| `send_response(body_chunks)` | Send the buffered response to the client |

## RouteConfig

Dataclass for route configuration.

```python
from x402.http.types import RouteConfig

RouteConfig(
    accepts=PaymentOption(...),          # Required: single payment option
    # or: accepts=[PaymentOption(...), PaymentOption(...)],  # Multiple options
    resource="https://api.example.com/api/weather",  # Optional: resource URL
    description="Weather data API",      # Optional: description
    mime_type="application/json",        # Optional: response MIME type
)
```

### Route Key Format

Route keys follow the pattern `"METHOD /path"`:

| Pattern | Matches |
|---------|---------|
| `"GET /api/weather"` | Exactly `/api/weather` |
| `"GET /api/premium/*"` | `/api/premium/anything`, `/api/premium/a/b` |
| `"POST /api/generate"` | Exactly `POST /api/generate` |
| `"GET /api/data/*"` | Any GET under `/api/data/` |

## PaymentOption

Dataclass for payment options.

```python
from x402.http import PaymentOption

PaymentOption(
    scheme="exact",              # Payment scheme name
    network="algorand:SGO...",   # CAIP-2 network identifier
    pay_to="ALGO_ADDRESS",       # Recipient address
    price="$0.01",               # Auto-converted to AssetAmount
    # or: price=AssetAmount(amount="10000", asset="10458941"),
)
```

## AssetAmount

Explicit asset amount specification.

```python
from x402.schemas import AssetAmount

AssetAmount(
    amount="10000",                      # Atomic units (string)
    asset="10458941",                    # Asset identifier (ASA ID as string)
    extra={"name": "USDC", "decimals": 6},  # Optional metadata
)
```

## Sync vs Async Comparison

| Component | Flask (Sync) | FastAPI (Async) |
|-----------|-------------|-----------------|
| Resource server | `x402ResourceServerSync` | `x402ResourceServer` |
| Facilitator client | `HTTPFacilitatorClientSync` | `HTTPFacilitatorClient` |
| Middleware class | `PaymentMiddleware` (WSGI) | `PaymentMiddlewareASGI` (ASGI) |
| Payment info storage | `flask.g.payment_payload` | `request.state.payment_payload` |
| HTTP server wrapper | `x402HTTPResourceServerSync` | `x402HTTPResourceServer` |
| Middleware invocation | `PaymentMiddleware(app, ...)` | `app.add_middleware(PaymentMiddlewareASGI, ...)` |
| Settlement | Synchronous (blocking) | `await` async settlement |

## Middleware Flow

### FastAPI (ASGI)

1. Client sends request with `Payment-Signature` header
2. Middleware checks if the route requires payment via `requires_payment(context)`
3. On first protected request, facilitator support is synchronized (lazy init)
4. `process_http_request(context)` verifies the payment:
   - `"no-payment-required"` -- route not protected, passes through
   - `"payment-error"` -- returns 402 response (JSON or HTML paywall)
   - `"payment-verified"` -- stores on `request.state`, calls route handler
5. If route handler returns a successful (2xx) response, settlement is processed
6. Settlement headers are added to the response

### Flask (WSGI)

1. Client sends request with `Payment-Signature` header
2. The WSGI middleware intercepts the request within a Flask request context
3. Middleware checks if the route requires payment via `requires_payment(context)`
4. On first protected request, facilitator support is synchronized (lazy init)
5. `process_http_request(context)` verifies the payment **synchronously**:
   - `"no-payment-required"` -- passes through to `original_wsgi`
   - `"payment-error"` -- returns 402 response
   - `"payment-verified"` -- stores on `flask.g`, calls original WSGI app
6. Response is captured by `ResponseWrapper`, settlement is processed synchronously
7. Settlement headers are added to the buffered response

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AVM_ADDRESS` | Algorand address to receive payments | Required |
| `FACILITATOR_URL` | URL of the x402 facilitator service | `https://x402.org/facilitator` |

## Algorand-Specific Constants

| Constant | Value | Import |
|----------|-------|--------|
| `ALGORAND_TESTNET_CAIP2` | `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` | `x402.mechanisms.avm` |
| `ALGORAND_MAINNET_CAIP2` | `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` | `x402.mechanisms.avm` |
| `USDC_TESTNET_ASA_ID` | `10458941` | `x402.mechanisms.avm` |
| `USDC_MAINNET_ASA_ID` | `31566704` | `x402.mechanisms.avm` |

## CAIP-2 Network Identifiers

| Network | CAIP-2 Identifier |
|---------|-------------------|
| Algorand Mainnet | `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=` |
| Algorand Testnet | `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=` |
| Base Sepolia (EVM) | `eip155:84532` |
| Solana Devnet (SVM) | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |

## Error Handling

### Payment Errors (402 Responses)

When a client sends a request without a valid payment, the middleware returns a 402 response containing `PaymentRequirements` the client needs to fulfill.

### Settlement Failures

If the route handler succeeds but settlement fails:

```json
{
    "error": "Settlement failed",
    "details": "reason for failure"
}
```

### Unprotected Routes

Routes not listed in the `routes` configuration are served normally without any payment check.

## External Resources

- [x402-avm on PyPI](https://pypi.org/project/x402-avm/)
- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402 Algorand Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Coinbase x402 Specification](https://github.com/coinbase/x402)
