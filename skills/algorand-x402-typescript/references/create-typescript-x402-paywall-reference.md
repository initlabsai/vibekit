# x402 Paywall Reference

Detailed API reference for `@x402/paywall` and framework middleware packages.

## Package: @x402/paywall

### Installation

```bash
npm install @x402/paywall @x402/avm @x402/core
```

### Exports from @x402/paywall

| Export | Type | Description |
|--------|------|-------------|
| `createPaywall` | Function | Creates a new `PaywallBuilder` instance |
| `PaywallBuilder` | Class | Builder for configuring and building paywall providers |
| `avmPaywall` | Object | AVM network handler (algorand:*) |
| `evmPaywall` | Object | EVM network handler (eip155:*) |
| `svmPaywall` | Object | SVM network handler (solana:*) |
| `PaywallProvider` | Type | Interface for paywall HTML generation |
| `PaywallConfig` | Type | Configuration options for paywall branding |
| `PaywallNetworkHandler` | Type | Interface for network-specific handlers |
| `PaymentRequired` | Type | 402 response structure |
| `PaymentRequirements` | Type | Individual payment requirement |

### Exports from @x402/paywall/avm

| Export | Type | Description |
|--------|------|-------------|
| `avmPaywall` | Object | AVM paywall handler (same as main export) |

---

## PaywallBuilder

### createPaywall()

Factory function that creates a new `PaywallBuilder` instance.

```typescript
function createPaywall(): PaywallBuilder;
```

### PaywallBuilder Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `.withNetwork(handler)` | `(handler: PaywallNetworkHandler) => PaywallBuilder` | Register a network-specific paywall handler. Order matters -- first match wins. |
| `.withConfig(config)` | `(config: PaywallConfig) => PaywallBuilder` | Set default paywall configuration. |
| `.build()` | `() => PaywallProvider` | Build and return a `PaywallProvider`. |

### PaywallProvider

```typescript
interface PaywallProvider {
  /**
   * Generate an HTML paywall page for the given payment requirements.
   * @param paymentRequired - The full 402 response from the server
   * @param config - Optional runtime config override
   * @returns Full HTML page as a string
   */
  generateHtml(paymentRequired: PaymentRequired, config?: PaywallConfig): string;
}
```

### PaywallConfig

```typescript
interface PaywallConfig {
  /** App name shown in wallet connection modal title */
  appName?: string;
  /** App logo URL shown in the paywall header */
  appLogo?: string;
  /** URL of the content being accessed (used for retry after payment) */
  currentUrl?: string;
  /** Whether to use testnet (default: true) */
  testnet?: boolean;
}
```

---

## PaywallNetworkHandler

Interface for creating custom network-specific paywall handlers.

```typescript
interface PaywallNetworkHandler {
  /**
   * Check if this handler supports the given payment requirement.
   * @param requirement - A single payment requirement from the 402 response
   * @returns true if this handler can generate HTML for this requirement
   */
  supports(requirement: PaymentRequirements): boolean;

  /**
   * Generate the full HTML paywall page.
   * @param requirement - The matched payment requirement
   * @param paymentRequired - The full PaymentRequired response
   * @param config - Paywall configuration
   * @returns Full HTML page as a string
   */
  generateHtml(
    requirement: PaymentRequirements,
    paymentRequired: PaymentRequired,
    config: PaywallConfig,
  ): string;
}
```

### Built-in Handlers

| Handler | Supports | Networks |
|---------|----------|----------|
| `avmPaywall` | `network.startsWith("algorand:")` | Algorand Testnet, Algorand Mainnet |
| `evmPaywall` | `network.startsWith("eip155:")` | Base, Ethereum, etc. |
| `svmPaywall` | `network.startsWith("solana:")` | Solana |

### Handler Selection

When `PaywallProvider.generateHtml()` is called, it iterates through registered handlers in order. The first handler whose `supports()` returns true for any of the `accepts` requirements is used to generate the HTML.

---

## avmPaywall Handler

The `avmPaywall` handler generates a full React-based HTML page with:

1. **window.x402 global** -- Embeds payment configuration for the client-side app
2. **Wallet discovery** -- Uses `@wallet-standard/app` to find Algorand wallets
3. **Wallet selection UI** -- Dropdown with icons for detected wallets
4. **Balance checking** -- Reads USDC ASA balance for the connected account
5. **Transaction signing** -- Uses `algorand:signTransaction` wallet-standard feature
6. **Payment submission** -- Retries original request with `PAYMENT-SIGNATURE` header
7. **Automatic redirect** -- Redirects to paid content after successful payment

### Supported Wallets

| Wallet | Type | Feature |
|--------|------|---------|
| Pera Wallet | Mobile + WalletConnect | `algorand:signTransaction` |
| Defly Wallet | Mobile + WalletConnect | `algorand:signTransaction` |
| Lute Wallet | Browser Extension | `algorand:signTransaction` |

### window.x402 Configuration Object

The generated HTML page injects this configuration:

```javascript
window.x402 = {
  amount: 0.01,           // Amount in USDC (human-readable)
  paymentRequired: {...},  // Full PaymentRequired response
  testnet: true,           // Network mode
  currentUrl: "...",       // URL to retry after payment
  config: { chainConfig: {} },
  appName: "My App",
  appLogo: "https://...",
};
```

