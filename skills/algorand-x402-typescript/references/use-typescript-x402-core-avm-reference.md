# @x402/core and @x402/avm Reference

Detailed API reference for the x402-avm TypeScript SDK packages.

## Dependencies

```json
{
  "dependencies": {
    "@x402/core": "latest",
    "@x402/avm": "latest",
    "algosdk": "^3.0.0"
  }
}
```

For browser wallet integration:

```json
{
  "dependencies": {
    "@txnlab/use-wallet": "^4.0.0",
    "@txnlab/use-wallet-react": "^4.0.0"
  }
}
```

## Package Exports: @x402/core

| Import Path | Exports |
|-------------|---------|
| `@x402/core/client` | `x402Client`, `PaymentPolicy` |
| `@x402/core/server` | `x402ResourceServer`, `x402HTTPResourceServer`, `HTTPFacilitatorClient`, `ResourceConfig`, `RouteConfig` |
| `@x402/core/facilitator` | `x402Facilitator` |
| `@x402/core/http` | HTTP utilities and header parsing |
| `@x402/core/types` | `PaymentRequirements`, `PaymentRequirementsV1`, `PaymentPayload`, `PaymentRequired`, `Network` |

## Package Exports: @x402/avm

| Import Path | Exports |
|-------------|---------|
| `@x402/avm` | All constants, types, and utilities |
| `@x402/avm/exact/client` | `.register()` (client variant) |
| `@x402/avm/exact/server` | `.register()` (server variant) |
| `@x402/avm/exact/facilitator` | `.register()` (facilitator variant) |

## x402Client

The client automatically handles HTTP 402 responses by creating payment payloads and retrying.

```typescript
import { x402Client } from "@x402/core/client";

const client = new x402Client({
  schemes: [],  // Populated via client.register(network, new ExactAvmScheme(signer))
});
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `fetch` | `(url: string, init?: RequestInit) => Promise<Response>` | Fetch with automatic 402 handling |
| `registerPolicy` | `(policy: PaymentPolicy) => void` | Add a payment filtering policy |

### Lifecycle

1. Client sends request to resource URL
2. Server responds with `402 Payment Required` + `PaymentRequired` body
3. Client selects a matching `PaymentRequirements` (filtered by policies)
4. Registered scheme creates and signs payment
5. Client retries with `PAYMENT-SIGNATURE` header containing signed payload

## PaymentPolicy

```typescript
type PaymentPolicy = (
  version: number,
  requirements: PaymentRequirements[],
) => PaymentRequirements[];
```

Policies receive the full list of `PaymentRequirements` from the 402 response and return a filtered subset. If the filtered list is empty, the client cannot pay.

## x402ResourceServer

Transport-agnostic server that creates 402 responses and processes payments.

```typescript
import { x402ResourceServer } from "@x402/core/server";

const server = new x402ResourceServer(facilitatorClient);
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `createPaymentRequired` | `(resource, configs[]) => PaymentRequired` | Create a 402 response body |
| `processPayment` | `(xPaymentHeader, config) => Promise<ProcessResult>` | Verify and settle a payment |

## x402HTTPResourceServer

Adds HTTP route matching on top of `x402ResourceServer`.

```typescript
import { x402HTTPResourceServer } from "@x402/core/server";

const httpServer = new x402HTTPResourceServer(facilitatorClient, { routes });
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `processRequest` | `(context) => Promise<{ status, body }>` | Process an HTTP request with route matching |
| `onProtectedRequest` | `(callback) => void` | Register a hook for protected requests |
| `resourceServer` | Property | Access the underlying `x402ResourceServer` |

### Route Configuration

```typescript
interface RouteConfig {
  path: string;          // Route pattern (supports * wildcard)
  config: ResourceConfig;
  description?: string;
  mimeType?: string;
}

interface ResourceConfig {
  scheme: "exact";
  payTo: string;
  price: {
    asset: string;
    amount: string;
    extra?: { name: string; decimals: number };
  };
  network: string;
  maxTimeoutSeconds: number;
}
```

## HTTPFacilitatorClient

Communicates with a remote facilitator service over HTTP.

```typescript
import { HTTPFacilitatorClient } from "@x402/core/server";

