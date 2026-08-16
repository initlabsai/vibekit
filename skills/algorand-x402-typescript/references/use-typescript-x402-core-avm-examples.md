# @x402/core and @x402/avm Examples

## Installation

```bash
npm install @x402/core @x402/avm algosdk
```

For browser wallet integration:

```bash
npm install @x402/avm algosdk @txnlab/use-wallet
```

---

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

const testnetV1 = V1_ALGORAND_TESTNET;  // => "algorand-testnet"
const mainnetV1 = V1_ALGORAND_MAINNET;  // => "algorand-mainnet"

const caip2 = V1_TO_CAIP2["algorand-testnet"];
// => "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="

const v1Name = CAIP2_TO_V1[ALGORAND_TESTNET_CAIP2];
// => "algorand-testnet"
```

---

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

const algoRequirements: PaymentRequirements = {
  scheme: "exact",
  network: ALGORAND_TESTNET_CAIP2,
  maxAmountRequired: "1000000",
  resource: "https://api.example.com/premium/data",
  description: "Access to premium data",
  mimeType: "application/json",
  payTo: "RECEIVER_ALGORAND_ADDRESS_58_CHARS_AAAAAAAAAAAAAAAAAAA",
  maxTimeoutSeconds: 60,
  asset: "0",
  outputSchema: undefined,
  extra: {
    name: "ALGO",
    decimals: 6,
  },
};
```

---

## PaymentRequirements (V1 Legacy)

```typescript
import type { PaymentRequirementsV1 } from "@x402/core/types";

const requirementsV1: PaymentRequirementsV1 = {
  scheme: "exact",
  network: "algorand-testnet",
  maxAmountRequired: "1000000",
  resource: "https://api.example.com/premium/data",
  description: "Premium data access",
  payTo: "RECEIVER_ALGORAND_ADDRESS_58_CHARS_AAAAAAAAAAAAAAAAAAA",
  maxTimeoutSeconds: 60,
  asset: "10458941",
  outputSchema: null,
  extra: {
    name: "USDC",
    decimals: 6,
  },
};
```

---

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
      "iaNhbXTOAAGGoKNmZWXNA...",
      "iaNhbXTOAAGGoKNmZWXNA...",
    ],
    paymentIndex: 0,
  },
};
```

---

## PaymentRequired Response

```typescript
import type { PaymentRequired } from "@x402/core/types";

const paymentRequired: PaymentRequired = {
  x402Version: 2,
  resource: {
    url: "https://api.example.com/premium/data",
    description: "Premium data endpoint",
    mimeType: "application/json",
  },
  accepts: [
    {
      scheme: "exact",
      network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      maxAmountRequired: "1000000",
      resource: "https://api.example.com/premium/data",
      description: "Premium data endpoint",
      mimeType: "application/json",
      payTo: "RECEIVER_ALGORAND_ADDRESS_58_CHARS_AAAAAAAAAAAAAAAAAAA",
      maxTimeoutSeconds: 60,
      asset: "10458941",
      outputSchema: undefined,
      extra: { name: "USDC", decimals: 6 },
    },
  ],
  error: "Payment required to access this resource",
};
```

---

## Client with Private Key (Server-Side)

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
      const signed = algosdk.signTransaction(decoded, secretKey);
      return signed.blob;
    });
  },
};

const client = new x402Client({ schemes: [] });

client.register("algorand:*", new ExactAvmScheme(signer));

async function accessPaidResource() {
  const response = await client.fetch(
    "https://api.example.com/premium/data"
  );

  if (response.ok) {
    const data = await response.json();
    console.log("Received:", data);
  }
}
```

---

## Client with @txnlab/use-wallet (Browser)

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

---

## Full React Browser Client

