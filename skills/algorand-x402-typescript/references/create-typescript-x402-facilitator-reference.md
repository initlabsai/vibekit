# x402 Facilitator Reference

Detailed API reference for `@x402/core/facilitator`, `@x402/avm/exact/facilitator`, and `@x402/extensions` packages.

## Package: @x402/core

### Installation

```bash
npm install @x402/core @x402/avm algosdk
```

### Facilitator Exports from @x402/core/facilitator

| Export | Type | Description |
|--------|------|-------------|
| `x402Facilitator` | Class | Core facilitator for verifying and settling payments |

### Server Exports from @x402/core/server

| Export | Type | Description |
|--------|------|-------------|
| `x402ResourceServer` | Class | Transport-agnostic resource server |
| `x402HTTPResourceServer` | Class | HTTP-aware resource server with route config |
| `HTTPFacilitatorClient` | Class | Client for communicating with a remote facilitator |
| `ResourceConfig` | Type | Resource payment configuration |
| `RouteConfig` | Type | HTTP route configuration |

---

## x402Facilitator Class

The core facilitator that verifies payment validity and settles transactions on-chain.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `verify` | `(payload, requirements) => Promise<VerifyResult>` | Verify a payment payload without submitting |
| `settle` | `(payload, requirements) => Promise<SettleResult>` | Verify and settle a payment on-chain |
| `getSupportedNetworks` | `() => SupportedNetworks` | Return all registered networks |
| `onBeforeVerify` | `(hook) => void` | Register pre-verification hook |
| `onAfterVerify` | `(hook) => void` | Register post-verification hook |
| `onBeforeSettle` | `(hook) => void` | Register pre-settlement hook |
| `onAfterSettle` | `(hook) => void` | Register post-settlement hook |

### verify()

Validates a payment payload against requirements without submitting to the network. Checks:
- Transaction group structure
- Amounts and recipients
- Timing (not expired)
- Signatures (via simulation)

```typescript
const result = await facilitator.verify(paymentPayload, paymentRequirements);
// result: { isValid: boolean, error?: string }
```

### settle()

Verifies the payment, co-signs the fee-payer transaction, and submits the group to the network.

```typescript
const result = await facilitator.settle(paymentPayload, paymentRequirements);
// result: { success: boolean, txId?: string, error?: string }
```

---

## FacilitatorAvmSigner Interface

The interface that bridges the facilitator to the Algorand blockchain.

```typescript
interface FacilitatorAvmSigner {
  /**
   * Returns the list of Algorand addresses this facilitator controls.
   * Used to identify which transactions in a group the facilitator should sign.
   */
  getAddresses(): string[];

  /**
   * Sign a single unsigned transaction.
   * @param txn - Raw unsigned transaction bytes (msgpack)
   * @param senderAddress - The sender address of the transaction
   * @returns Signed transaction bytes
   */
  signTransaction(txn: Uint8Array, senderAddress: string): Promise<Uint8Array>;

  /**
   * Get an Algodv2 client configured for the specified network.
   * @param network - CAIP-2 network identifier
   * @returns Configured algosdk.Algodv2 instance
   */
  getAlgodClient(network: string): algosdk.Algodv2;

  /**
   * Simulate a transaction group for verification without submission.
   * Must handle both signed and unsigned transactions in the group.
   * Use allowEmptySignatures: true for unsigned transactions.
   * @param txns - Array of transaction bytes (mixed signed/unsigned)
   * @param network - CAIP-2 network identifier
   * @returns Simulation result
   */
  simulateTransactions(txns: Uint8Array[], network: string): Promise<any>;

  /**
   * Send signed transactions to the Algorand network.
   * All transactions must be fully signed before calling this method.
   * Concatenate bytes with Buffer.concat() before sendRawTransaction.
   * @param signedTxns - Array of signed transaction bytes
   * @param network - CAIP-2 network identifier
   * @returns Transaction ID
   */
  sendTransactions(signedTxns: Uint8Array[], network: string): Promise<string>;

  /**
   * Wait for a transaction to be confirmed on the network.
   * @param txId - Transaction ID to wait for
   * @param network - CAIP-2 network identifier
   * @param waitRounds - Number of rounds to wait (default: 4)
   * @returns Confirmation result
   */
  waitForConfirmation(
    txId: string,
    network: string,
    waitRounds?: number,
  ): Promise<any>;
}
```

### Implementation Notes

**simulateTransactions**: Must handle mixed signed/unsigned transaction bytes. Wrap unsigned transactions with `new algosdk.SignedTransaction({ txn })`:

```typescript
simulateTransactions: async (txns, network) => {
  const stxns = txns.map((txnBytes) => {
    try {
      return algosdk.decodeSignedTransaction(txnBytes);
    } catch {
      const txn = algosdk.decodeUnsignedTransaction(txnBytes);
      return new algosdk.SignedTransaction({ txn });
    }
  });
  // ...
}
```

