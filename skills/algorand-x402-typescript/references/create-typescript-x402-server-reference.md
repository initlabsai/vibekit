# x402-avm Server Reference

## @x402/express Package

### Installation

```bash
npm install @x402/express @x402/avm @x402/core express
```

With paywall:
```bash
npm install @x402/express @x402/avm @x402/core @x402/paywall express
```

### Middleware Functions

#### paymentMiddlewareFromConfig

The simplest middleware variant. Creates and configures the x402ResourceServer internally.

```typescript
function paymentMiddlewareFromConfig(
  routes: RoutesConfig | RouteConfig,
  facilitatorClient: HTTPFacilitatorClient,
  schemes?: SchemeConfig[],
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
): RequestHandler
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `routes` | `RoutesConfig \| RouteConfig` | Yes | Route payment configuration |
| `facilitatorClient` | `HTTPFacilitatorClient` | Yes | Client to communicate with facilitator |
| `schemes` | `SchemeConfig[]` | No | Scheme configurations for network matching |
| `paywallConfig` | `PaywallConfig` | No | Paywall UI configuration |
| `paywall` | `PaywallProvider` | No | Custom paywall provider |

#### paymentMiddleware

Uses a pre-configured x402ResourceServer instance. Choose this when you need to register multiple schemes or reuse the server.

```typescript
function paymentMiddleware(
  routes: RoutesConfig | RouteConfig,
  server: x402ResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
): RequestHandler
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `routes` | `RoutesConfig \| RouteConfig` | Yes | Route payment configuration |
| `server` | `x402ResourceServer` | Yes | Pre-configured resource server |
| `paywallConfig` | `PaywallConfig` | No | Paywall UI configuration |
| `paywall` | `PaywallProvider` | No | Custom paywall provider |

#### paymentMiddlewareFromHTTPServer

The most advanced variant. Uses x402HTTPResourceServer with hooks for custom access control.

