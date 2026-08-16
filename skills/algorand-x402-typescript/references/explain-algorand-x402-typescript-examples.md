# x402-avm TypeScript Examples

## Network Identifiers

```typescript
import type { Network } from "@x402/core/types";
import {
  ALGORAND_TESTNET_CAIP2,
  ALGORAND_MAINNET_CAIP2,
  V1_ALGORAND_TESTNET,
  V1_ALGORAND_MAINNET,
  V1_TO_CAIP2,
  CAIP2_TO_V1,
} from "@x402/avm";

const testnet: Network = ALGORAND_TESTNET_CAIP2;
// => "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="

const mainnet: Network = ALGORAND_MAINNET_CAIP2;
// => "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="

const caip2 = V1_TO_CAIP2["algorand-testnet"];
const v1Name = CAIP2_TO_V1[ALGORAND_TESTNET_CAIP2];
```

## PaymentRequirements (V2)

```typescript
import type { PaymentRequirements } from "@x402/core/types";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

const requirements: PaymentRequirements = {
  scheme: "exact",
  network: ALGORAND_TESTNET_CAIP2,
  maxAmountRequired: "1000000",
  resource: "https://api.example.com/premium/data",
  description: "Access to premium API endpoint",
  mimeType: "application/json",
  payTo: "RECEIVER_ALGORAND_ADDRESS_58_CHARS_AAAAAAAAAAAAAAAAAAA",
  maxTimeoutSeconds: 60,
  asset: USDC_TESTNET_ASA_ID,
  outputSchema: undefined,
  extra: {
    name: "USDC",
    decimals: 6,
  },
};
```

## PaymentPayload

```typescript
import type { PaymentPayload } from "@x402/core/types";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const payload: PaymentPayload = {
  x402Version: 2,
  scheme: "exact",
  network: ALGORAND_TESTNET_CAIP2,
  payload: {
    paymentGroup: [
      "iaNhbXTOAAGGoKNm...",
      "iaNhbXTOAAGGoKNm...",
    ],
    paymentIndex: 0,
  },
};
```

## ClientAvmSigner Interface

```typescript
import type { ClientAvmSigner } from "@x402/avm";

interface ClientAvmSigner {
  address: string;
  signTransactions(
    txns: Uint8Array[],
    indexesToSign?: number[],
  ): Promise<(Uint8Array | null)[]>;
}
```

## ClientAvmSigner with @txnlab/use-wallet (Browser)

```typescript
import type { ClientAvmSigner } from "@x402/avm";
import { useWallet } from "@txnlab/use-wallet";

function PaymentComponent() {
  const { activeAccount, signTransactions } = useWallet();

  const signer: ClientAvmSigner | null = activeAccount
    ? {
        address: activeAccount.address,
        signTransactions: async (txns, indexesToSign) => {
          return signTransactions(txns, indexesToSign);
        },
      }
    : null;

  return signer ? <PaidContent signer={signer} /> : <ConnectWallet />;
}
```

## Full React Example with Wallet

```typescript
import React, { useCallback } from "react";
import { x402Client } from "@x402/core/client";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import type { ClientAvmSigner } from "@x402/avm";
import { WalletProvider, useWallet, WalletId } from "@txnlab/use-wallet-react";

const walletConfig = {
  wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.KIBISIS],
};

function PaidContent() {
  const { activeAccount, signTransactions } = useWallet();

  const fetchPaidResource = useCallback(async () => {
    if (!activeAccount) return;

    const signer: ClientAvmSigner = {
      address: activeAccount.address,
      signTransactions: async (txns, indexes) => signTransactions(txns, indexes),
    };

    const client = new x402Client({ schemes: [] });
    client.register("algorand:*", new ExactAvmScheme(signer));

    const response = await client.fetch("https://api.example.com/premium");
    if (response.ok) {
      const data = await response.json();
      console.log("Data:", data);
    }
  }, [activeAccount, signTransactions]);

  return (
    <button onClick={fetchPaidResource} disabled={!activeAccount}>
      Fetch Paid Resource
    </button>
  );
}

export default function App() {
  return (
    <WalletProvider value={walletConfig}>
      <PaidContent />
    </WalletProvider>
  );
}
```

## ClientAvmSigner with algosdk Private Key (Server-Side)

