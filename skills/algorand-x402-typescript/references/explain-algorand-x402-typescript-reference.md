# x402-avm TypeScript Reference

## Package Ecosystem

### @x402/core

The core package provides protocol-agnostic base classes and types.

**Key Exports:**

| Export | Path | Description |
|--------|------|-------------|
| `x402Client` | `@x402/core/client` | Base client that handles 402 responses and payment |
| `x402ResourceServer` | `@x402/core/server` | Transport-agnostic resource server |
| `x402HTTPResourceServer` | `@x402/core/server` | HTTP-aware resource server with route configuration |
| `HTTPFacilitatorClient` | `@x402/core/server` | HTTP client for communicating with a remote facilitator |
| `x402Facilitator` | `@x402/core/facilitator` | Base facilitator for verifying and settling payments |
| `PaymentRequirements` | `@x402/core/types` | Type: what payment a server accepts |
| `PaymentPayload` | `@x402/core/types` | Type: what the client sends in PAYMENT-SIGNATURE header |
| `PaymentRequired` | `@x402/core/types` | Type: 402 response body |
| `Network` | `@x402/core/types` | Type: CAIP-2 network identifier string |
| `PaymentPolicy` | `@x402/core/client` | Type: filter function for payment requirements |

### @x402/avm

The AVM mechanism package provides Algorand-specific signer interfaces, constants, utilities, and scheme registration.

**Signer Interfaces:**

| Interface | Description |
|-----------|-------------|
| `ClientAvmSigner` | Client-side signer with `address` and `signTransactions()` |
| `FacilitatorAvmSigner` | Facilitator signer with `getAddresses()`, `signTransaction()`, `getAlgodClient()`, `simulateTransactions()`, `sendTransactions()`, `waitForConfirmation()` |

**Registration Functions (from subpaths):**

| Function | Import Path | Arguments |
|----------|-------------|-----------|
| `.register()` | `@x402/avm/exact/client` | `(client, { signer, algodConfig?, networks?, policies? })` |
| `.register()` | `@x402/avm/exact/server` | `(server, { networks? }?)` |
| `.register()` | `@x402/avm/exact/facilitator` | `(facilitator, { signer, networks })` |

**Constants:**

| Constant | Value | Description |
|----------|-------|-------------|
| `ALGORAND_TESTNET_CAIP2` | `"algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` | Testnet CAIP-2 |
| `ALGORAND_MAINNET_CAIP2` | `"algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` | Mainnet CAIP-2 |
| `CAIP2_NETWORKS` | Array of both | All supported CAIP-2 networks |
| `ALGORAND_TESTNET_GENESIS_HASH` | `"SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="` | Testnet genesis hash |
| `ALGORAND_MAINNET_GENESIS_HASH` | `"wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="` | Mainnet genesis hash |
| `V1_ALGORAND_TESTNET` | `"algorand-testnet"` | V1 testnet identifier |
| `V1_ALGORAND_MAINNET` | `"algorand-mainnet"` | V1 mainnet identifier |
| `V1_TO_CAIP2` | `Record<string, string>` | V1 to CAIP-2 mapping |
| `CAIP2_TO_V1` | `Record<string, string>` | CAIP-2 to V1 mapping |
| `USDC_TESTNET_ASA_ID` | `"10458941"` | USDC ASA ID on testnet |
| `USDC_MAINNET_ASA_ID` | `"31566704"` | USDC ASA ID on mainnet |
| `USDC_DECIMALS` | `6` | USDC decimal places |
| `USDC_CONFIG` | `Record<network, config>` | USDC config per network |
| `DEFAULT_ALGOD_TESTNET` | Env or `"https://testnet-api.algonode.cloud"` | Testnet Algod URL |
| `DEFAULT_ALGOD_MAINNET` | Env or `"https://mainnet-api.algonode.cloud"` | Mainnet Algod URL |
| `MIN_TXN_FEE` | `1000` | Minimum transaction fee (microAlgos) |
| `MAX_ATOMIC_GROUP_SIZE` | `16` | Maximum group size |
| `MAX_REASONABLE_FEE` | `10_000_000` | Fee safety cap (microAlgos) |
| `ALGORAND_ADDRESS_LENGTH` | `58` | Address character length |
| `ALGORAND_ADDRESS_REGEX` | `/^[A-Z2-7]{58}$/` | Address format regex |

**Utility Functions:**