const client = new HTTPFacilitatorClient({
  url: string;
  headers?: Record<string, string>;
});
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `supported` | `() => Promise<{ networks }>` | Get supported networks |
| `verify` | `(payload) => Promise<VerifyResult>` | Verify a payment |
| `settle` | `(payload) => Promise<SettleResult>` | Settle a payment on-chain |

## x402Facilitator

Local facilitator that verifies and settles payments directly.

```typescript
import { x402Facilitator } from "@x402/core/facilitator";

const facilitator = new x402Facilitator();
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `verify` | `(payload, requirements) => Promise<VerifyResult>` | Verify payment signature and amounts |
| `settle` | `(payload, requirements) => Promise<SettleResult>` | Sign fee payer txn and submit group |
| `getSupportedNetworks` | `() => SupportedNetworks` | Get registered networks |

## ExactAvmScheme

A single class exported from three subpaths — one per role. Register on a client/server/facilitator via the builder `.register(networkPattern, schemeInstance)` method.

### Client Registration

```typescript
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

// Constructor: new ExactAvmScheme(signer: ClientAvmSigner, config?: ClientAvmConfig)
client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer));
// Or for all Algorand networks:
client.register("algorand:*", new ExactAvmScheme(signer));
```

### Server Registration

```typescript
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

// Constructor: new ExactAvmScheme()  -- no signer needed server-side
server.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme());
// Or for all Algorand networks:
server.register("algorand:*", new ExactAvmScheme());
```

### Facilitator Registration

```typescript
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

// Constructor: new ExactAvmScheme(signer: FacilitatorAvmSigner)
facilitator.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer));
// Or for all Algorand networks:
facilitator.register("algorand:*", new ExactAvmScheme(signer));
```

When importing from multiple subpaths in the same file, alias each `ExactAvmScheme` (e.g., `import { ExactAvmScheme as ServerExactAvmScheme } from "@x402/avm/exact/server"`).

## ClientAvmSigner Interface

```typescript
interface ClientAvmSigner {
  address: string;
  signTransactions(
    txns: Uint8Array[],
    indexesToSign?: number[],
  ): Promise<(Uint8Array | null)[]>;
}
```

Compatible with `@txnlab/use-wallet`'s `signTransactions` function. The `indexesToSign` parameter allows selective signing in atomic groups (e.g., sign only the payment transaction, leave the fee payer unsigned for the facilitator).

## FacilitatorAvmSigner Interface

```typescript
interface FacilitatorAvmSigner {
  getAddresses(): readonly string[];
  signTransaction(txn: Uint8Array, senderAddress: string): Promise<Uint8Array>;
  getAlgodClient(network: Network): unknown;
  simulateTransactions(txns: Uint8Array[], network: Network): Promise<unknown>;
  sendTransactions(signedTxns: Uint8Array[], network: Network): Promise<string>;
  waitForConfirmation(txId: string, network: Network, waitRounds?: number): Promise<unknown>;
}
```

### Method Details

| Method | Purpose |
|--------|---------|
| `getAddresses` | Returns fee payer addresses managed by this facilitator |
| `signTransaction` | Signs a single unsigned transaction (fee payer txn) |
| `getAlgodClient` | Returns an Algod client for the given network |
| `simulateTransactions` | Simulates an atomic group to validate before submission |
| `sendTransactions` | Submits signed transaction group to the network |
| `waitForConfirmation` | Waits for on-chain confirmation of a transaction |

## Type Guard

```typescript
import { isAvmSignerWallet } from "@x402/avm";

// Returns true if the object has { address: string, signTransactions: Function }
isAvmSignerWallet(wallet): wallet is ClientAvmSigner;
```

## Constants

### Network Identifiers

| Constant | Value |
|----------|-------|
| `ALGORAND_MAINNET_CAIP2` | `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` |
| `ALGORAND_TESTNET_CAIP2` | `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` |
| `CAIP2_NETWORKS` | `[ALGORAND_MAINNET_CAIP2, ALGORAND_TESTNET_CAIP2]` |
| `ALGORAND_MAINNET_GENESIS_HASH` | `"wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` |
| `ALGORAND_TESTNET_GENESIS_HASH` | `"SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` |
| `V1_ALGORAND_MAINNET` | `"algorand-mainnet"` |
| `V1_ALGORAND_TESTNET` | `"algorand-testnet"` |
| `V1_NETWORKS` | `["algorand-mainnet", "algorand-testnet"]` |