```typescript
import type { ClientAvmSigner } from "@x402/avm";
import algosdk from "algosdk";

function createPrivateKeySigner(privateKeyBase64: string): ClientAvmSigner {
  const secretKey = Buffer.from(privateKeyBase64, "base64");

  if (secretKey.length !== 64) {
    throw new Error(`Invalid key length: expected 64, got ${secretKey.length}`);
  }

  const address = algosdk.encodeAddress(secretKey.slice(32));

  return {
    address,
    signTransactions: async (
      txns: Uint8Array[],
      indexesToSign?: number[],
    ): Promise<(Uint8Array | null)[]> => {
      return txns.map((txnBytes, i) => {
        if (indexesToSign && !indexesToSign.includes(i)) {
          return null;
        }
        const decoded = algosdk.decodeUnsignedTransaction(txnBytes);
        const signed = algosdk.signTransaction(decoded, secretKey);
        return signed.blob;
      });
    },
  };
}

const signer = createPrivateKeySigner(process.env.AVM_PRIVATE_KEY!);
```

## FacilitatorAvmSigner Interface

```typescript
import type { FacilitatorAvmSigner } from "@x402/avm";
import type { Network } from "@x402/core/types";

interface FacilitatorAvmSigner {
  getAddresses(): readonly string[];
  signTransaction(txn: Uint8Array, senderAddress: string): Promise<Uint8Array>;
  getAlgodClient(network: Network): unknown;
  simulateTransactions(txns: Uint8Array[], network: Network): Promise<unknown>;
  sendTransactions(signedTxns: Uint8Array[], network: Network): Promise<string>;
  waitForConfirmation(txId: string, network: Network, waitRounds?: number): Promise<unknown>;
}
```

## FacilitatorAvmSigner Implementation

```typescript
import type { FacilitatorAvmSigner } from "@x402/avm";
import type { Network } from "@x402/core/types";
import {
  ALGORAND_TESTNET_CAIP2,
  ALGORAND_MAINNET_CAIP2,
  createAlgodClient,
  isTestnetNetwork,
} from "@x402/avm";
import algosdk from "algosdk";

function createFacilitatorSigner(privateKeyBase64: string): FacilitatorAvmSigner {
  const secretKey = Buffer.from(privateKeyBase64, "base64");
  const address = algosdk.encodeAddress(secretKey.slice(32));
  const clients: Record<string, algosdk.Algodv2> = {};

  function getClient(network: Network): algosdk.Algodv2 {
    if (!clients[network]) {
      clients[network] = createAlgodClient(network);
    }
    return clients[network];
  }

  return {
    getAddresses: () => [address],

    signTransaction: async (txn: Uint8Array, _senderAddress: string) => {
      const decoded = algosdk.decodeUnsignedTransaction(txn);
      return algosdk.signTransaction(decoded, secretKey).blob;
    },

    getAlgodClient: (network: Network) => getClient(network),

    simulateTransactions: async (txns: Uint8Array[], network: Network) => {
      const client = getClient(network);
      const signedTxns = txns.map((txnBytes) => {
        try {
          return algosdk.decodeSignedTransaction(txnBytes);
        } catch {
          const txn = algosdk.decodeUnsignedTransaction(txnBytes);
          return new algosdk.SignedTransaction({ txn });
        }
      });
      const request = new algosdk.modelsv2.SimulateRequest({
        txnGroups: [
          new algosdk.modelsv2.SimulateRequestTransactionGroup({ txns: signedTxns }),
        ],
        allowEmptySignatures: true,
      });
      return client.simulateTransactions(request).do();
    },

    sendTransactions: async (signedTxns: Uint8Array[], network: Network) => {
      const client = getClient(network);
      const combined = Buffer.concat(signedTxns.map((t) => Buffer.from(t)));
      const { txId } = await client.sendRawTransaction(combined).do();
      return txId;
    },

    waitForConfirmation: async (txId: string, network: Network, waitRounds = 4) => {
      const client = getClient(network);
      return algosdk.waitForConfirmation(client, txId, waitRounds);
    },
  };
}

const facilitatorSigner = createFacilitatorSigner(process.env.AVM_PRIVATE_KEY!);
```

## Client Registration

```typescript
import { x402Client } from "@x402/core/client";
import { ExactAvmScheme } from "@x402/avm/exact/client";

const client = new x402Client({ schemes: [] });

client.register(["algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="], new ExactAvmScheme(myClientSigner));
```

