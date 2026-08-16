# Creating x402 Facilitator Services

Build facilitator services that verify payment transactions are valid, settle them on-chain, and optionally catalog discovered resources via the Bazaar extension.

## Prerequisites

Before using this skill, ensure:

1. **Node.js with TypeScript** support
2. **An Algorand account with ALGO** for covering transaction fees during settlement
3. **algosdk** installed for transaction signing, simulation, and submission

## Core Workflow: What a Facilitator Does

A facilitator is the trusted intermediary between a resource server and the blockchain. It performs two operations:

1. **Verify** -- Confirms that a payment transaction group is valid (correct amounts, recipients, signatures, timing) without submitting to the network
2. **Settle** -- Submits the verified transaction group to the Algorand network, co-signing the fee-payer transaction

```
Client                    Resource Server              Facilitator              Algorand
  |                            |                            |                      |
  |--- Request + Payment ----->|                            |                      |
  |                            |--- Verify(payload) ------->|                      |
  |                            |<-- { isValid: true } ------|                      |
  |                            |--- Settle(payload) ------->|                      |
  |                            |                            |--- Sign fee txn ---->|
  |                            |                            |--- Send group ------>|
  |                            |                            |<-- Confirmation -----|
  |                            |<-- { success, txId } ------|                      |
  |<--- 200 + Content ---------|                            |                      |
```

## How to Proceed

### Step 1: Install Dependencies

```bash
npm install @x402/core @x402/avm algosdk express
```

For Bazaar discovery extension:
```bash
npm install @x402/extensions
```

### Step 2: Implement the FacilitatorAvmSigner

The `FacilitatorAvmSigner` interface bridges the facilitator to the Algorand blockchain. It handles signing, simulation, submission, and confirmation:

```typescript
import algosdk from "algosdk";
import type { FacilitatorAvmSigner } from "@x402/avm";

const secretKey = Buffer.from(process.env.AVM_PRIVATE_KEY!, "base64");
const address = algosdk.encodeAddress(secretKey.slice(32));
const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");

const facilitatorSigner: FacilitatorAvmSigner = {
  getAddresses: () => [address],

  signTransaction: async (txn: Uint8Array, senderAddress: string) => {
    const decoded = algosdk.decodeUnsignedTransaction(txn);
    const signed = algosdk.signTransaction(decoded, secretKey);
    return signed.blob;
  },

  getAlgodClient: (network: string) => algodClient,

  simulateTransactions: async (txns: Uint8Array[], network: string) => {
    const stxns = txns.map((txnBytes) => {
      try {
        return algosdk.decodeSignedTransaction(txnBytes);
      } catch {
        const txn = algosdk.decodeUnsignedTransaction(txnBytes);
        return new algosdk.SignedTransaction({ txn });
      }
    });
    const request = new algosdk.modelsv2.SimulateRequest({
      txnGroups: [
        new algosdk.modelsv2.SimulateRequestTransactionGroup({ txns: stxns }),
      ],
      allowEmptySignatures: true,
    });
    return algodClient.simulateTransactions(request).do();
  },

  sendTransactions: async (signedTxns: Uint8Array[], network: string) => {
    const combined = Buffer.concat(signedTxns.map((t) => Buffer.from(t)));
    const { txId } = await algodClient.sendRawTransaction(combined).do();
    return txId;
  },

  waitForConfirmation: async (txId: string, network: string, waitRounds = 4) => {
    return algosdk.waitForConfirmation(algodClient, txId, waitRounds);
  },
};
```

### Step 3: Create and Register the Facilitator

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const facilitator = new x402Facilitator();

facilitator.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(facilitatorSigner));
```

### Step 4: Create the Express.js Server

```typescript
import express from "express";

const app = express();
app.use(express.json());

app.get("/supported", async (_req, res) => {
  const supported = facilitator.getSupportedNetworks();
  res.json(supported);
});

app.post("/verify", async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body;
  const result = await facilitator.verify(paymentPayload, paymentRequirements);
  res.json(result);
});

app.post("/settle", async (req, res) => {
  const { paymentPayload, paymentRequirements } = req.body;
  const result = await facilitator.settle(paymentPayload, paymentRequirements);
  res.json(result);
});

app.listen(4000, () => console.log("Facilitator running on :4000"));
```

### Step 5: Add Bazaar Discovery Extension (Optional)

The Bazaar extension enables automatic cataloging of x402-protected resources. When resource servers declare discovery metadata, the facilitator can index and serve a discovery API:

**On the resource server side -- declare discovery info:**

```typescript
import { declareDiscoveryExtension } from "@x402/extensions";