### V1/V2 Mapping

| Constant | Type | Description |
|----------|------|-------------|
| `V1_TO_CAIP2` | `Record<string, string>` | V1 name to CAIP-2 |
| `CAIP2_TO_V1` | `Record<string, string>` | CAIP-2 to V1 name |

### USDC Configuration

| Constant | Value |
|----------|-------|
| `USDC_MAINNET_ASA_ID` | `"31566704"` |
| `USDC_TESTNET_ASA_ID` | `"10458941"` |
| `USDC_DECIMALS` | `6` |
| `USDC_CONFIG` | `Record<network, { asaId, name, decimals }>` |

### Algod Endpoints

| Constant | Value |
|----------|-------|
| `DEFAULT_ALGOD_MAINNET` | env `ALGOD_MAINNET_URL` or `"https://mainnet-api.algonode.cloud"` |
| `DEFAULT_ALGOD_TESTNET` | env `ALGOD_TESTNET_URL` or `"https://testnet-api.algonode.cloud"` |
| `NETWORK_TO_ALGOD` | `Record<network, url>` |
| `FALLBACK_ALGOD_MAINNET` | `"https://mainnet-api.algonode.cloud"` |
| `FALLBACK_ALGOD_TESTNET` | `"https://testnet-api.algonode.cloud"` |

### Transaction Limits

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_ATOMIC_GROUP_SIZE` | `16` | Max transactions per atomic group |
| `MIN_TXN_FEE` | `1000` | Minimum transaction fee (microAlgos) |
| `MAX_REASONABLE_FEE` | `10_000_000` | 10 ALGO sanity check |

### Address Validation

| Constant | Value |
|----------|-------|
| `ALGORAND_ADDRESS_REGEX` | `/^[A-Z2-7]{58}$/` |
| `ALGORAND_ADDRESS_LENGTH` | `58` |

## Utility Functions

### Address Validation

```typescript
isValidAlgorandAddress(address: string): boolean
```

Full validation including format check and algosdk checksum verification.

### Amount Conversion

```typescript
convertToTokenAmount(amount: string, decimals: number): string
convertFromTokenAmount(amount: string, decimals: number): string
```

Convert between human-readable decimal amounts and atomic integer units.

### Transaction Encoding/Decoding

```typescript
encodeTransaction(txnBytes: Uint8Array): string          // Uint8Array -> base64
decodeTransaction(base64Str: string): Uint8Array          // base64 -> Uint8Array
decodeSignedTransaction(base64Str: string): SignedTransaction
decodeUnsignedTransaction(base64Str: string): Transaction
```

### Network Utilities

```typescript
getNetworkFromCaip2(caip2: string): "testnet" | "mainnet" | null
isAlgorandNetwork(network: string): boolean    // Recognizes both V1 and CAIP-2
isTestnetNetwork(network: string): boolean
v1ToCaip2(v1Name: string): string
caip2ToV1(caip2: string): string
createAlgodClient(network: string, url?: string, token?: string): Algodv2
```

### Transaction Inspection

```typescript
getSenderFromTransaction(txnBytes: Uint8Array, isSigned: boolean): string
getTransactionId(txnBytes: Uint8Array): string
hasSignature(txnBytes: Uint8Array): boolean
getGenesisHashFromTransaction(txnBytes: Uint8Array): string
validateGroupId(txnBytesArray: Uint8Array[]): boolean
assignGroupId(txns: Transaction[]): Transaction[]
```

## Type Definitions

### PaymentRequirements (V2)

```typescript
interface PaymentRequirements {
  scheme: "exact";
  network: string;            // CAIP-2 identifier
  maxAmountRequired: string;  // Atomic units as string
  resource: string;           // URL of the resource
  description: string;
  mimeType: string;
  payTo: string;              // Receiver address
  maxTimeoutSeconds: number;
  asset: string;              // ASA ID ("0" for native ALGO)
  outputSchema: unknown;
  extra?: {
    name: string;             // Token name (e.g., "USDC")
    decimals: number;         // Token decimals (e.g., 6)
  };
}
```

### PaymentPayload

```typescript
interface PaymentPayload {
  x402Version: 2;
  scheme: "exact";
  network: string;
  payload: {
    paymentGroup: string[];   // base64-encoded msgpack transaction bytes
    paymentIndex: number;     // Index of the payment transaction
  };
}
```

### PaymentRequired

```typescript
interface PaymentRequired {
  x402Version: 2;
  resource: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: PaymentRequirements[];
  error: string;
}
```

## Fee Abstraction Flow

Fee abstraction uses Algorand atomic transaction groups and pooled fees:

1. **Client** creates a 2-transaction atomic group:
   - Transaction 0: USDC/ALGO transfer from client to resource owner (fee = 0)
   - Transaction 1: Self-payment by fee payer address (fee covers both transactions)
2. **Client** signs only Transaction 0 (their payment)
3. **Client** sends both transactions in `paymentGroup` array
4. **Facilitator** validates the fee payer transaction:
   - Must be a self-payment (from == to)
   - Amount must be 0
   - No rekey, close-to, or other dangerous operations
   - Fee must be within `MAX_REASONABLE_FEE`
5. **Facilitator** signs Transaction 1 and submits the atomic group
6. **Atomic execution** ensures all-or-nothing on-chain

### Security Guarantees

- Fee payer transaction validated for safety (no value extraction)
- Atomic group ensures both transactions succeed or both fail
- Maximum fee cap prevents excessive fee draining
- Group ID consistency validated before submission

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AVM_PRIVATE_KEY` | Base64-encoded 64-byte key | Required for signing |
| `ALGOD_MAINNET_URL` | Custom mainnet Algod URL | `https://mainnet-api.algonode.cloud` |
| `ALGOD_TESTNET_URL` | Custom testnet Algod URL | `https://testnet-api.algonode.cloud` |
| `FACILITATOR_URL` | Facilitator service URL | Varies |
| `FACILITATOR_API_KEY` | Facilitator auth token | Optional |