## Server Registration

```typescript
import { x402ResourceServer } from "@x402/core/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";

const server = new x402ResourceServer(facilitatorClient);

// Wildcard (default -- all Algorand networks)
server.register("algorand:*", new ExactAvmScheme());

// Or specific networks
server.register(["algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="], new ExactAvmScheme());
```

## Facilitator Registration

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2 } from "@x402/avm";

const facilitator = new x402Facilitator();

// Single network
facilitator.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(myFacilitatorSigner));

// Multiple networks
facilitator.register([ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(myFacilitatorSigner));
```

## Payment Policies

```typescript
import { x402Client, PaymentPolicy } from "@x402/core/client";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const preferTestnet: PaymentPolicy = (version, requirements) => {
  return requirements.filter(r => r.network === ALGORAND_TESTNET_CAIP2);
};

const maxAmount: PaymentPolicy = (version, requirements) => {
  const MAX_USDC = 5_000_000;
  return requirements.filter(r => parseInt(r.maxAmountRequired, 10) <= MAX_USDC);
};

const preferAlgorand: PaymentPolicy = (version, requirements) => {
  const algorandOptions = requirements.filter(r => r.network.startsWith("algorand:"));
  return algorandOptions.length > 0 ? algorandOptions : requirements;
};

const client = new x402Client({ schemes: [] });
client.register("algorand:*", new ExactAvmScheme(signer));

client.registerPolicy(preferAlgorand);
```

## Constants

```typescript
import {
  ALGORAND_MAINNET_CAIP2,
  ALGORAND_TESTNET_CAIP2,
  CAIP2_NETWORKS,
  ALGORAND_MAINNET_GENESIS_HASH,
  ALGORAND_TESTNET_GENESIS_HASH,
  USDC_MAINNET_ASA_ID,
  USDC_TESTNET_ASA_ID,
  USDC_DECIMALS,
  USDC_CONFIG,
  DEFAULT_ALGOD_MAINNET,
  DEFAULT_ALGOD_TESTNET,
  MAX_ATOMIC_GROUP_SIZE,
  MIN_TXN_FEE,
  MAX_REASONABLE_FEE,
  ALGORAND_ADDRESS_REGEX,
  ALGORAND_ADDRESS_LENGTH,
} from "@x402/avm";
```

## Utility Functions

```typescript
import {
  isValidAlgorandAddress,
  convertToTokenAmount,
  convertFromTokenAmount,
  encodeTransaction,
  decodeTransaction,
  decodeSignedTransaction,
  decodeUnsignedTransaction,
  getNetworkFromCaip2,
  isAlgorandNetwork,
  isTestnetNetwork,
  v1ToCaip2,
  caip2ToV1,
  createAlgodClient,
  getSenderFromTransaction,
  getTransactionId,
  hasSignature,
  validateGroupId,
  assignGroupId,
} from "@x402/avm";

// Address validation
isValidAlgorandAddress("AAAA...AAAA"); // => true/false

// Amount conversion
convertToTokenAmount("1.50", 6);     // => "1500000"
convertFromTokenAmount("1500000", 6); // => "1.5"

// Network checks
isAlgorandNetwork("algorand:SGO1..."); // => true
isTestnetNetwork("algorand:SGO1...");  // => true
getNetworkFromCaip2("algorand:SGO1..."); // => "testnet"

// Algod client
const algod = createAlgodClient("algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=");
```

## HTTPFacilitatorClient

```typescript
import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.goplausible.xyz",
});

const authenticatedClient = new HTTPFacilitatorClient({
  url: "https://facilitator.example.com",
  headers: {
    Authorization: `Bearer ${process.env.FACILITATOR_API_KEY}`,
  },
});

const supported = await facilitatorClient.supported();
const verifyResult = await facilitatorClient.verify({ paymentPayload, paymentRequirements });
const settleResult = await facilitatorClient.settle({ paymentPayload, paymentRequirements });
```

## Type Guard

```typescript
import { isAvmSignerWallet } from "@x402/avm";

function checkWallet(wallet: unknown) {
  if (isAvmSignerWallet(wallet)) {
    console.log("Address:", wallet.address);
  }
}
```

## Transaction Group Creation (Simple Payment)

```typescript
import algosdk from "algosdk";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID, createAlgodClient } from "@x402/avm";