```typescript
import React, { useState, useCallback } from "react";
import { x402Client } from "@x402/core/client";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import type { ClientAvmSigner } from "@x402/avm";
import {
  WalletProvider,
  useWallet,
  WalletId,
} from "@txnlab/use-wallet-react";

const walletProviders = {
  wallets: [WalletId.PERA, WalletId.DEFLY],
};

function PayForWeather() {
  const { activeAccount, signTransactions, connect, disconnect } = useWallet();
  const [weather, setWeather] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWeather = useCallback(async () => {
    if (!activeAccount) return;
    setLoading(true);

    try {
      const signer: ClientAvmSigner = {
        address: activeAccount.address,
        signTransactions: async (txns, indexes) =>
          signTransactions(txns, indexes),
      };

      const client = new x402Client({ schemes: [] });
      client.register("algorand:*", new ExactAvmScheme(signer));

      const response = await client.fetch(
        "https://api.example.com/weather"
      );

      if (response.ok) {
        const data = await response.json();
        setWeather(JSON.stringify(data, null, 2));
      } else {
        setWeather(`Error: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      setWeather(`Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [activeAccount, signTransactions]);

  return (
    <div>
      <h1>Weather API (Paid with USDC on Algorand)</h1>

      {!activeAccount ? (
        <button onClick={() => connect(WalletId.PERA)}>
          Connect Pera Wallet
        </button>
      ) : (
        <div>
          <p>Connected: {activeAccount.address.slice(0, 8)}...</p>
          <button onClick={fetchWeather} disabled={loading}>
            {loading ? "Paying..." : "Get Weather (0.10 USDC)"}
          </button>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      )}

      {weather && (
        <pre>{weather}</pre>
      )}
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider value={walletProviders}>
      <PayForWeather />
    </WalletProvider>
  );
}
```

---

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
  return requirements.filter(r => {
    const amount = parseInt(r.maxAmountRequired, 10);
    return amount <= MAX_USDC;
  });
};

const preferAlgorand: PaymentPolicy = (version, requirements) => {
  const algorandOptions = requirements.filter(r =>
    r.network.startsWith("algorand:")
  );
  return algorandOptions.length > 0 ? algorandOptions : requirements;
};

const client = new x402Client({ schemes: [] });
client.register("algorand:*", new ExactAvmScheme(signer));

client.registerPolicy(preferAlgorand);
```

---

## Resource Server (Transport-Agnostic)

```typescript
import { x402ResourceServer, ResourceConfig } from "@x402/core/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.example.com",
});

const server = new x402ResourceServer(facilitatorClient);
server.register("algorand:*", new ExactAvmScheme());

const resourceConfig: ResourceConfig = {
  scheme: "exact",
  payTo: "RECEIVER_ALGORAND_ADDRESS_58_CHARS_AAAAAAAAAAAAAAAAAAA",
  price: {
    asset: USDC_TESTNET_ASA_ID,
    amount: "100000",
    extra: { name: "USDC", decimals: 6 },
  },
  network: ALGORAND_TESTNET_CAIP2,
  maxTimeoutSeconds: 60,
};

async function handleRequest(url: string, xPaymentHeader?: string) {
  if (!xPaymentHeader) {
    const paymentRequired = server.createPaymentRequired(
      { url, description: "Premium API", mimeType: "application/json" },
      [resourceConfig]
    );
    return { status: 402, body: paymentRequired };
  }

  const result = await server.processPayment(xPaymentHeader, resourceConfig);
  if (result.verified) {
    return { status: 200, body: { data: "premium content" } };
  }
  return { status: 402, body: result.error };
}
```

---

## HTTP Resource Server with Routes

```typescript
import {
  x402HTTPResourceServer,
  HTTPFacilitatorClient,
  RouteConfig,
} from "@x402/core/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.example.com",
});

const routes: RouteConfig[] = [
  {
    path: "/api/premium/*",
    config: {
      scheme: "exact",
      payTo: "RECEIVER_ALGORAND_ADDRESS_58_CHARS_AAAAAAAAAAAAAAAAAAA",
      price: {
        asset: USDC_TESTNET_ASA_ID,
        amount: "100000",
        extra: { name: "USDC", decimals: 6 },
      },
      network: ALGORAND_TESTNET_CAIP2,
      maxTimeoutSeconds: 60,
    },
    description: "Premium API endpoints",
    mimeType: "application/json",
  },
  {
    path: "/api/expensive-analysis",
    config: {
      scheme: "exact",
      payTo: "RECEIVER_ALGORAND_ADDRESS_58_CHARS_AAAAAAAAAAAAAAAAAAA",
      price: {
        asset: USDC_TESTNET_ASA_ID,
        amount: "5000000",
        extra: { name: "USDC", decimals: 6 },
      },
      network: ALGORAND_TESTNET_CAIP2,
      maxTimeoutSeconds: 120,
    },
    description: "Expensive analysis endpoint",
    mimeType: "application/json",
  },
];