---

## Framework Middleware

### @x402/express

| Function | Signature | Description |
|----------|-----------|-------------|
| `paymentMiddleware` | `(routes, server, config?, paywall?)` | Express middleware |
| `paymentMiddlewareFromHTTPServer` | `(httpServer, config?, paywall?)` | Express middleware from HTTP server |
| `paymentMiddlewareFromConfig` | `(routes, facilitator?, schemes?, config?, paywall?)` | Express middleware from config |
| `x402ResourceServer` | Class | Resource server for facilitator communication |
| `x402HTTPResourceServer` | Class | HTTP-aware resource server with route config |

### @x402/hono

| Function | Signature | Description |
|----------|-----------|-------------|
| `paymentMiddleware` | `(routes, server, config?, paywall?)` | Hono middleware |
| `paymentMiddlewareFromHTTPServer` | `(httpServer, config?, paywall?)` | Hono middleware from HTTP server |
| `paymentMiddlewareFromConfig` | `(routes, facilitator?, schemes?, config?, paywall?)` | Hono middleware from config |
| `x402ResourceServer` | Class | Resource server for facilitator communication |

### @x402/next

| Function | Signature | Description |
|----------|-----------|-------------|
| `paymentProxy` | `(routes, server, config?, paywall?)` | Next.js middleware proxy |
| `withX402` | `(handler, routeConfig, server, config?, paywall?)` | Next.js route wrapper |
| `paymentProxyFromHTTPServer` | `(httpServer, config?, paywall?)` | Next.js proxy from HTTP server |
| `paymentProxyFromConfig` | `(routes, facilitator?, schemes?, config?, paywall?)` | Next.js proxy from config |
| `x402ResourceServer` | Class | Resource server for facilitator communication |

---

## Route Configuration

```typescript
interface RouteConfig {
  [path: string]: {
    /** Payment requirements -- single object or array for multi-network */
    accepts: PaymentAccepts | PaymentAccepts[];
    /** Human-readable description of the resource */
    description: string;
    /** MIME type of the response */
    mimeType: string;
  };
}

interface PaymentAccepts {
  /** Payment scheme (currently "exact") */
  scheme: string;
  /** CAIP-2 network identifier */
  network: string;
  /** Asset identifier (ASA ID for Algorand, contract address for EVM) */
  asset: string;
  /** Receiver address */
  payTo: string;
  /** Price string (e.g., "$0.01") */
  price: string;
  /** Maximum timeout in seconds for payment validity */
  maxTimeoutSeconds: number;
}
```

---

## Bundle Sizes

The paywall system is designed for tree-shaking. Import only the network handlers you need:

```typescript
// AVM only -- smallest bundle
import { avmPaywall } from "@x402/paywall/avm";

// AVM + EVM
import { avmPaywall, evmPaywall } from "@x402/paywall";

// All networks
import { avmPaywall, evmPaywall, svmPaywall } from "@x402/paywall";
```

---

## USDC Asset IDs

| Network | ASA ID | CAIP-2 |
|---------|--------|--------|
| Algorand Testnet | `10458941` | `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=` |
| Algorand Mainnet | `31566704` | `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=` |

---

## Testing

### Testing the Paywall HTML Generation

```typescript
import { createPaywall, avmPaywall } from "@x402/paywall";

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withConfig({ appName: "Test App", testnet: true })
  .build();

const html = paywall.generateHtml({
  x402Version: 2,
  accepts: [{
    scheme: "exact",
    network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    asset: "10458941",
    payTo: "TEST_ADDRESS",
    amount: "10000",
    maxTimeoutSeconds: 300,
  }],
  resource: {
    url: "https://test.example.com/premium",
    description: "Test content",
    mimeType: "application/json",
  },
});

// Verify the HTML contains expected elements
console.assert(html.includes("window.x402"));
console.assert(html.includes("Test App"));
```

### Testing Middleware Integration

```bash
# Start server
npm start

# Test JSON 402 response (API client)
curl -H "Accept: application/json" http://localhost:3000/api/premium

# Test HTML paywall (browser-like)
curl -H "Accept: text/html" http://localhost:3000/api/premium

# Test with payment header (after obtaining one)
curl -H "PAYMENT-SIGNATURE: <base64-payload>" http://localhost:3000/api/premium
```

---

## Important Notes

- The paywall HTML page is a self-contained React application served inline. No additional static files or CDN dependencies are required.
- `withNetwork()` order determines handler priority. Register your preferred network first.
- The `testnet` flag in `PaywallConfig` affects which Algod endpoint the paywall page connects to (AlgoNode testnet vs mainnet).
- Route paths support Express-style patterns (`:param`, `*` wildcards).
- The `price` field in route config accepts human-readable strings like `"$0.01"` which are converted to microunits internally.

---

## External Resources

- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402-avm Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [@wallet-standard/app](https://github.com/wallet-standard/wallet-standard)
- [@txnlab/use-wallet](https://txnlab.gitbook.io/use-wallet)