| Function | Signature | Description |
|----------|-----------|-------------|
| `isValidAlgorandAddress` | `(addr: string) => boolean` | Full address validation (format + checksum) |
| `convertToTokenAmount` | `(amount: string, decimals: number) => string` | Decimal to atomic units |
| `convertFromTokenAmount` | `(amount: string, decimals: number) => string` | Atomic units to decimal |
| `encodeTransaction` | `(bytes: Uint8Array) => string` | Uint8Array to base64 |
| `decodeTransaction` | `(b64: string) => Uint8Array` | Base64 to Uint8Array |
| `decodeSignedTransaction` | `(b64: string) => SignedTransaction` | Decode signed txn from base64 |
| `decodeUnsignedTransaction` | `(b64: string) => Transaction` | Decode unsigned txn from base64 |
| `getNetworkFromCaip2` | `(caip2: string) => "testnet" \| "mainnet" \| null` | Extract network type |
| `isAlgorandNetwork` | `(network: string) => boolean` | Check if Algorand network |
| `isTestnetNetwork` | `(network: string) => boolean` | Check if testnet |
| `v1ToCaip2` | `(v1: string) => string` | Convert V1 to CAIP-2 |
| `caip2ToV1` | `(caip2: string) => string` | Convert CAIP-2 to V1 |
| `createAlgodClient` | `(network, url?, token?) => Algodv2` | Create Algod client |
| `getSenderFromTransaction` | `(bytes, isSigned) => string` | Extract sender address |
| `getTransactionId` | `(bytes) => string` | Get transaction ID |
| `hasSignature` | `(bytes) => boolean` | Check if transaction is signed |
| `validateGroupId` | `(txnBytes[]) => boolean` | Validate consistent group ID |
| `assignGroupId` | `(txns[]) => Transaction[]` | Assign group ID to transactions |
| `isAvmSignerWallet` | `(wallet: unknown) => wallet is ClientAvmSigner` | Type guard for ClientAvmSigner |

### @x402/express

Express.js middleware for payment-gated routes.

| Export | Description |
|--------|-------------|
| `paymentMiddleware(routes, server, paywallConfig?, paywall?)` | Middleware with pre-configured x402ResourceServer |
| `paymentMiddlewareFromConfig(routes, facilitatorClient, schemes?, paywallConfig?, paywall?)` | Auto-creates server internally |
| `paymentMiddlewareFromHTTPServer(httpServer)` | Uses x402HTTPResourceServer with hooks |

### @x402/hono

Hono middleware for payment-gated routes. Same API as Express but returns Hono `MiddlewareHandler`.

| Export | Description |
|--------|-------------|
| `paymentMiddleware(routes, server, paywallConfig?, paywall?)` | Middleware with pre-configured x402ResourceServer |
| `paymentMiddlewareFromConfig(routes, facilitatorClient, schemes?, paywallConfig?, paywall?, syncOnStart?)` | Auto-creates server internally |
| `paymentMiddlewareFromHTTPServer(httpServer)` | Uses x402HTTPResourceServer with hooks |

### @x402/next

Next.js middleware for payment-gated routes.

### @x402/fetch

Fetch API wrapper that automatically handles 402 responses.

| Export | Description |
|--------|-------------|
| `wrapFetch(client)` | Returns a fetch-like function with 402 handling |

### @x402/axios

Axios interceptor that automatically handles 402 responses.

| Export | Description |
|--------|-------------|
| `wrapAxios(client)` | Returns an axios instance with 402 handling |

### @x402/paywall

Browser paywall UI component shown when a user visits a protected route in a browser.

### @x402/extensions

Protocol extensions (bazaar marketplace, custom schemes).

## ClientAvmSigner Interface (Detailed)

```typescript
interface ClientAvmSigner {
  /**
   * The 58-character Algorand address of the signer.
   * Used to identify which transactions belong to this signer.
   */
  address: string;

  /**
   * Sign one or more transactions from an atomic group.
   *
   * @param txns - Array of unsigned transactions as raw msgpack Uint8Array bytes.
   *               Each element is a complete unsigned transaction.
   * @param indexesToSign - Optional array of zero-based indexes indicating which
   *                        transactions this signer should sign. If not provided,
   *                        the signer should sign all transactions.
   * @returns Array of the same length as txns. Each element is either:
   *          - Uint8Array: the signed transaction bytes (for indexes that were signed)
   *          - null: for indexes that were not signed (e.g., fee payer txn)
   */
  signTransactions(
    txns: Uint8Array[],
    indexesToSign?: number[],
  ): Promise<(Uint8Array | null)[]>;
}
```

**Compatibility:** This interface matches `@txnlab/use-wallet`'s `signTransactions` function signature, allowing direct bridging from wallet to signer.

## FacilitatorAvmSigner Interface (Detailed)