const httpServer = new x402HTTPResourceServer(facilitatorClient, { routes });
httpServer.resourceServer.register("algorand:*", new ExactAvmScheme());
```

---

## Facilitator

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import type { FacilitatorAvmSigner } from "@x402/avm";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";
import algosdk from "algosdk";

const secretKey = Buffer.from(process.env.AVM_PRIVATE_KEY!, "base64");
const address = algosdk.encodeAddress(secretKey.slice(32));
const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");

const facilitatorSigner: FacilitatorAvmSigner = {
  getAddresses: () => [address],
  signTransaction: async (txn, senderAddress) => {
    const decoded = algosdk.decodeUnsignedTransaction(txn);
    const signed = algosdk.signTransaction(decoded, secretKey);
    return signed.blob;
  },
  getAlgodClient: (network) => algodClient,
  simulateTransactions: async (txns, network) => {
    const stxns = txns.map((txnBytes) => {
      try {
        return algosdk.decodeSignedTransaction(txnBytes);
      } catch {
        const txn = algosdk.decodeUnsignedTransaction(txnBytes);
        return new algosdk.SignedTransaction({ txn });
      }
    });
    const request = new algosdk.modelsv2.SimulateRequest({
      txnGroups: [new algosdk.modelsv2.SimulateRequestTransactionGroup({ txns: stxns })],
      allowEmptySignatures: true,
    });
    return algodClient.simulateTransactions(request).do();
  },
  sendTransactions: async (signedTxns, network) => {
    const combined = Buffer.concat(signedTxns.map(t => Buffer.from(t)));
    const { txId } = await algodClient.sendRawTransaction(combined).do();
    return txId;
  },
  waitForConfirmation: async (txId, network, waitRounds = 4) => {
    return algosdk.waitForConfirmation(algodClient, txId, waitRounds);
  },
};

const facilitator = new x402Facilitator();

facilitator.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(facilitatorSigner));

async function handlePaymentVerification(paymentPayload: any, requirements: any) {
  const verifyResult = await facilitator.verify(paymentPayload, requirements);

  if (verifyResult.isValid) {
    const settleResult = await facilitator.settle(paymentPayload, requirements);
    return settleResult;
  }

  return { success: false, error: verifyResult.error };
}
```

---

## HTTPFacilitatorClient

```typescript
import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.example.com",
});

const authenticatedClient = new HTTPFacilitatorClient({
  url: "https://facilitator.example.com",
  headers: {
    Authorization: `Bearer ${process.env.FACILITATOR_API_KEY}`,
  },
});

const supported = await facilitatorClient.supported();
console.log("Supported networks:", supported.networks);

const verifyResult = await facilitatorClient.verify({
  paymentPayload,
  paymentRequirements,
});

const settleResult = await facilitatorClient.settle({
  paymentPayload,
  paymentRequirements,
});
```

---

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

import { isAvmSignerWallet } from "@x402/avm";

function checkWallet(wallet: unknown) {
  if (isAvmSignerWallet(wallet)) {
    console.log("Address:", wallet.address);
  }
}
```

---

## ClientAvmSigner from Private Key

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
console.log("Signer address:", signer.address);
```

---

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
  waitForConfirmation(
    txId: string,
    network: Network,
    waitRounds?: number,
  ): Promise<unknown>;
}
```

---

## Production FacilitatorAvmSigner

```typescript
import type { FacilitatorAvmSigner, FacilitatorAvmSignerConfig } from "@x402/avm";
import type { Network } from "@x402/core/types";
import {
  ALGORAND_TESTNET_CAIP2,
  ALGORAND_MAINNET_CAIP2,
  createAlgodClient,
  isAlgorandNetwork,
  isTestnetNetwork,
} from "@x402/avm";
import algosdk from "algosdk";