async function createSimplePayment(senderAddress: string, receiverAddress: string, amount: number) {
  const algod = createAlgodClient(ALGORAND_TESTNET_CAIP2);
  const params = await algod.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: senderAddress,
    to: receiverAddress,
    amount,
    assetIndex: parseInt(USDC_TESTNET_ASA_ID, 10),
    suggestedParams: params,
  });

  return [txn.toByte()];
}
```

## Fee-Abstracted Payment Group

```typescript
import algosdk from "algosdk";
import {
  ALGORAND_TESTNET_CAIP2,
  USDC_TESTNET_ASA_ID,
  MIN_TXN_FEE,
  createAlgodClient,
  encodeTransaction,
} from "@x402/avm";

async function createFeeAbstractedPayment(
  senderAddress: string,
  receiverAddress: string,
  feePayerAddress: string,
  amount: number,
) {
  const algod = createAlgodClient(ALGORAND_TESTNET_CAIP2);
  const params = await algod.getTransactionParams().do();

  const paymentTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: senderAddress,
    to: receiverAddress,
    amount,
    assetIndex: parseInt(USDC_TESTNET_ASA_ID, 10),
    suggestedParams: { ...params, fee: 0, flatFee: true },
  });

  const feePayerTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: feePayerAddress,
    to: feePayerAddress,
    amount: 0,
    suggestedParams: { ...params, fee: MIN_TXN_FEE * 2, flatFee: true },
  });

  const grouped = algosdk.assignGroupID([paymentTxn, feePayerTxn]);

  return {
    paymentGroup: [
      encodeTransaction(grouped[0].toByte()),
      encodeTransaction(grouped[1].toByte()),
    ],
    paymentIndex: 0,
  };
}
```

## Complete End-to-End (Client + Server + Facilitator)

```typescript
// ---- shared/config.ts ----
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

export const NETWORK = ALGORAND_TESTNET_CAIP2;
export const USDC_ASA = USDC_TESTNET_ASA_ID;
export const RESOURCE_WALLET = "RECEIVER_ALGORAND_ADDRESS_58_CHARS";
export const FACILITATOR_URL = "http://localhost:4020";
export const RESOURCE_SERVER_URL = "http://localhost:4021";

// ---- server/index.ts ----
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { NETWORK, USDC_ASA, RESOURCE_WALLET, FACILITATOR_URL } from "../shared/config";

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const server = new x402ResourceServer(facilitatorClient);
server.register("algorand:*", new ExactAvmScheme());

const routes = {
  "GET /api/weather": {
    accepts: {
      scheme: "exact",
      network: NETWORK,
      payTo: RESOURCE_WALLET,
      price: "$0.01",
    },
    description: "Weather data",
  },
};

const app = express();
app.use(paymentMiddleware(routes, server));
app.get("/api/weather", (req, res) => res.json({ temperature: 72, condition: "Sunny" }));
app.listen(4021);

// ---- client/index.ts ----
import { x402Client } from "@x402/core/client";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import type { ClientAvmSigner } from "@x402/avm";
import algosdk from "algosdk";
import { RESOURCE_SERVER_URL } from "../shared/config";

const secretKey = Buffer.from(process.env.AVM_PRIVATE_KEY!, "base64");
const clientSigner: ClientAvmSigner = {
  address: algosdk.encodeAddress(secretKey.slice(32)),
  signTransactions: async (txns, indexesToSign) => {
    return txns.map((txn, i) => {
      if (indexesToSign && !indexesToSign.includes(i)) return null;
      return algosdk.signTransaction(algosdk.decodeUnsignedTransaction(txn), secretKey).blob;
    });
  },
};

const client = new x402Client({ schemes: [] });
client.register("algorand:*", new ExactAvmScheme(clientSigner));

const response = await client.fetch(`${RESOURCE_SERVER_URL}/api/weather`);
if (response.ok) {
  console.log("Weather:", await response.json());
}
```

## Component Import Summary

```typescript
// Core
import { x402Client } from "@x402/core/client";
import { x402ResourceServer, x402HTTPResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { x402Facilitator } from "@x402/core/facilitator";
import type { PaymentRequirements, PaymentPayload, PaymentRequired, Network } from "@x402/core/types";

// AVM Registration (different subpath per role)
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";

// AVM Types and Constants
import type { ClientAvmSigner, FacilitatorAvmSigner } from "@x402/avm";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";
```