```typescript
interface FacilitatorAvmSigner {
  /**
   * Get all Algorand addresses this facilitator manages.
   * These are the fee payer addresses used for fee abstraction.
   * Only transactions from these addresses will be signed by the facilitator.
   */
  getAddresses(): readonly string[];

  /**
   * Sign a single unsigned transaction.
   *
   * @param txn - Raw msgpack bytes of the unsigned transaction
   * @param senderAddress - The Algorand address of the transaction sender
   * @returns Raw msgpack bytes of the signed transaction
   */
  signTransaction(txn: Uint8Array, senderAddress: string): Promise<Uint8Array>;

  /**
   * Get an Algod client for the specified network.
   * Used for fetching transaction parameters and other on-chain queries.
   *
   * @param network - CAIP-2 network identifier
   * @returns algosdk.Algodv2 instance (typed as unknown to avoid algosdk dependency in types)
   */
  getAlgodClient(network: Network): unknown;

  /**
   * Simulate a transaction group before submission.
   * Must use allowEmptySignatures: true for unsigned fee payer transactions.
   *
   * @param txns - Array of transaction bytes (mix of signed and unsigned)
   * @param network - CAIP-2 network identifier
   * @returns Simulation result from the Algod API
   */
  simulateTransactions(txns: Uint8Array[], network: Network): Promise<unknown>;

  /**
   * Submit fully signed transactions to the Algorand network.
   * All transactions in the group must be signed at this point.
   *
   * @param signedTxns - Array of signed transaction bytes
   * @param network - CAIP-2 network identifier
   * @returns Transaction ID of the submitted group
   */
  sendTransactions(signedTxns: Uint8Array[], network: Network): Promise<string>;

  /**
   * Wait for a transaction to be confirmed on-chain.
   *
   * @param txId - Transaction ID to wait for
   * @param network - CAIP-2 network identifier
   * @param waitRounds - Number of rounds to wait (default: 4)
   * @returns Confirmation result
   */
  waitForConfirmation(
    txId: string,
    network: Network,
    waitRounds?: number,
  ): Promise<unknown>;
}
```

## Route Configuration Types

```typescript
// RoutesConfig: maps "METHOD /path" to RouteConfig
type RoutesConfig = Record<string, RouteConfig>;

interface RouteConfig {
  accepts: PaymentOption | PaymentOption[];
  resource?: string;
  description?: string;
  mimeType?: string;
  customPaywallHtml?: string;
  unpaidResponseBody?: (context: any) => { contentType: string; body: any };
  extensions?: Record<string, unknown>;
}

interface PaymentOption {
  scheme: string;          // "exact"
  payTo: string;           // Algorand address (58 chars)
  price: Price;            // "$0.01" or DynamicPrice function
  network: string;         // CAIP-2 identifier
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}
```

## Testing Notes

### Running a Local Stack

1. Start facilitator on port 4020 with `AVM_PRIVATE_KEY` env var
2. Start resource server on port 4021 with `FACILITATOR_URL=http://localhost:4020`
3. Run client with `AVM_PRIVATE_KEY` and `RESOURCE_SERVER_URL=http://localhost:4021`

### Using the Online Facilitator

Set `FACILITATOR_URL=https://facilitator.goplausible.xyz` in the resource server to avoid running a local facilitator.

### Algorand Testnet Resources

- Fund accounts: [Algorand Testnet Dispenser](https://bank.testnet.algorand.network/)
- Explorer: [Allo Explorer Testnet](https://testnet.explorer.perawallet.app/)
- Algod: `https://testnet-api.algonode.cloud`
- USDC ASA ID: `10458941`

## Design Considerations

### Why Signer Separation?

The SDK defines interfaces (`ClientAvmSigner`, `FacilitatorAvmSigner`) but never imports `algosdk`. This means:

- The SDK core has zero `algosdk` dependency
- Any wallet library can provide signers (Pera, Defly, Kibisis, etc.)
- Server-side code can use `algosdk` directly
- The `@txnlab/use-wallet` ecosystem works out of the box

### Why Raw Bytes?

The SDK passes `Uint8Array` between all methods. This:

- Matches `@txnlab/use-wallet`'s `signTransactions` signature
- Avoids double-encoding/decoding
- Keeps the protocol layer independent of `algosdk` types
- Base64 encoding only happens at the HTTP boundary (PAYMENT-SIGNATURE header)

### Why Unconditional Registration?

AVM scheme registration is never conditional on environment variables. This ensures:

- AVM is always available as a payment option
- No silent failures when env vars are missing
- Parity with EVM and SVM treatment

## External Resources

- [@x402/core on npm](https://www.npmjs.com/package/@x402/core)
- [@x402/avm on npm](https://www.npmjs.com/package/@x402/avm)
- [@x402/express on npm](https://www.npmjs.com/package/@x402/express)
- [@x402/hono on npm](https://www.npmjs.com/package/@x402/hono)
- [@x402/next on npm](https://www.npmjs.com/package/@x402/next)
- [@x402/fetch on npm](https://www.npmjs.com/package/@x402/fetch)
- [@x402/axios on npm](https://www.npmjs.com/package/@x402/axios)
- [@x402/paywall on npm](https://www.npmjs.com/package/@x402/paywall)
- [@x402/extensions on npm](https://www.npmjs.com/package/@x402/extensions)
- [GoPlausible x402-avm Examples](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [GoPlausible x402-avm Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
- [@txnlab/use-wallet](https://github.com/TxnLab/use-wallet)
- [algosdk TypeScript](https://github.com/algorand/js-algorand-sdk)