function createFacilitatorSigner(
  privateKeyBase64: string,
  config?: FacilitatorAvmSignerConfig,
): FacilitatorAvmSigner {
  const secretKey = Buffer.from(privateKeyBase64, "base64");
  const address = algosdk.encodeAddress(secretKey.slice(32));

  const clients: Record<string, algosdk.Algodv2> = {};

  function getClient(network: Network): algosdk.Algodv2 {
    if (!clients[network]) {
      clients[network] = createAlgodClient(
        network,
        isTestnetNetwork(network) ? config?.testnetUrl : config?.mainnetUrl,
        config?.algodToken,
      );
    }
    return clients[network];
  }

  return {
    getAddresses: () => [address],

    signTransaction: async (txn: Uint8Array, _senderAddress: string) => {
      const decoded = algosdk.decodeUnsignedTransaction(txn);
      const signed = algosdk.signTransaction(decoded, secretKey);
      return signed.blob;
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
          new algosdk.modelsv2.SimulateRequestTransactionGroup({
            txns: signedTxns,
          }),
        ],
        allowEmptySignatures: true,
      });

      const result = await client.simulateTransactions(request).do();

      for (const group of result.txnGroups || []) {
        if (group.failureMessage) {
          throw new Error(`Simulation failed: ${group.failureMessage}`);
        }
      }

      return result;
    },

    sendTransactions: async (signedTxns: Uint8Array[], network: Network) => {
      const client = getClient(network);
      const combined = Buffer.concat(signedTxns.map((t) => Buffer.from(t)));
      const { txId } = await client.sendRawTransaction(combined).do();
      return txId;
    },

    waitForConfirmation: async (
      txId: string,
      network: Network,
      waitRounds: number = 4,
    ) => {
      const client = getClient(network);
      return algosdk.waitForConfirmation(client, txId, waitRounds);
    },
  };
}

const facilitatorSigner = createFacilitatorSigner(
  process.env.AVM_PRIVATE_KEY!,
  {
    testnetUrl: "https://testnet-api.algonode.cloud",
    mainnetUrl: "https://mainnet-api.algonode.cloud",
  },
);

console.log("Fee payer addresses:", facilitatorSigner.getAddresses());
```

---

## Constants: Network Identifiers

```typescript
import {
  ALGORAND_MAINNET_CAIP2,
  ALGORAND_TESTNET_CAIP2,
  CAIP2_NETWORKS,
  ALGORAND_MAINNET_GENESIS_HASH,
  ALGORAND_TESTNET_GENESIS_HASH,
  V1_ALGORAND_MAINNET,
  V1_ALGORAND_TESTNET,
  V1_NETWORKS,
  V1_TO_CAIP2,
  CAIP2_TO_V1,
} from "@x402/avm";
```

---

## Constants: USDC Configuration

```typescript
import {
  USDC_MAINNET_ASA_ID,
  USDC_TESTNET_ASA_ID,
  USDC_DECIMALS,
  USDC_CONFIG,
} from "@x402/avm";

const testnetUsdc = USDC_CONFIG[ALGORAND_TESTNET_CAIP2];
console.log(testnetUsdc);
// { asaId: "10458941", name: "USDC", decimals: 6 }
```

---

## Constants: Algod Endpoints

```typescript
import {
  DEFAULT_ALGOD_MAINNET,
  DEFAULT_ALGOD_TESTNET,
  NETWORK_TO_ALGOD,
  FALLBACK_ALGOD_MAINNET,
  FALLBACK_ALGOD_TESTNET,
} from "@x402/avm";
```

---

## Constants: Transaction Limits and Address Validation

```typescript
import {
  MAX_ATOMIC_GROUP_SIZE,
  MIN_TXN_FEE,
  MAX_REASONABLE_FEE,
  ALGORAND_ADDRESS_REGEX,
  ALGORAND_ADDRESS_LENGTH,
} from "@x402/avm";

const isValid = ALGORAND_ADDRESS_REGEX.test(someAddress);
```

---

## Utility: Address Validation

```typescript
import { isValidAlgorandAddress } from "@x402/avm";

