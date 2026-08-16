# x402 HTTP Client Reference

Detailed API reference for `@x402/fetch`, `@x402/axios`, and `@x402/avm` client packages.

## Package: @x402/fetch

### Installation

```bash
npm install @x402/fetch @x402/avm algosdk
```

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `wrapFetchWithPayment` | Function | Wraps fetch with automatic 402 payment handling |
| `wrapFetchWithPaymentFromConfig` | Function | Config-based variant of the above |
| `x402Client` | Class | Core client for managing payment schemes |
| `x402HTTPClient` | Class | HTTP-level payment client |
| `decodePaymentResponseHeader` | Function | Decodes the PAYMENT-RESPONSE header |
| `PaymentPolicy` | Type | Policy function type for filtering requirements |
| `SchemeRegistration` | Type | Scheme registration configuration |
| `x402ClientConfig` | Type | Configuration object type |
| `PaymentRequired` | Type | 402 response structure |
| `PaymentRequirements` | Type | Individual payment requirement |
| `PaymentPayload` | Type | Signed payment payload |
| `Network` | Type | Network identifier string type |
| `SchemeNetworkClient` | Type | Client-side scheme interface |

### wrapFetchWithPayment

Wraps a standard `fetch` function with automatic 402 payment handling.

```typescript
function wrapFetchWithPayment(
  fetch: typeof globalThis.fetch,
  client: x402Client | x402HTTPClient,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
```

**Flow:**
1. Makes the initial HTTP request normally
2. If the server responds with 402, parses payment requirements from the response
3. Selects a suitable payment method based on registered schemes
4. Creates a payment payload by signing a transaction group
5. Retries the request with the `PAYMENT-SIGNATURE` header
6. If the response is anything other than 402, returns it as-is

### wrapFetchWithPaymentFromConfig

Config-based variant that creates the `x402Client` internally.

```typescript
function wrapFetchWithPaymentFromConfig(
  fetch: typeof globalThis.fetch,
  config: x402ClientConfig,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
```

### x402ClientConfig

```typescript
interface x402ClientConfig {
  schemes: Array<{
    network: string;       // CAIP-2 identifier or wildcard ("algorand:*")
    client: SchemeNetworkClient;
  }>;
  policies?: PaymentPolicy[];
}
```

### PaymentPolicy

```typescript
type PaymentPolicy = (
  version: number,
  requirements: PaymentRequirements[],
) => PaymentRequirements[];
```

Policies are applied in registration order. Each policy receives the remaining requirements and returns a filtered/transformed list.

### decodePaymentResponseHeader

```typescript
function decodePaymentResponseHeader(header: string): any;
```

Decodes the `PAYMENT-RESPONSE` header returned by the server after settlement.

---

## Package: @x402/axios

### Installation

```bash
npm install @x402/axios @x402/avm algosdk axios
```

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `wrapAxiosWithPayment` | Function | Wraps Axios instance with 402 payment interceptor |
| `wrapAxiosWithPaymentFromConfig` | Function | Config-based variant of the above |
| `x402Client` | Class | Core client for managing payment schemes |
| `x402HTTPClient` | Class | HTTP-level payment client |
| `decodePaymentResponseHeader` | Function | Decodes the PAYMENT-RESPONSE header |
| `PaymentPolicy` | Type | Policy function type for filtering requirements |
| `SchemeRegistration` | Type | Scheme registration configuration |
| `x402ClientConfig` | Type | Configuration object type |
| `PaymentRequired` | Type | 402 response structure |
| `PaymentRequirements` | Type | Individual payment requirement |
| `PaymentPayload` | Type | Signed payment payload |
| `Network` | Type | Network identifier string type |
| `SchemeNetworkClient` | Type | Client-side scheme interface |

### wrapAxiosWithPayment

Adds a response interceptor that handles 402 responses by signing and submitting payment transactions.

```typescript
function wrapAxiosWithPayment(
  axiosInstance: AxiosInstance,
  client: x402Client | x402HTTPClient,
): AxiosInstance;
```

Returns the same Axios instance (mutated with the interceptor). The interceptor:
- Catches 402 responses
- Parses payment requirements (headers for V2, body for V1)
- Creates payment payload via `x402Client`
- Marks the request with `__is402Retry = true` to prevent infinite loops
- Retries with `PAYMENT-SIGNATURE` header

### wrapAxiosWithPaymentFromConfig

```typescript
function wrapAxiosWithPaymentFromConfig(
  axiosInstance: AxiosInstance,
  config: x402ClientConfig,
): AxiosInstance;
```

### Interceptor Behavior

```
Client Request --> Axios sends request --> Server Response
                                              |
                       Status != 402 -------> Return response normally
                       Status == 402 -------> Already retried? --> Reject
                                              |
                                              Parse PaymentRequired
                                              Create payment payload
                                              Retry with PAYMENT-SIGNATURE
                                              Return retried response
```

Key details:
- **Single retry**: Only retries once per 402
- **Request mutation**: Modifies original config and retries via `axiosInstance.request()`
- **Concurrent requests**: Each 402 is handled independently
- **Interceptor order**: Payment interceptor should be added last

---

## Package: @x402/avm

### Installation

```bash
npm install @x402/avm algosdk
```

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `ExactAvmScheme` | Class | Algorand exact payment scheme (client) |
| `ClientAvmSigner` | Interface | Signer interface for client wallets |
| `ClientAvmConfig` | Interface | Algod client configuration |
| `ALGORAND_TESTNET_CAIP2` | Constant | `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` |
| `ALGORAND_MAINNET_CAIP2` | Constant | `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` |
| `isAvmSignerWallet` | Function | Type guard for ClientAvmSigner |

