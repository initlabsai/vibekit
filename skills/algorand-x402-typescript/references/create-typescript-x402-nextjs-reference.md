# @x402/next Reference

Detailed API reference for the x402-avm Next.js integration package.

## Dependencies

```json
{
  "dependencies": {
    "@x402/next": "latest",
    "@x402/core": "latest",
    "@x402/avm": "latest",
    "next": ">=14.0.0"
  }
}
```

For paywall UI:

```json
{
  "dependencies": {
    "@x402/paywall": "latest"
  }
}
```

## Package Exports: @x402/next

| Export | Description |
|--------|-------------|
| `paymentProxyFromConfig` | Create proxy with auto-configured resource server |
| `paymentProxy` | Create proxy with pre-configured resource server |
| `paymentProxyFromHTTPServer` | Create proxy from an `x402HTTPResourceServer` |
| `withX402` | Wrap a route handler with payment protection |
| `withX402FromHTTPServer` | Wrap a route handler using an `x402HTTPResourceServer` |
| `x402ResourceServer` | Re-export from `@x402/core/server` |
| `x402HTTPResourceServer` | Re-export from `@x402/core/server` |

## paymentProxyFromConfig

The simplest proxy setup. Creates the `x402ResourceServer` internally.

```typescript
function paymentProxyFromConfig(
  routes: Record<string, RouteDefinition>,
  facilitatorClient: HTTPFacilitatorClient,
  paywallConfig?: PaywallConfig,
): (request: NextRequest) => Promise<NextResponse>;
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `routes` | `Record<string, RouteDefinition>` | Route pattern to payment config mapping |
| `facilitatorClient` | `HTTPFacilitatorClient` | Client for communicating with facilitator |
| `paywallConfig` | `PaywallConfig` (optional) | Configuration for browser paywall UI |

### Route Pattern Format

Route patterns follow the format `"METHOD /path/pattern"`:

| Pattern | Matches |
|---------|---------|
| `"GET /api/weather"` | Exact match: `GET /api/weather` |
| `"GET /api/premium/*"` | Wildcard: `GET /api/premium/data`, `GET /api/premium/stats` |
| `"POST /api/generate"` | Exact match: `POST /api/generate` |
| `"GET /api/users/:id"` | Parameter: `GET /api/users/123` |

## paymentProxy

Create proxy with a pre-configured `x402ResourceServer`.

```typescript
function paymentProxy(
  routes: Record<string, RouteDefinition>,
  server: x402ResourceServer,
  paywallConfig?: PaywallConfig,
): (request: NextRequest) => Promise<NextResponse>;
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `routes` | `Record<string, RouteDefinition>` | Route pattern to payment config mapping |
| `server` | `x402ResourceServer` | Pre-configured resource server with registered schemes |
| `paywallConfig` | `PaywallConfig` (optional) | Configuration for browser paywall UI |

## paymentProxyFromHTTPServer

Most advanced proxy variant. Uses an `x402HTTPResourceServer` for HTTP-level hooks.

```typescript
function paymentProxyFromHTTPServer(
  httpServer: x402HTTPResourceServer,
): (request: NextRequest) => Promise<NextResponse>;
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `httpServer` | `x402HTTPResourceServer` | HTTP server with routes and hooks configured |

## withX402

Wrap an individual route handler with payment protection.

```typescript
function withX402(
  handler: (request: NextRequest) => Promise<NextResponse>,
  routeConfig: RouteDefinition,
  server: x402ResourceServer,
): (request: NextRequest) => Promise<NextResponse>;
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `handler` | `(request: NextRequest) => Promise<NextResponse>` | The route handler to protect |
| `routeConfig` | `RouteDefinition` | Payment configuration for this route |
| `server` | `x402ResourceServer` | Pre-configured resource server |

### Settlement Behavior

- Payment is verified **before** the handler executes
- Payment is settled **only if** the handler returns a response with status < 400
- If the handler returns 4xx or 5xx, payment is **not settled** (user is not charged)

## withX402FromHTTPServer

Wrap a route handler using an `x402HTTPResourceServer` with hooks.

```typescript
function withX402FromHTTPServer(
  handler: (request: NextRequest) => Promise<NextResponse>,
  httpServer: x402HTTPResourceServer,
): (request: NextRequest) => Promise<NextResponse>;
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `handler` | `(request: NextRequest) => Promise<NextResponse>` | The route handler to protect |
| `httpServer` | `x402HTTPResourceServer` | HTTP server with hooks configured |

## RouteDefinition

```typescript
interface RouteDefinition {
  accepts: AcceptsConfig | AcceptsConfig[];
  description?: string;
  mimeType?: string;
  customPaywallHtml?: string;
  unpaidResponseBody?: (context: RequestContext) => {
    contentType: string;
    body: unknown;
  };
}
```

### AcceptsConfig

```typescript
interface AcceptsConfig {
  scheme: "exact";
  network: string;          // CAIP-2 identifier
  payTo: string;             // Algorand address (58 chars)
  price: string;             // Dollar amount, e.g., "$0.01", "$1.00"
  extra?: {
    asset?: string;          // ASA ID for token payments
  };
}
```

### Price Format

The `price` field uses dollar notation:

| Price | Atomic Units (6 decimals) |
|-------|--------------------------|
| `"$0.01"` | `10000` |
| `"$0.10"` | `100000` |
| `"$1.00"` | `1000000` |
| `"$5.00"` | `5000000` |

## PaywallConfig

```typescript
interface PaywallConfig {
  title?: string;
  description?: string;
  logoUrl?: string;
}
```

Used by the proxy pattern to render a browser-friendly paywall page when the request's `Accept` header includes `text/html`.

## x402HTTPResourceServer Hooks

### onProtectedRequest

Register a hook that runs before payment processing.

```typescript
httpServer.onProtectedRequest(async (context, routeConfig) => {
  // Return { grantAccess: true } to skip payment
  // Return { abort: true, reason: string } to reject the request
  // Return undefined to continue to payment flow
});
```

### Hook Return Values

| Return | Effect |
|--------|--------|
| `{ grantAccess: true }` | Skip payment, forward request to handler |
| `{ abort: true, reason: string }` | Reject request immediately |
| `undefined` | Continue to standard payment flow |

## Middleware Configuration

### middleware.ts Placement

The `middleware.ts` file must be at the project root (next to `app/`):

```
my-project/
  middleware.ts    <-- here
  app/
    page.tsx
    api/
      ...