isValidAlgorandAddress("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
// => true

isValidAlgorandAddress("invalid");
// => false
```

---

## Utility: Amount Conversion

```typescript
import { convertToTokenAmount, convertFromTokenAmount } from "@x402/avm";

convertToTokenAmount("1.50", 6);     // => "1500000"
convertToTokenAmount("0.10", 6);     // => "100000"
convertToTokenAmount("100", 6);      // => "100000000"
convertToTokenAmount("0.000001", 6); // => "1"

convertFromTokenAmount("1500000", 6);   // => "1.5"
convertFromTokenAmount("100000", 6);    // => "0.1"
convertFromTokenAmount("1", 6);         // => "0.000001"
convertFromTokenAmount("100000000", 6); // => "100"
```

---

## Utility: Transaction Encoding/Decoding

```typescript
import {
  encodeTransaction,
  decodeTransaction,
  decodeSignedTransaction,
  decodeUnsignedTransaction,
} from "@x402/avm";

const base64Str = encodeTransaction(txnBytes);
// => "iaNhbXTOAAGGoKNm..."

const bytes = decodeTransaction(base64Str);
// => Uint8Array [...]

const signedTxn = decodeSignedTransaction(base64Str);
// => algosdk.SignedTransaction

const unsignedTxn = decodeUnsignedTransaction(base64Str);
// => algosdk.Transaction
```

---

## Utility: Network Functions

```typescript
import {
  getNetworkFromCaip2,
  isAlgorandNetwork,
  isTestnetNetwork,
  v1ToCaip2,
  caip2ToV1,
  createAlgodClient,
} from "@x402/avm";

getNetworkFromCaip2("algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=");
// => "testnet"

getNetworkFromCaip2("algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=");
// => "mainnet"

getNetworkFromCaip2("eip155:8453");
// => null

isAlgorandNetwork("algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=");
// => true

isAlgorandNetwork("algorand-testnet");
// => true

isAlgorandNetwork("eip155:8453");
// => false

isTestnetNetwork("algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=");
// => true

v1ToCaip2("algorand-testnet");
// => "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="

caip2ToV1("algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=");
// => "algorand-testnet"

const algod = createAlgodClient("algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=");

const customAlgod = createAlgodClient(
  "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=",
  "https://my-custom-node.example.com",
  "my-api-token",
);
```

---

## Utility: Transaction Inspection

```typescript
import {
  getSenderFromTransaction,
  getTransactionId,
  hasSignature,
  getGenesisHashFromTransaction,
  validateGroupId,
  assignGroupId,
} from "@x402/avm";

const sender = getSenderFromTransaction(signedTxnBytes, true);
const senderUnsigned = getSenderFromTransaction(unsignedTxnBytes, false);

const txId = getTransactionId(signedTxnBytes);

const signed = hasSignature(txnBytes);

const allMatch = validateGroupId([txn1Bytes, txn2Bytes, txn3Bytes]);

const groupedTxns = assignGroupId([txn1, txn2, txn3]);
```

---

## Simple Payment Group

```typescript
import algosdk from "algosdk";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID, createAlgodClient } from "@x402/avm";

async function createSimplePayment(
  senderAddress: string,
  receiverAddress: string,
  amount: number,
) {
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

---

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
    suggestedParams: {
      ...params,
      fee: 0,
      flatFee: true,
    },
  });

  const feePayerTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: feePayerAddress,
    to: feePayerAddress,
    amount: 0,
    suggestedParams: {
      ...params,
      fee: MIN_TXN_FEE * 2,
      flatFee: true,
    },
  });

  const grouped = algosdk.assignGroupID([paymentTxn, feePayerTxn]);

  const paymentBytes = grouped[0].toByte();
  const feePayerBytes = grouped[1].toByte();

  return {
    paymentGroup: [
      encodeTransaction(paymentBytes),
      encodeTransaction(feePayerBytes),
    ],
    paymentIndex: 0,
    rawBytes: [paymentBytes, feePayerBytes],
  };
}
```

---

## Fee Abstraction with x402Client

```typescript
import { x402Client } from "@x402/core/client";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import type { ClientAvmSigner } from "@x402/avm";
import algosdk from "algosdk";