```typescript
function paymentMiddlewareFromHTTPServer(
  httpServer: x402HTTPResourceServer,
): RequestHandler
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `httpServer` | `x402HTTPResourceServer` | Yes | HTTP server with hooks configured |

## @x402/hono Package

### Installation

```bash
npm install @x402/hono @x402/avm @x402/core hono
```

Node.js server:
```bash
npm install @x402/hono @x402/avm @x402/core hono @hono/node-server
```

### Middleware Functions

The Hono package exports the same three middleware variants as Express, returning Hono `MiddlewareHandler` instead of Express `RequestHandler`.

#### paymentMiddlewareFromConfig

```typescript
function paymentMiddlewareFromConfig(
  routes: RoutesConfig | RouteConfig,
  facilitatorClient: HTTPFacilitatorClient,
  schemes?: SchemeConfig[],
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart?: boolean,  // default: true; set false for serverless
): MiddlewareHandler
```

The `syncFacilitatorOnStart` parameter is unique to Hono. Set it to `false` for Cloudflare Workers and other serverless environments to avoid cold-start delays.

#### paymentMiddleware

```typescript
function paymentMiddleware(
  routes: RoutesConfig | RouteConfig,
  server: x402ResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
): MiddlewareHandler
```

#### paymentMiddlewareFromHTTPServer

```typescript
function paymentMiddlewareFromHTTPServer(
  httpServer: x402HTTPResourceServer,
): MiddlewareHandler
```

## Route Configuration

### RoutesConfig Type

```typescript
type RoutesConfig = Record<string, RouteConfig>;
```

Keys are route patterns in the format `"METHOD /path"` or just `"/path"` (matches all methods).

**Pattern syntax:**
- `"GET /api/weather"` -- exact match, GET only
- `"POST /api/generate"` -- exact match, POST only
- `"GET /api/premium/*"` -- wildcard, matches all sub-paths
- `"/api/resource"` -- matches all HTTP methods
- `"GET /api/lookup/:id"` -- path parameters (Express/Hono style)

### RouteConfig Type

```typescript
interface RouteConfig {
  accepts: PaymentOption | PaymentOption[];
  resource?: string;
  description?: string;
  mimeType?: string;
  customPaywallHtml?: string;
  unpaidResponseBody?: (context: RequestContext) => {
    contentType: string;
    body: any;
  };
  extensions?: Record<string, unknown>;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accepts` | `PaymentOption \| PaymentOption[]` | Yes | Payment configuration(s) |
| `resource` | `string` | No | Resource identifier URL |
| `description` | `string` | No | Human-readable description |
| `mimeType` | `string` | No | Response MIME type (use `"text/html"` for paywall) |
| `customPaywallHtml` | `string` | No | Custom HTML for browser paywall |
| `unpaidResponseBody` | `Function` | No | Preview content for unpaid API requests |
| `extensions` | `Record<string, unknown>` | No | Protocol extensions (e.g., bazaar) |

### PaymentOption Type

```typescript
interface PaymentOption {
  scheme: string;
  payTo: string;
  price: Price | DynamicPrice;
  network: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scheme` | `string` | Yes | Payment scheme (`"exact"`) |
| `payTo` | `string` | Yes | Algorand address to receive payment (58 chars) |
| `price` | `Price \| DynamicPrice` | Yes | USD price string (`"$0.01"`) or dynamic function |
| `network` | `string` | Yes | CAIP-2 network identifier |
| `maxTimeoutSeconds` | `number` | No | Payment validity window (default: 60) |
| `extra` | `Record<string, unknown>` | No | AVM-specific: `feePayer`, `asset`, `decimals` |

### DynamicPrice Type

```typescript
type DynamicPrice = (context: RequestContext) => Price;
type Price = string;  // e.g., "$0.01"
```

## Core Server Classes

### HTTPFacilitatorClient

```typescript
import { HTTPFacilitatorClient } from "@x402/core/server";

const client = new HTTPFacilitatorClient({
  url?: string;     // Facilitator URL (default: "https://x402.org/facilitator")
  headers?: Record<string, string>;  // Custom headers (e.g., auth)
});
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `supported()` | `Promise<SupportedResponse>` | Get supported networks and schemes |
| `verify({ paymentPayload, paymentRequirements })` | `Promise<VerifyResponse>` | Verify a payment |
| `settle({ paymentPayload, paymentRequirements })` | `Promise<SettleResponse>` | Settle a payment |

### x402ResourceServer

```typescript
import { x402ResourceServer } from "@x402/core/server";

const server = new x402ResourceServer(facilitatorClient);
```

Must register AVM scheme after creation:
```typescript
import { ExactAvmScheme } from "@x402/avm/exact/server";
server.register("algorand:*", new ExactAvmScheme());
```

### x402HTTPResourceServer

```typescript
import { x402HTTPResourceServer } from "@x402/core/server";

const httpServer = new x402HTTPResourceServer(resourceServer, routes);
```

**Hooks:**

| Hook | Signature | Description |
|------|-----------|-------------|
| `onProtectedRequest` | `(context, routeConfig) => Promise<{ grantAccess: true } \| { abort: true, reason: string } \| undefined>` | Intercept before payment check |

Return `{ grantAccess: true }` to bypass payment (e.g., API key), `{ abort: true, reason }` to reject, or `undefined` to continue to payment flow.

## CAIP-2 Network Constants

| Constant | Value | Import |
|----------|-------|--------|
| `ALGORAND_TESTNET_CAIP2` | `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` | `@x402/avm` |
| `ALGORAND_MAINNET_CAIP2` | `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` | `@x402/avm` |

## USDC ASA Constants

| Constant | Value | Import |
|----------|-------|--------|
| `USDC_TESTNET_ASA_ID` | `"10458941"` | `@x402/avm` |
| `USDC_MAINNET_ASA_ID` | `"31566704"` | `@x402/avm` |
| `USDC_DECIMALS` | `6` | `@x402/avm` |

## Paywall Configuration

```typescript
interface PaywallConfig {
  title?: string;
  description?: string;
  logoUrl?: string;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
  };
}
```

### Custom PaywallProvider

```typescript
interface PaywallProvider {
  generatePaywall(
    paymentRequirements: PaymentRequirements,
    routeConfig: RouteConfig,
    paywallConfig?: PaywallConfig,
  ): string;  // Returns HTML string
}
```

## Environment Variables

### Resource Server

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `AVM_ADDRESS` / `RESOURCE_PAY_TO` | Yes | Algorand address receiving payments | -- |
| `FACILITATOR_URL` | Yes | URL of facilitator server | -- |
| `PORT` | No | Server port | `4021` |

### Facilitator Server

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `AVM_PRIVATE_KEY` | Yes | Base64-encoded 64-byte key | -- |
| `ALGOD_SERVER` | No | Algorand node URL | `https://testnet-api.algonode.cloud` |
| `ALGOD_TOKEN` | No | Algorand node API token | `""` |
| `FACILITATOR_PORT` / `PORT` | No | Server port | `4020` |

## Facilitator HTTP Endpoints

A facilitator server exposes three endpoints:

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/verify` | POST | `{ paymentPayload, paymentRequirements }` | `{ isValid, invalidReason? }` |
| `/settle` | POST | `{ paymentPayload, paymentRequirements }` | `{ success, transaction?, network?, error? }` |
| `/supported` | GET | -- | `{ networks, schemes }` |

## Fee Abstraction

Fee abstraction is configured through the `extra.feePayer` field in route configuration:

```typescript
extra: {
  feePayer: "FACILITATOR_FEE_PAYER_ADDRESS",
}
```

When a client sees `feePayer` in the payment requirements, it creates a 2-transaction atomic group:
1. **Payment transaction** (signed by client): ASA transfer to `payTo`, fee=0
2. **Fee transaction** (unsigned, for facilitator): self-payment, fee covers both transactions

The facilitator signs the fee transaction during settlement.

## Deployment Patterns

### Express (Node.js)

Standard `app.listen()` on a port. Suitable for Docker, VMs, or managed Node.js hosting.

### Hono (Node.js)

Use `@hono/node-server` with `serve()`. Same deployment as Express.

### Hono (Cloudflare Workers)

Export the Hono app as default export. Set `syncFacilitatorOnStart: false` to avoid cold-start delays. Use `wrangler.toml` for environment variables.

### Hono (Bun)

Export `{ port, fetch: app.fetch }` as default export.

### Hono (Deno)

Use `Deno.serve({ port }, app.fetch)`.

## Testing

### Manual Test Flow

1. Start facilitator: `PORT=4020 AVM_PRIVATE_KEY=... ts-node facilitator.ts`
2. Start resource server: `PORT=4021 FACILITATOR_URL=http://localhost:4020 AVM_ADDRESS=... ts-node server.ts`
3. Test public route: `curl http://localhost:4021/api/health` (should return 200)
4. Test protected route: `curl http://localhost:4021/api/weather` (should return 402)
5. Run client: `AVM_PRIVATE_KEY=... RESOURCE_SERVER_URL=http://localhost:4021 ts-node client.ts`

### Using Online Facilitator

Set `FACILITATOR_URL=https://facilitator.goplausible.xyz` to skip running a local facilitator.

## External Resources

- [@x402/express on npm](https://www.npmjs.com/package/@x402/express)
- [@x402/hono on npm](https://www.npmjs.com/package/@x402/hono)
- [@x402/core on npm](https://www.npmjs.com/package/@x402/core)
- [@x402/avm on npm](https://www.npmjs.com/package/@x402/avm)
- [@x402/paywall on npm](https://www.npmjs.com/package/@x402/paywall)
- [GoPlausible x402-avm Examples](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [GoPlausible x402-avm Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [Express.js Documentation](https://expressjs.com/)
- [Hono Documentation](https://hono.dev/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
