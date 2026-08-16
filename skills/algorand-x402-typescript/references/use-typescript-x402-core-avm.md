# Using @x402/core and @x402/avm Packages

Build custom x402 payment integrations on Algorand using the core TypeScript SDK packages directly. These packages provide the client, resource server, and facilitator primitives for the HTTP 402 payment protocol.

## Prerequisites

Before using this skill, ensure:

1. **Node.js 18+** is installed
2. **TypeScript project** is set up
3. **Algorand account** is available (for signing transactions)
4. **algosdk** is installed as a peer dependency

## Core Workflow: The x402 Payment Flow

The x402 protocol follows a standard HTTP 402 flow across three participants:

```
Client                    Resource Server              Facilitator
  |                             |                           |
  |-- GET /resource ----------->|                           |
  |<-- 402 PaymentRequired -----|                           |
  |                             |                           |
  |  (sign payment txns)        |                           |
  |                             |                           |
  |-- GET /resource ----------->|                           |
  |   PAYMENT-SIGNATURE: <pay>   |-- verify(payload) ------->|
  |                             |<-- { isValid: true } -----|
  |<-- 200 OK + content --------|                           |
  |                             |-- settle(payload) ------->|
  |                             |<-- { txId: "..." } -------|
```

## How to Proceed

### Step 1: Install Dependencies

```bash
npm install @x402/core @x402/avm algosdk
```

### Step 2: Create a Client

The `x402Client` automatically handles 402 responses by creating and signing payments, then retrying the request with the `PAYMENT-SIGNATURE` header.

```typescript
import { x402Client } from "@x402/core/client";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import type { ClientAvmSigner } from "@x402/avm";
import algosdk from "algosdk";

const secretKey = Buffer.from(process.env.AVM_PRIVATE_KEY!, "base64");
const address = algosdk.encodeAddress(secretKey.slice(32));

const signer: ClientAvmSigner = {
  address,
  signTransactions: async (txns, indexesToSign) => {
    return txns.map((txn, i) => {
      if (indexesToSign && !indexesToSign.includes(i)) return null;
      const decoded = algosdk.decodeUnsignedTransaction(txn);
      return algosdk.signTransaction(decoded, secretKey).blob;
    });
  },
};

const client = new x402Client({ schemes: [] });
client.register("algorand:*", new ExactAvmScheme(signer));

const response = await client.fetch("https://api.example.com/premium/data");
```

### Step 3: Create a Resource Server

The `x402ResourceServer` is transport-agnostic. Use it with Express, Fastify, Hono, or any framework.

```typescript
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.example.com",
});

const server = new x402ResourceServer(facilitatorClient);
server.register("algorand:*", new ExactAvmScheme());
```

### Step 4: Create a Facilitator

The `x402Facilitator` verifies payment signatures and settles transactions on-chain.

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import type { FacilitatorAvmSigner } from "@x402/avm";

const facilitator = new x402Facilitator();
facilitator.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(myFacilitatorSigner));
```

### Step 5: Implement AVM Signers

Two signer interfaces exist:

- **ClientAvmSigner**: For clients paying for resources. Compatible with `@txnlab/use-wallet`.
- **FacilitatorAvmSigner**: For facilitators verifying and settling payments. Manages Algod clients, simulation, and submission.

### Step 6: Apply Payment Policies (Optional)

Policies filter payment requirements before the client selects one.

```typescript
import { PaymentPolicy } from "@x402/core/client";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const preferTestnet: PaymentPolicy = (version, requirements) => {
  return requirements.filter(r => r.network === ALGORAND_TESTNET_CAIP2);
};

client.register("algorand:*", new ExactAvmScheme(signer));
```

## Important Rules / Guidelines

1. **Always register the AVM scheme** before using client, server, or facilitator -- call `.register()` after construction
2. **Use CAIP-2 network identifiers** in SDK code -- import `ALGORAND_TESTNET_CAIP2` / `ALGORAND_MAINNET_CAIP2` from `@x402/avm`
3. **Signer separation** -- Protocol interfaces live in the SDK (`@x402/avm`), implementations using `algosdk` live in your application code
4. **TypeScript algosdk uses raw Uint8Array** -- No base64 conversion needed (unlike the Python SDK)
5. **Fee abstraction is automatic** -- When `PaymentRequirements` include a `feePayer`, the scheme creates a 2-transaction atomic group automatically
6. **Private key format** -- `AVM_PRIVATE_KEY` is Base64-encoded 64-byte key (32-byte seed + 32-byte pubkey), address derived from `secretKey.slice(32)`
7. **Transaction groups** -- All x402-avm payments use Algorand atomic transaction groups; the `paymentGroup` array in the payload contains base64-encoded msgpack transaction bytes

## Common Errors / Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `No scheme registered for network` | AVM scheme not registered | Call `.register()` on the client/server/facilitator |
| `Invalid key length: expected 64` | Wrong private key format | Ensure `AVM_PRIVATE_KEY` is Base64 of 64-byte key |
| `Simulation failed` | Transaction would fail on-chain | Check sender balance, USDC opt-in, correct receiver |
| `signer not found for address` | Address mismatch | Verify signer address matches the account paying |
| `Group ID mismatch` | Inconsistent atomic group | Use `algosdk.assignGroupID()` before encoding |
| `Fee too high` | Fee exceeds MAX_REASONABLE_FEE | Check fee calculation; max is 10 ALGO |
| `No payment requirements matched` | Policies filtered all options | Review policy logic; ensure at least one requirement passes |
| `Transaction rejected` | User cancelled in wallet | Handle rejection gracefully in UI |

## References / Further Reading

- [use-typescript-x402-core-avm-reference.md](./use-typescript-x402-core-avm-reference.md) - Full API reference for @x402/core and @x402/avm
- [use-typescript-x402-core-avm-examples.md](./use-typescript-x402-core-avm-examples.md) - Complete code examples
- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402-avm Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