const signer: ClientAvmSigner = {
  address: myAddress,
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

// Fee abstraction is automatic when PaymentRequirements include a feePayer
const response = await client.fetch("https://api.example.com/paid-resource");
```

---

## ExactAvmScheme Registration: Client

```typescript
import { x402Client } from "@x402/core/client";
import { ExactAvmScheme } from "@x402/avm/exact/client";

const client = new x402Client({ schemes: [] });

client.register(["algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="], new ExactAvmScheme(myClientSigner));
```

---

## ExactAvmScheme Registration: Server

```typescript
import { x402ResourceServer } from "@x402/core/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";

const server = new x402ResourceServer(facilitatorClient);

server.register(["algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="], new ExactAvmScheme());

// Or with wildcard (default)
server.register("algorand:*", new ExactAvmScheme());
```

---

## ExactAvmScheme Registration: Facilitator

```typescript
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2 } from "@x402/avm";

const facilitator = new x402Facilitator();

facilitator.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(myFacilitatorSigner));

facilitator.register([ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(myFacilitatorSigner));
```

---

## Complete End-to-End: Full Stack

```typescript
// ============================================================
// shared/config.ts
// ============================================================
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

export const NETWORK = ALGORAND_TESTNET_CAIP2;
export const USDC_ASA = USDC_TESTNET_ASA_ID;
export const RESOURCE_WALLET = "RECEIVER_ALGORAND_ADDRESS_58_CHARS_AAAAAAAAAAAAAAAAAAA";
export const FACILITATOR_URL = "http://localhost:4000";
export const RESOURCE_SERVER_URL = "http://localhost:3000";

// ============================================================
// facilitator/index.ts
// ============================================================
import express from "express";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import type { FacilitatorAvmSigner } from "@x402/avm";
import algosdk from "algosdk";
import { NETWORK } from "../shared/config";

const secretKey = Buffer.from(process.env.AVM_PRIVATE_KEY!, "base64");
const address = algosdk.encodeAddress(secretKey.slice(32));
const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");

const signer: FacilitatorAvmSigner = {
  getAddresses: () => [address],
  signTransaction: async (txn, _addr) => {
    const decoded = algosdk.decodeUnsignedTransaction(txn);
    return algosdk.signTransaction(decoded, secretKey).blob;
  },
  getAlgodClient: () => algodClient,
  simulateTransactions: async (txns) => {
    const stxns = txns.map((t) => {
      try { return algosdk.decodeSignedTransaction(t); }
      catch { return new algosdk.SignedTransaction({ txn: algosdk.decodeUnsignedTransaction(t) }); }
    });
    const req = new algosdk.modelsv2.SimulateRequest({
      txnGroups: [new algosdk.modelsv2.SimulateRequestTransactionGroup({ txns: stxns })],
      allowEmptySignatures: true,
    });
    return algodClient.simulateTransactions(req).do();
  },
  sendTransactions: async (signedTxns) => {
    const combined = Buffer.concat(signedTxns.map((t) => Buffer.from(t)));
    const { txId } = await algodClient.sendRawTransaction(combined).do();
    return txId;
  },
  waitForConfirmation: async (txId, _net, rounds = 4) => {
    return algosdk.waitForConfirmation(algodClient, txId, rounds);
  },
};

const facilitator = new x402Facilitator();
facilitator.register(NETWORK, new ExactAvmScheme(signer));

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

// ============================================================
// server/index.ts
// ============================================================
import express from "express";
import {
  x402HTTPResourceServer,
  HTTPFacilitatorClient,
} from "@x402/core/server";
import { ExactAvmScheme as ServerExactAvmScheme } from "@x402/avm/exact/server";
import {
  NETWORK,
  USDC_ASA,
  RESOURCE_WALLET,
  FACILITATOR_URL,
} from "../shared/config";

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

const httpServer = new x402HTTPResourceServer(facilitatorClient, {
  routes: [
    {
      path: "/api/weather",
      config: {
        scheme: "exact",
        payTo: RESOURCE_WALLET,
        price: { asset: USDC_ASA, amount: "10000", extra: { name: "USDC", decimals: 6 } },
        network: NETWORK,
        maxTimeoutSeconds: 60,
      },
      description: "Weather data API",
      mimeType: "application/json",
    },
  ],
});
httpServer.resourceServer.register("algorand:*", new ServerExactAvmScheme());

const app = express();

app.get("/api/weather", async (req, res) => {
  const result = await httpServer.processRequest({
    url: req.url,
    method: req.method,
    headers: req.headers,
    adapter: {
      getHeader: (name: string) => req.headers[name.toLowerCase()] as string,
    },
  });

  if (result.status === 402) {
    return res.status(402).json(result.body);
  }

  res.json({
    temperature: 72,
    condition: "Sunny",
    location: "San Francisco",
  });
});

app.listen(3000, () => console.log("Resource server running on :3000"));

// ============================================================
// client/index.ts
// ============================================================
import { x402Client } from "@x402/core/client";
import { ExactAvmScheme as ClientExactAvmScheme } from "@x402/avm/exact/client";
import type { ClientAvmSigner } from "@x402/avm";
import algosdk from "algosdk";
import { RESOURCE_SERVER_URL } from "../shared/config";

const clientSecretKey = Buffer.from(process.env.CLIENT_AVM_PRIVATE_KEY!, "base64");
const clientAddress = algosdk.encodeAddress(clientSecretKey.slice(32));

const clientSigner: ClientAvmSigner = {
  address: clientAddress,
  signTransactions: async (txns, indexesToSign) => {
    return txns.map((txn, i) => {
      if (indexesToSign && !indexesToSign.includes(i)) return null;
      const decoded = algosdk.decodeUnsignedTransaction(txn);
      return algosdk.signTransaction(decoded, clientSecretKey).blob;
    });
  },
};

const client = new x402Client({ schemes: [] });
client.register("algorand:*", new ClientExactAvmScheme(clientSigner));

async function getWeather() {
  const response = await client.fetch(`${RESOURCE_SERVER_URL}/api/weather`);

  if (response.ok) {
    const weather = await response.json();
    console.log("Weather:", weather);
  } else {
    console.error("Failed:", response.status, response.statusText);
  }
}

getWeather();
```

---

## Node.js Facilitator Service

```typescript
import express from "express";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2 } from "@x402/avm";
import algosdk from "algosdk";