**sendTransactions**: Concatenate all signed transaction bytes before sending:

```typescript
sendTransactions: async (signedTxns, network) => {
  const combined = Buffer.concat(signedTxns.map(t => Buffer.from(t)));
  const { txId } = await algodClient.sendRawTransaction(combined).do();
  return txId;
}
```

---

## Subpath: @x402/avm/exact/facilitator

### ExactAvmScheme (Facilitator)

The AVM exact payment scheme for facilitators. Register with the builder pattern on an `x402Facilitator` instance.

```typescript
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

class ExactAvmScheme {
  constructor(signer: FacilitatorAvmSigner);
  readonly scheme: "exact";
  readonly caipFamily: "algorand:*";
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
  // ...plus getExtra() and getSigners() introspection methods
}

// Usage:
facilitator.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer));
```

Note: The `ExactAvmScheme` class is exported from three import paths with different constructor signatures:
- `@x402/avm/exact/client` -- For client-side (takes `ClientAvmSigner`)
- `@x402/avm/exact/server` -- For resource server (no signer needed)
- `@x402/avm/exact/facilitator` -- For facilitator (takes `FacilitatorAvmSigner`)

---

## Package: @x402/extensions

### Installation

```bash
npm install @x402/extensions @x402/core
```

### Bazaar Discovery Exports

| Export | Type | Description |
|--------|------|-------------|
| `BAZAAR` | Constant | Extension key string |
| `declareDiscoveryExtension` | Function | Declares discovery metadata for a resource |
| `bazaarResourceServerExtension` | Object | Resource server extension that enriches declarations |
| `extractDiscoveryInfo` | Function | Extracts discovery info from payment flow |
| `validateDiscoveryExtension` | Function | Validates a discovery extension object |
| `validateAndExtract` | Function | Validates and extracts in one step |
| `extractDiscoveryInfoFromExtension` | Function | Lower-level extraction from extension object |
| `withBazaar` | Function | Extends a facilitator client with Bazaar query capabilities |
| `WithExtensions` | Type | Type utility for chaining extensions |
| `DiscoveryInfo` | Type | Discovery information structure |
| `DiscoveredResource` | Type | Fully extracted resource with metadata |
| `ValidationResult` | Type | Result of extension validation |
| `DiscoveryResourcesResponse` | Type | Response from discovery query |
| `DiscoveryResource` | Type | Single discovered resource entry |
| `ListDiscoveryResourcesParams` | Type | Query parameters for listing resources |
| `BazaarClientExtension` | Type | Extension methods added by withBazaar |

---

## declareDiscoveryExtension

Creates discovery metadata to include in the `PaymentRequired` response.

```typescript
function declareDiscoveryExtension(config: {
  /** Example input values (query params or body) */
  input?: Record<string, any>;
  /** JSON Schema for validating input */
  inputSchema?: object;
  /** Body type for POST endpoints */
  bodyType?: "json" | "form-data";
  /** Output specification */
  output?: {
    /** Example response */
    example?: any;
    /** JSON Schema for output */
    schema?: object;
  };
}): { bazaar: { info: DiscoveryInfo; schema: object } };
```

### Discovery Info Structure

V2 format includes:
- `info`: Contains the actual discovery data (method, params, output examples)
- `schema`: JSON Schema that validates the structure of `info`

V1 compatibility: V1 data stored in `PaymentRequirements.outputSchema` is automatically transformed to V2 `DiscoveryInfo` format.

---

## extractDiscoveryInfo

Extracts discovery information from a payment flow. Handles both V2 and V1 formats automatically.

```typescript
function extractDiscoveryInfo(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  validate?: boolean,  // default: true
): DiscoveredResource | null;
```

### DiscoveredResource

```typescript
interface DiscoveredResource {
  /** URL of the discovered resource */
  resourceUrl: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** x402 protocol version (1 or 2) */
  x402Version: number;
  /** Human-readable description */
  description: string;
  /** Response MIME type */
  mimeType: string;
  /** Full discovery information */
  discoveryInfo: DiscoveryInfo;
}
```

---

## bazaarResourceServerExtension

A resource server extension that enriches discovery declarations at request time by narrowing the HTTP method to the actual method used.

```typescript
// Register on resource server
httpServer.resourceServer.registerExtension(bazaarResourceServerExtension);
```

When the resource server builds a `PaymentRequired` response, this extension's `enrichDeclaration` hook automatically sets the method field based on the incoming HTTP request method.

---

## withBazaar

Extends an `HTTPFacilitatorClient` with Bazaar discovery query capabilities.