### ClientAvmSigner Interface

The interface that bridges wallets (browser or server) to the x402 payment system.

```typescript
interface ClientAvmSigner {
  /** The Algorand address of the payer */
  address: string;

  /**
   * Sign one or more transactions in a group.
   * @param txns - Array of unsigned transaction bytes (msgpack)
   * @param indexesToSign - Optional indices of transactions to sign.
   *                        If omitted, sign all transactions.
   * @returns Array where signed transactions contain the signed blob,
   *          and skipped transactions are null
   */
  signTransactions(
    txns: Uint8Array[],
    indexesToSign?: number[],
  ): Promise<(Uint8Array | null)[]>;
}
```

### Subpath: @x402/avm/exact/client

| Export | Type | Description |
|--------|------|-------------|
| `ExactAvmScheme` | Class | AVM exact scheme for client-side payment payload creation |
| `ClientAvmConfig` | Interface | Optional Algod configuration |

### ExactAvmScheme

```typescript
class ExactAvmScheme {
  constructor(signer: ClientAvmSigner, config?: ClientAvmConfig);
  readonly scheme: "exact";
  createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<PaymentPayloadResult>;
}
```

Register with the builder pattern:

```typescript
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer));
```

### ClientAvmConfig

```typescript
interface AvmClientConfig {
  /** The client signer implementation */
  signer: ClientAvmSigner;

  /** Optional Algod configuration */
  algodConfig?: {
    /** Algod URL (defaults to AlgoNode testnet/mainnet) */
    algodUrl?: string;
    /** Algod API token */
    algodToken?: string;
    /** Pre-configured Algodv2 client */
    algodClient?: algosdk.Algodv2;
  };

  /** Optional: restrict to specific networks */
  networks?: string[];
}
```

---

## x402Client Class

### Constructor

```typescript
const client = new x402Client(selector?: PaymentRequirementsSelector);
```

Optional `selector` overrides default selection logic for choosing among payment requirements.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `registerPolicy` | `(policy: PaymentPolicy) => x402Client` | Register a payment policy (chainable) |
| `onBeforePaymentCreation` | `(hook: BeforePaymentHook) => void` | Register pre-payment hook |
| `onAfterPaymentCreation` | `(hook: AfterPaymentHook) => void` | Register post-payment hook |
| `onPaymentCreationFailure` | `(hook: PaymentFailureHook) => void` | Register failure hook |

### Lifecycle Hooks

**BeforePaymentCreation:**
```typescript
client.onBeforePaymentCreation(async (context) => {
  // context.selectedRequirements - the chosen payment requirements
  // context.paymentRequired - full 402 response
  // Return { abort: true, reason: "..." } to cancel payment
});
```

**AfterPaymentCreation:**
```typescript
client.onAfterPaymentCreation(async (context) => {
  // context.paymentPayload - the signed payload
  // context.paymentRequired - full 402 response
});
```

**PaymentCreationFailure:**
```typescript
client.onPaymentCreationFailure(async (context) => {
  // context.error - the error that occurred
  // Return { recovered: true, payload: ... } to provide fallback
});
```

---

## Environment Variables

| Variable | Description | Format |
|----------|-------------|--------|
| `AVM_PRIVATE_KEY` | Algorand private key | Base64-encoded 64-byte key (32-byte seed + 32-byte pubkey) |
| `ALGOD_TESTNET_URL` | Custom Algod testnet URL | URL string (default: `https://testnet-api.algonode.cloud`) |
| `ALGOD_MAINNET_URL` | Custom Algod mainnet URL | URL string (default: `https://mainnet-api.algonode.cloud`) |

---

## Network Constants

| Constant | Value |
|----------|-------|
| `ALGORAND_TESTNET_CAIP2` | `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` |
| `ALGORAND_MAINNET_CAIP2` | `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` |
| `V1_ALGORAND_TESTNET` | `"algorand-testnet"` |
| `V1_ALGORAND_MAINNET` | `"algorand-mainnet"` |

---

## Testing

### Unit Testing a Client

```typescript
import { x402Client } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";

// Create a mock signer for testing
const mockSigner = {
  address: "TEST_ADDRESS_58_CHARS_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) => {
    return txns.map((_, i) => {
      if (indexesToSign && !indexesToSign.includes(i)) return null;
      return new Uint8Array([0x80]); // mock signed bytes
    });
  },
};

const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(mockSigner));
```

### Integration Testing with Real Transactions

```bash
# Set up environment
export AVM_PRIVATE_KEY="your-base64-key-here"

# Run with tsx
npx tsx client-test.ts https://api.example.com/paid-endpoint
```

---

## Important Notes

- `AVM_PRIVATE_KEY` is a Base64-encoded 64-byte key. The first 32 bytes are the seed, the last 32 bytes are the public key.
- Address derivation always uses `algosdk.encodeAddress(secretKey.slice(32))` -- the public key portion.
- The `algorand:*` wildcard in config-based setups matches any Algorand network (testnet or mainnet).
- Policies are composable and applied in order. An empty result from any policy means no payment options are available.
- The Axios interceptor modifies the instance in place and returns it. Do not create a new instance after wrapping.

---

## External Resources

- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402-avm Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [@txnlab/use-wallet Documentation](https://txnlab.gitbook.io/use-wallet)
- [algosdk TypeScript Reference](https://algorand.github.io/js-algorand-sdk/)