const secretKey = Buffer.from(process.env.AVM_PRIVATE_KEY!, "base64");
const address = algosdk.encodeAddress(secretKey.slice(32));

const algodTestnet = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");
const algodMainnet = new algosdk.Algodv2("", "https://mainnet-api.algonode.cloud", "");

function getClient(network: string) {
  return network === ALGORAND_MAINNET_CAIP2 ? algodMainnet : algodTestnet;
}

const signer = {
  getAddresses: () => [address] as const,
  signTransaction: async (txn: Uint8Array) => {
    const decoded = algosdk.decodeUnsignedTransaction(txn);
    return algosdk.signTransaction(decoded, secretKey).blob;
  },
  getAlgodClient: (network: string) => getClient(network),
  simulateTransactions: async (txns: Uint8Array[], network: string) => {
    const client = getClient(network);
    const stxns = txns.map((t) => {
      try { return algosdk.decodeSignedTransaction(t); }
      catch { return new algosdk.SignedTransaction({ txn: algosdk.decodeUnsignedTransaction(t) }); }
    });
    const req = new algosdk.modelsv2.SimulateRequest({
      txnGroups: [new algosdk.modelsv2.SimulateRequestTransactionGroup({ txns: stxns })],
      allowEmptySignatures: true,
    });
    const result = await client.simulateTransactions(req).do();
    for (const g of result.txnGroups || []) {
      if (g.failureMessage) throw new Error(`Simulation failed: ${g.failureMessage}`);
    }
    return result;
  },
  sendTransactions: async (signedTxns: Uint8Array[], network: string) => {
    const client = getClient(network);
    const combined = Buffer.concat(signedTxns.map((t) => Buffer.from(t)));
    const { txId } = await client.sendRawTransaction(combined).do();
    return txId;
  },
  waitForConfirmation: async (txId: string, network: string, rounds = 4) => {
    return algosdk.waitForConfirmation(getClient(network), txId, rounds);
  },
};

const facilitator = new x402Facilitator();
facilitator.register([ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer));

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/supported", async (_req, res) => {
  try {
    res.json(facilitator.getSupportedNetworks());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const PORT = parseInt(process.env.PORT || "4000", 10);
app.listen(PORT, () => {
  console.log(`Facilitator service running on port ${PORT}`);
  console.log(`Fee payer address: ${address}`);
  console.log(`Networks: Testnet + Mainnet`);
});
```