```typescript
function withBazaar<T extends HTTPFacilitatorClient>(
  client: T,
): T & { extensions: { discovery: BazaarClientExtension } };
```

### BazaarClientExtension

```typescript
interface BazaarClientExtension {
  listResources(params?: ListDiscoveryResourcesParams): Promise<DiscoveryResourcesResponse>;
}
```

### ListDiscoveryResourcesParams

```typescript
interface ListDiscoveryResourcesParams {
  /** Filter by resource type (e.g., "http") */
  type?: string;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}
```

### DiscoveryResourcesResponse

```typescript
interface DiscoveryResourcesResponse {
  items: DiscoveryResource[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}
```

---

## WithExtensions Type Utility

Properly merges extension types when chaining multiple extensions on a client.

```typescript
type WithExtensions<T, E> = T extends { extensions: infer Existing }
  ? Omit<T, "extensions"> & { extensions: Existing & E }
  : T & { extensions: E };
```

When `T` has no existing extensions, the result is `T & { extensions: E }`. When `T` already has extensions (from chaining), the new extension type is merged with existing ones.

---

## Lifecycle Hooks

### Facilitator Hooks

```typescript
facilitator.onBeforeVerify(async (context) => {
  // context.paymentPayload, context.requirements
});

facilitator.onAfterVerify(async (context) => {
  // context.result - verification result
});

facilitator.onBeforeSettle(async (context) => {
  // context.paymentPayload, context.requirements
});

facilitator.onAfterSettle(async (context) => {
  // context.result - settlement result
  // context.paymentPayload, context.requirements
  // Good place to extract discovery info for Bazaar cataloging
});
```

---

## Environment Variables

| Variable | Description | Format |
|----------|-------------|--------|
| `AVM_PRIVATE_KEY` | Facilitator's Algorand private key | Base64-encoded 64-byte key (32-byte seed + 32-byte pubkey) |
| `ALGOD_SERVER` | Algod server URL | URL string |
| `ALGOD_TOKEN` | Algod API token | String |
| `ALGOD_TESTNET_URL` | Custom testnet Algod URL | URL (default: `https://testnet-api.algonode.cloud`) |
| `ALGOD_MAINNET_URL` | Custom mainnet Algod URL | URL (default: `https://mainnet-api.algonode.cloud`) |
| `FACILITATOR_URL` | URL of the facilitator service | URL string |
| `FACILITATOR_API_KEY` | API key for authenticated facilitator access | String |

---

## Network Constants

| Constant | Value |
|----------|-------|
| `ALGORAND_TESTNET_CAIP2` | `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` |
| `ALGORAND_MAINNET_CAIP2` | `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` |
| `USDC_TESTNET_ASA_ID` | `"10458941"` |
| `USDC_MAINNET_ASA_ID` | `"31566704"` |

---

## Testing

### Testing a Facilitator Locally

```bash
# Start the facilitator
AVM_PRIVATE_KEY="your-base64-key" npx tsx facilitator.ts

# Check supported networks
curl http://localhost:4000/supported

# Verify a payment (requires valid payload)
curl -X POST http://localhost:4000/verify \
  -H "Content-Type: application/json" \
  -d '{"paymentPayload": {...}, "paymentRequirements": {...}}'

# Settle a payment
curl -X POST http://localhost:4000/settle \
  -H "Content-Type: application/json" \
  -d '{"paymentPayload": {...}, "paymentRequirements": {...}}'
```

### Testing Bazaar Discovery

```bash
# List all discovered resources
curl http://localhost:4000/discovery/resources

# Filter by type
curl "http://localhost:4000/discovery/resources?type=http"

# With pagination
curl "http://localhost:4000/discovery/resources?limit=10&offset=0"
```

---

## Important Notes

- The facilitator address must have ALGO to cover transaction fees. Each settlement requires a minimum of 0.001 ALGO for the fee-payer transaction.
- `simulateTransactions` must handle both signed and unsigned transaction bytes in the same group. The client signs their payment transaction; the facilitator's fee-payer transaction arrives unsigned.
- `sendTransactions` receives an array of individually signed transaction bytes. Concatenate them with `Buffer.concat()` before calling `sendRawTransaction`.
- The `.register()` function at `@x402/avm/exact/facilitator` is distinct from the client and server variants. Always import from the correct subpath.
- Bazaar discovery is purely additive. If no extensions are present in the payment payload, the facilitator operates normally without cataloging.
- The `withBazaar` function mutates the client in place and adds an `extensions.discovery` namespace. It is safe to chain with other extension wrappers.

---

## External Resources

- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402-avm Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [algosdk TypeScript Reference](https://algorand.github.io/js-algorand-sdk/)
- [Algorand Simulate API](https://developer.algorand.org/docs/rest-apis/algod/#post-v2transactionssimulate)