const weatherDiscovery = declareDiscoveryExtension({
  input: { city: "San Francisco", units: "metric" },
  inputSchema: {
    properties: {
      city: { type: "string" },
      units: { type: "string", enum: ["metric", "imperial"] },
    },
    required: ["city"],
  },
  output: {
    example: { temperature: 18.5, condition: "Partly Cloudy", humidity: 65 },
  },
});
```

**On the facilitator side -- extract and catalog:**

```typescript
import { extractDiscoveryInfo, type DiscoveredResource } from "@x402/extensions";

facilitator.onAfterSettle(async (context) => {
  if (context.result.success) {
    const discovered = extractDiscoveryInfo(
      context.paymentPayload,
      context.requirements,
    );

    if (discovered) {
      console.log("Cataloged:", discovered.resourceUrl, discovered.method);
      // Store in database for the discovery API
    }
  }
});
```

### Step 6: Add Lifecycle Hooks (Optional)

```typescript
facilitator.onBeforeVerify(async (context) => {
  console.log(`Verifying payment for ${context.requirements.resource}`);
});

facilitator.onAfterSettle(async (context) => {
  if (context.result.success) {
    console.log(`Settled: ${context.result.txId}`);
  }
});
```

## Important Rules / Guidelines

1. **Facilitator needs ALGO** -- The facilitator address must have ALGO to pay transaction fees during settlement
2. **Private key security** -- Store `AVM_PRIVATE_KEY` securely. The facilitator co-signs the fee-payer transaction in each group
3. **Simulation before settlement** -- The `simulateTransactions` method must wrap unsigned transactions with `new algosdk.SignedTransaction({ txn })` and use `allowEmptySignatures: true`
4. **sendTransactions expects signed bytes** -- Concatenate all signed transaction bytes with `Buffer.concat()` before calling `sendRawTransaction`
5. **Network registration** -- Use `ALGORAND_TESTNET_CAIP2` or `ALGORAND_MAINNET_CAIP2` constants, not string literals in SDK code
6. **Bazaar is optional** -- The Bazaar discovery extension adds cataloging capability but is not required for basic facilitator operation

## FacilitatorAvmSigner Interface

```typescript
interface FacilitatorAvmSigner {
  /** Returns the list of addresses this signer controls */
  getAddresses(): string[];

  /** Sign a single transaction for the given sender address */
  signTransaction(txn: Uint8Array, senderAddress: string): Promise<Uint8Array>;

  /** Get an Algodv2 client for the specified network */
  getAlgodClient(network: string): algosdk.Algodv2;

  /** Simulate a transaction group (for verification without submission) */
  simulateTransactions(txns: Uint8Array[], network: string): Promise<any>;

  /** Send signed transactions to the network */
  sendTransactions(signedTxns: Uint8Array[], network: string): Promise<string>;

  /** Wait for a transaction to be confirmed */
  waitForConfirmation(
    txId: string,
    network: string,
    waitRounds?: number,
  ): Promise<any>;
}
```

## Bazaar Discovery Architecture

```
Resource Server                        Facilitator                    Client
     |                                      |                           |
     |-- declareDiscoveryExtension() ------>|                           |
     |   (extensions in PaymentRequired)    |                           |
     |                                      |                           |
     |                  Client pays ------->|                           |
     |                                      |-- extractDiscoveryInfo()  |
     |                                      |   catalogs resource       |
     |                                      |                           |
     |                                      |<--- /discovery/resources -|
     |                                      |---> list of resources --->|
```

## Common Errors / Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `signer not found` | No AVM_PRIVATE_KEY or wrong format | Ensure Base64-encoded 64-byte key |
| Simulation fails | Mixed signed/unsigned transactions | Wrap unsigned with `new algosdk.SignedTransaction({ txn })` |
| `sendRawTransaction` fails | Transaction group not properly concatenated | Use `Buffer.concat(signedTxns.map(t => Buffer.from(t)))` |
| Settlement times out | Network congestion or low fee | Increase `waitRounds` parameter |
| `No scheme registered` | `.register()` not called | Register before handling requests |
| Discovery not extracted | Extensions not passed through payload | Ensure resource server includes extensions in PaymentRequired |

## References / Further Reading

- [create-typescript-x402-facilitator-reference.md](./create-typescript-x402-facilitator-reference.md) - Detailed API reference
- [create-typescript-x402-facilitator-examples.md](./create-typescript-x402-facilitator-examples.md) - Complete code examples
- [x402-avm Examples Repository](https://github.com/GoPlausible/x402-avm/tree/branch-v2-algorand-publish/examples/)
- [x402-avm Documentation](https://github.com/GoPlausible/.github/blob/main/profile/algorand-x402-documentation/)