## Private Key Format

The `AVM_PRIVATE_KEY` is a Base64-encoded 64-byte key:
- Bytes 0-31: Ed25519 seed (private key)
- Bytes 32-63: Ed25519 public key
- Address derivation: `algosdk.encodeAddress(secretKey.slice(32))`

## Testing

Use Algorand TestNet for development:

1. Get testnet ALGO from the [Algorand Dispenser](https://bank.testnet.algorand.network/)
2. Opt in to USDC TestNet ASA (ID: 10458941)
3. Get testnet USDC from [TestNet USDC Dispenser](https://asset-dispenser.testnet.algorand.network/)
4. Use `ALGORAND_TESTNET_CAIP2` as the network identifier

## Import Summary

| Component | TypeScript Import |
|-----------|-------------------|
| Client | `x402Client` from `@x402/core/client` |
| Resource Server | `x402ResourceServer` from `@x402/core/server` |
| HTTP Resource Server | `x402HTTPResourceServer` from `@x402/core/server` |
| Facilitator | `x402Facilitator` from `@x402/core/facilitator` |
| Facilitator Client | `HTTPFacilitatorClient` from `@x402/core/server` |
| AVM Registration (Client) | `.register()` from `@x402/avm/exact/client` |
| AVM Registration (Server) | `.register()` from `@x402/avm/exact/server` |
| AVM Registration (Facilitator) | `.register()` from `@x402/avm/exact/facilitator` |
| Types | `@x402/core/types` |
| Constants | `@x402/avm` |
| Signer Interfaces | `ClientAvmSigner`, `FacilitatorAvmSigner` from `@x402/avm` |
| Type Guard | `isAvmSignerWallet` from `@x402/avm` |

## External Links

- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402-avm Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [algosdk TypeScript Documentation](https://algorand.github.io/js-algorand-sdk/)
- [CAIP-2 Specification](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md)
- [Algorand Atomic Transfers](https://developer.algorand.org/docs/get-details/atomic_transfers/)
- [@txnlab/use-wallet Documentation](https://txnlab.gitbook.io/use-wallet)