```

### Matcher Configuration

Always specify which routes the middleware should intercept:

```typescript
export const config = {
  matcher: "/api/:path*",            // All API routes
};

// Or specific routes:
export const config = {
  matcher: [
    "/api/weather/:path*",
    "/api/premium/:path*",
    "/premium-article",
  ],
};
```

### Matcher Patterns

| Pattern | Matches |
|---------|---------|
| `"/api/:path*"` | All routes under `/api/` |
| `"/api/weather/:path*"` | All routes under `/api/weather/` |
| `"/premium-article"` | Exact path `/premium-article` |
| `["/api/*", "/premium/*"]` | Multiple patterns |

## Proxy Pattern vs. withX402 Comparison

| Feature | Proxy (middleware.ts) | withX402 (route.ts) |
|---------|----------------------|---------------------|
| File location | `middleware.ts` at root | Each `route.ts` file |
| Route config | Centralized in one place | Per-route, distributed |
| Settlement timing | On proxy forward | After handler success (status < 400) |
| Error handling | Proxy-level | Handler-level (no charge on 5xx) |
| Handler modification | None required | Must wrap each exported function |
| Multi-method support | Via `"GET /path"`, `"POST /path"` | Wrap `GET`, `POST`, `PUT` individually |
| HTTP hooks | Via `paymentProxyFromHTTPServer` | Via `withX402FromHTTPServer` |
| Paywall support | Built-in with `paywallConfig` | Manual |
| Best for | Multiple routes, same config | Per-route control, safe settlement |

## Proxy Pattern Variants

| Function | Server Creation | Hooks | Use Case |
|----------|----------------|-------|----------|
| `paymentProxyFromConfig` | Automatic | No | Simplest setup |
| `paymentProxy` | Manual | No | Custom server config |
| `paymentProxyFromHTTPServer` | Manual | Yes | Auth bypass, rate limiting |

## withX402 Pattern Variants

| Function | Server Type | Hooks | Use Case |
|----------|-------------|-------|----------|
| `withX402` | `x402ResourceServer` | No | Simple per-route protection |
| `withX402FromHTTPServer` | `x402HTTPResourceServer` | Yes | Per-route with hooks |

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PAY_TO` | Algorand address to receive payments | None | Yes |
| `FACILITATOR_URL` | URL of the facilitator server | `https://x402.org/facilitator` | No |
| `ALGOD_SERVER` | Algorand node URL | `https://testnet-api.algonode.cloud` | No |
| `ALGOD_TOKEN` | Algorand node API token | `""` | No |

## CAIP-2 Network Identifiers

| Network | Constant | Value |
|---------|----------|-------|
| Algorand Testnet | `ALGORAND_TESTNET_CAIP2` | `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` |
| Algorand Mainnet | `ALGORAND_MAINNET_CAIP2` | `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` |

## USDC ASA IDs

| Network | Constant | Value |
|---------|----------|-------|
| Testnet | `USDC_TESTNET_ASA_ID` | `"10458941"` |
| Mainnet | `USDC_MAINNET_ASA_ID` | `"31566704"` |

## Shared Config Pattern

For projects using the `withX402` pattern across multiple routes, create a shared config module:

```
lib/
  x402.ts          <-- shared x402Server, PAY_TO, NETWORK
app/
  api/
    weather/route.ts    <-- imports from @/lib/x402
    premium/route.ts    <-- imports from @/lib/x402
    generate/route.ts   <-- imports from @/lib/x402
```

The shared module creates and configures the `x402ResourceServer` once, and exports it along with common constants.

## Testing

1. Start with Algorand TestNet (`ALGORAND_TESTNET_CAIP2`)
2. Set `PAY_TO` to a testnet address
3. Fund the test client address with testnet ALGO and USDC (ASA 10458941)
4. Use the [Algorand Dispenser](https://bank.testnet.algorand.network/) for testnet ALGO
5. Test 402 responses by hitting protected routes without the `PAYMENT-SIGNATURE` header
6. Test payment flow using `x402Client` from `@x402/core/client`

## Key Considerations

- **Settlement safety**: Use `withX402` when you need guaranteed settlement only on success (e.g., AI generation that can fail)
- **Centralized config**: Use the proxy pattern when many routes share the same pricing structure
- **HTML pages**: Set `mimeType: "text/html"` for page routes to enable paywall rendering
- **Free routes**: Either exclude from the middleware matcher or do not wrap with `withX402`
- **Cross-chain**: Multiple `accepts` entries allow clients to pay on different networks
- **Dynamic pricing**: Route config can include callback functions for dynamic price computation

## External Links

- [x402-avm Next.js Examples](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402-avm Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Next.js App Router](https://nextjs.org/docs/app/building-your-application/routing)
- [@x402/core Reference](./use-typescript-x402-core-avm-reference.md)
