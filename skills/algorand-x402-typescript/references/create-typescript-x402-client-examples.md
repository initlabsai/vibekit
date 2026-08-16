# x402 HTTP Client Examples

## Quick Start (Fetch)

```typescript
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import algosdk from "algosdk";

const secretKey = Buffer.from(process.env.AVM_PRIVATE_KEY!, "base64");
const address = algosdk.encodeAddress(secretKey.slice(32));
const signer = {
  address,
  signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) => {
    return txns.map((txn, i) => {
      if (indexesToSign && !indexesToSign.includes(i)) return null;
      const decoded = algosdk.decodeUnsignedTransaction(txn);
      const signed = algosdk.signTransaction(decoded, secretKey);
      return signed.blob;
    });
  },
};

const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));

const fetchWithPay = wrapFetchWithPayment(fetch, client);
const response = await fetchWithPay("https://api.example.com/premium-data");
const data = await response.json();
console.log(data);
```

---

## Quick Start (Axios)

```typescript
import axios from "axios";
import { wrapAxiosWithPayment, x402Client } from "@x402/axios";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import algosdk from "algosdk";

const secretKey = Buffer.from(process.env.AVM_PRIVATE_KEY!, "base64");
const address = algosdk.encodeAddress(secretKey.slice(32));
const signer = {
  address,
  signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) => {
    return txns.map((txn, i) => {
      if (indexesToSign && !indexesToSign.includes(i)) return null;
      const decoded = algosdk.decodeUnsignedTransaction(txn);
      const signed = algosdk.signTransaction(decoded, secretKey);
      return signed.blob;
    });
  },
};

const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));

const api = wrapAxiosWithPayment(axios.create(), client);
const response = await api.get("https://api.example.com/premium-data");
console.log(response.data);
```

---

## Basic Fetch Usage

```typescript
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";

const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));

const fetchWithPay = wrapFetchWithPayment(fetch, client);

// GET request
const getResponse = await fetchWithPay("https://api.example.com/paid-content");
console.log(await getResponse.json());

// POST request with body
const postResponse = await fetchWithPay("https://api.example.com/paid-action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "premium data" }),
});
console.log(await postResponse.json());
```

---

## Basic Axios Usage

```typescript
import axios from "axios";
import { wrapAxiosWithPayment, x402Client } from "@x402/axios";
import { ExactAvmScheme } from "@x402/avm/exact/client";

const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));

const api = wrapAxiosWithPayment(axios.create({
  baseURL: "https://api.example.com",
  timeout: 30000,
  headers: { Accept: "application/json" },
}), client);

// GET request
const getResult = await api.get("/paid-content");
console.log(getResult.data);

// POST request
const postResult = await api.post("/paid-action", {
  query: "premium search",
});
console.log(postResult.data);

// PUT request with custom headers
const putResult = await api.put("/paid-resource/123", {
  name: "Updated Name",
}, {
  headers: { "X-Custom-Header": "value" },
});
console.log(putResult.data);
```

---

## Wrapping the Default Axios Instance

```typescript
import axios from "axios";
import { wrapAxiosWithPayment, x402Client } from "@x402/axios";
import { ExactAvmScheme } from "@x402/avm/exact/client";

const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));

wrapAxiosWithPayment(axios, client);

const response = await axios.get("https://api.example.com/paid");
```

---

## Config-Based Fetch Setup

```typescript
import {
  wrapFetchWithPaymentFromConfig,
  type x402ClientConfig,
} from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm";

const config: x402ClientConfig = {
  schemes: [
    {
      network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      client: new ExactAvmScheme(signer),
    },
  ],
  policies: [
    (version, reqs) => reqs.filter((r) => BigInt(r.amount ?? "0") < BigInt("10000000")),
  ],
};

const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, config);
const response = await fetchWithPay("https://api.example.com/paid-endpoint");
```

---

## Config-Based Axios Setup

```typescript
import axios from "axios";
import {
  wrapAxiosWithPaymentFromConfig,
  type x402ClientConfig,
} from "@x402/axios";
import { ExactAvmScheme } from "@x402/avm";

const config: x402ClientConfig = {
  schemes: [
    {
      network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      client: new ExactAvmScheme(signer),
    },
  ],
  policies: [
    (version, reqs) => reqs.filter((r) => BigInt(r.amount ?? "0") < BigInt("5000000")),
  ],
};

const api = wrapAxiosWithPaymentFromConfig(axios.create(), config);
const response = await api.get("https://api.example.com/paid-endpoint");
console.log(response.data);
```

---

## Wildcard Network Registration

```typescript
const config: x402ClientConfig = {
  schemes: [
    {
      network: "algorand:*",
      client: new ExactAvmScheme(signer),
    },
  ],
};
```

---

## ClientAvmSigner: Node.js Implementation

```typescript
import algosdk from "algosdk";
import type { ClientAvmSigner } from "@x402/avm";

function createNodeSigner(privateKeyBase64: string): ClientAvmSigner {
  const secretKey = Buffer.from(privateKeyBase64, "base64");
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

const signer = createNodeSigner(process.env.AVM_PRIVATE_KEY!);
console.log("Signer address:", signer.address);
```

---

## ClientAvmSigner: Browser with @txnlab/use-wallet (React Hook)

```typescript
import { useWallet } from "@txnlab/use-wallet-react";
import type { ClientAvmSigner } from "@x402/avm";

function useAvmSigner(): ClientAvmSigner | null {
  const { activeAccount, signTransactions } = useWallet();

  if (!activeAccount) return null;

  return {
    address: activeAccount.address,
    signTransactions: async (
      txns: Uint8Array[],
      indexesToSign?: number[],
    ): Promise<(Uint8Array | null)[]> => {
      const signed = await signTransactions(txns, indexesToSign);
      return signed;
    },
  };
}
```

---

## ClientAvmSigner: Browser with Pera Wallet (Vanilla JS)

```typescript
import { PeraWalletConnect } from "@perawallet/connect";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import type { ClientAvmSigner } from "@x402/avm";

const peraWallet = new PeraWalletConnect();

async function setupPaymentFetch(): Promise<typeof fetch> {
  const accounts = await peraWallet.connect();
  const address = accounts[0];

  const signer: ClientAvmSigner = {
    address,
    signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) => {
      const txnGroup = txns.map((txn, i) => ({
        txn,
        signers: indexesToSign && !indexesToSign.includes(i) ? [] : [address],
      }));

      const signedTxns = await peraWallet.signTransaction([txnGroup]);
      return txns.map((_, i) => {
        if (indexesToSign && !indexesToSign.includes(i)) return null;
        return signedTxns.shift() ?? null;
      });
    },
  };

  const client = new x402Client();
  client.register("algorand:*", new ExactAvmScheme(signer));
  return wrapFetchWithPayment(fetch, client);
}

const paidFetch = await setupPaymentFetch();
const response = await paidFetch("https://api.example.com/paid-api");
```

---

## Payment Policies: Prefer Algorand

```typescript
import { wrapFetchWithPayment, x402Client, type PaymentPolicy } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";

const preferAlgorand: PaymentPolicy = (version, reqs) => {
  const algorandReqs = reqs.filter((r) => r.network.startsWith("algorand:"));
  return algorandReqs.length > 0 ? algorandReqs : reqs;
};

const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));
client.registerPolicy(preferAlgorand);

const fetchWithPay = wrapFetchWithPayment(fetch, client);
```

---

## Payment Policies: Maximum Amount Limit

```typescript
const maxAmount: PaymentPolicy = (version, reqs) => {
  return reqs.filter((r) => {
    const amount = BigInt(r.amount ?? r.maxAmountRequired ?? "0");
    return amount <= BigInt("1000000"); // 1 USDC
  });
};

client.registerPolicy(maxAmount);
```

---

## Payment Policies: Prefer Testnet

```typescript
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const preferTestnet: PaymentPolicy = (version, reqs) => {
  const testnetReqs = reqs.filter((r) => r.network === ALGORAND_TESTNET_CAIP2);
  return testnetReqs.length > 0 ? testnetReqs : reqs;
};

client.registerPolicy(preferTestnet);
```

---

## Combining Multiple Policies

```typescript
const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));

client
  .registerPolicy(preferAlgorand)
  .registerPolicy(preferTestnet)
  .registerPolicy(maxAmount);
```

---

## Custom Algod Endpoint

```typescript
const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));
```

---

## Pre-Configured Algod Client

```typescript
import algosdk from "algosdk";
import { ExactAvmScheme } from "@x402/avm/exact/client";

const algodClient = new algosdk.Algodv2(
  "your-token",
  "https://your-node.example.com",
  443,
);

const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));
```

---

## Specific Network Registration

```typescript
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";
import { ExactAvmScheme } from "@x402/avm/exact/client";

const client = new x402Client();
client.register([ALGORAND_TESTNET_CAIP2], new ExactAvmScheme(signer));
```

---

## Error Handling (Fetch)

```typescript
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";

const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));
const fetchWithPay = wrapFetchWithPayment(fetch, client);

try {
  const response = await fetchWithPay("https://api.example.com/paid-endpoint");

  if (response.ok) {
    const data = await response.json();
    console.log("Success:", data);
  } else {
    console.error(`Server error: ${response.status} ${response.statusText}`);
  }
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes("Failed to parse payment requirements")) {
      console.error("Invalid payment requirements from server");
    } else if (error.message.includes("Failed to create payment payload")) {
      console.error("Could not create payment:", error.message);
    } else if (error.message.includes("Payment already attempted")) {
      console.error("Payment was rejected by the server");
    } else if (error.message.includes("No network/scheme registered")) {
      console.error("Unsupported payment network requested");
    } else if (error.message.includes("Payment creation aborted")) {
      console.error("Payment was blocked by policy");
    } else {
      console.error("Unexpected error:", error.message);
    }
  }
}
```

---

## Error Handling (Axios)

```typescript
import axios, { AxiosError } from "axios";
import { wrapAxiosWithPayment, x402Client } from "@x402/axios";
import { ExactAvmScheme } from "@x402/avm/exact/client";

const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));
const api = wrapAxiosWithPayment(axios.create(), client);

try {
  const response = await api.get("https://api.example.com/paid-content");
  console.log("Success:", response.data);
} catch (error) {
  if (error instanceof AxiosError) {
    if (error.response) {
      console.error(`Server returned ${error.response.status}:`, error.response.data);
    } else if (error.request) {
      console.error("No response received:", error.message);
    } else {
      console.error("Request setup error:", error.message);
    }
  } else if (error instanceof Error) {
    if (error.message.includes("Failed to parse payment requirements")) {
      console.error("Server sent invalid 402 response");
    } else if (error.message.includes("Failed to create payment payload")) {
      console.error("Could not sign payment:", error.message);
    } else if (error.message.includes("No network/scheme registered")) {
      console.error("Server requires a payment network we don't support");
    } else if (error.message.includes("All payment requirements were filtered out")) {
      console.error("All payment options were rejected by our policies");
    } else {
      console.error("Unexpected error:", error.message);
    }
  }
}
```

---

## Lifecycle Hooks

```typescript
const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));

client.onBeforePaymentCreation(async (context) => {
  const { selectedRequirements } = context;
  console.log(
    `About to pay ${selectedRequirements.amount} on ${selectedRequirements.network}`,
  );

  const amountUSDC = Number(selectedRequirements.amount) / 1_000_000;
  if (amountUSDC > 10) {
    return { abort: true, reason: "Amount exceeds $10 USDC limit" };
  }
});

client.onAfterPaymentCreation(async (context) => {
  console.log("Payment created successfully for:", context.paymentRequired.resource?.url);
});

client.onPaymentCreationFailure(async (context) => {
  console.error("Payment failed:", context.error.message);
});

const fetchWithPay = wrapFetchWithPayment(fetch, client);
```

---

## Reading Payment Response Headers

```typescript
import { decodePaymentResponseHeader } from "@x402/fetch";

const response = await fetchWithPay("https://api.example.com/paid-endpoint");

const paymentResponseHeader =
  response.headers.get("PAYMENT-RESPONSE");

if (paymentResponseHeader) {
  const receipt = decodePaymentResponseHeader(paymentResponseHeader);
  console.log("Transaction settled:", receipt);
}
```

---

## Custom Payment Requirements Selector

```typescript
const cheapestFirst = (version: number, reqs: PaymentRequirements[]) => {
  return reqs.sort((a, b) => {
    const amountA = BigInt(a.amount ?? a.maxAmountRequired ?? "0");
    const amountB = BigInt(b.amount ?? b.maxAmountRequired ?? "0");
    return amountA < amountB ? -1 : amountA > amountB ? 1 : 0;
  })[0];
};

const client = new x402Client(cheapestFirst);
client.register("algorand:*", new ExactAvmScheme(signer));
```

---

## Complete Browser Example (React + Pera Wallet)

```tsx
import React, { useState, useMemo, useCallback } from "react";
import { WalletProvider, useWallet } from "@txnlab/use-wallet-react";
import { WalletId } from "@txnlab/use-wallet";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import type { ClientAvmSigner } from "@x402/avm";

const WALLET_PROVIDERS = [
  { id: WalletId.PERA },
  { id: WalletId.DEFLY },
  { id: WalletId.LUTE },
];

function PaidApiDemo() {
  const { activeAccount, signTransactions, providers } = useWallet();
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const signer: ClientAvmSigner | null = useMemo(() => {
    if (!activeAccount) return null;
    return {
      address: activeAccount.address,
      signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) => {
        return signTransactions(txns, indexesToSign);
      },
    };
  }, [activeAccount, signTransactions]);

  const fetchWithPay = useMemo(() => {
    if (!signer) return null;
    const client = new x402Client();
    client.register("algorand:*", new ExactAvmScheme(signer));
    return wrapFetchWithPayment(fetch, client);
  }, [signer]);

  const handleConnect = useCallback(async () => {
    const pera = providers?.find((p) => p.metadata.id === WalletId.PERA);
    if (pera) await pera.connect();
  }, [providers]);

  const handleFetch = useCallback(async () => {
    if (!fetchWithPay) return;
    setLoading(true);
    try {
      const response = await fetchWithPay("https://api.example.com/premium-content");
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [fetchWithPay]);

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>x402-avm Fetch Demo</h1>
      {!activeAccount ? (
        <button onClick={handleConnect}>Connect Pera Wallet</button>
      ) : (
        <div>
          <p>Connected: {activeAccount.address.slice(0, 8)}...</p>
          <button onClick={handleFetch} disabled={loading}>
            {loading ? "Paying & Fetching..." : "Fetch Premium Content ($0.01 USDC)"}
          </button>
        </div>
      )}
      {result && (
        <pre style={{ background: "#f5f5f5", padding: "10px", marginTop: "10px" }}>
          {result}
        </pre>
      )}
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider wallets={WALLET_PROVIDERS}>
      <PaidApiDemo />
    </WalletProvider>
  );
}
```

---

## Complete Node.js CLI Example

```typescript
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";
import algosdk from "algosdk";

async function main() {
  const privateKey = process.env.AVM_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Error: AVM_PRIVATE_KEY environment variable is required");
    console.error("Format: Base64-encoded 64-byte key (32-byte seed + 32-byte pubkey)");
    process.exit(1);
  }

  const secretKey = Buffer.from(privateKey, "base64");
  const address = algosdk.encodeAddress(secretKey.slice(32));
  console.log(`Using address: ${address}`);

  const signer = {
    address,
    signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) => {
      return txns.map((txn, i) => {
        if (indexesToSign && !indexesToSign.includes(i)) return null;
        const decoded = algosdk.decodeUnsignedTransaction(txn);
        const signed = algosdk.signTransaction(decoded, secretKey);
        return signed.blob;
      });
    },
  };

  const client = new x402Client();
  client.register("algorand:*", new ExactAvmScheme(signer));

  client.registerPolicy((version, reqs) => {
    return reqs.filter((r) => BigInt(r.amount ?? "0") <= BigInt("5000000"));
  });

  client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
    const amountUSDC = Number(selectedRequirements.amount) / 1_000_000;
    console.log(`[x402] Paying $${amountUSDC.toFixed(6)} USDC on ${selectedRequirements.network}`);
  });

  client.onAfterPaymentCreation(async () => {
    console.log("[x402] Payment transaction signed successfully");
  });

  const fetchWithPay = wrapFetchWithPayment(fetch, client);

  const url = process.argv[2] || "https://api.example.com/paid-endpoint";
  console.log(`\nFetching: ${url}`);

  try {
    const response = await fetchWithPay(url);
    console.log(`Status: ${response.status} ${response.statusText}`);

    const paymentResponse = response.headers.get("PAYMENT-RESPONSE");
    if (paymentResponse) {
      console.log(`Payment Response: ${paymentResponse}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      console.log("\nResponse:", JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log("\nResponse:", text);
    }
  } catch (error) {
    console.error("\nFailed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
```

---

## Complete Axios Node.js API Client

```typescript
import axios, { AxiosError } from "axios";
import { wrapAxiosWithPayment, x402Client, type PaymentPolicy } from "@x402/axios";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";
import algosdk from "algosdk";

const secretKey = Buffer.from(process.env.AVM_PRIVATE_KEY!, "base64");
const address = algosdk.encodeAddress(secretKey.slice(32));

const signer = {
  address,
  signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) => {
    return txns.map((txn, i) => {
      if (indexesToSign && !indexesToSign.includes(i)) return null;
      const decoded = algosdk.decodeUnsignedTransaction(txn);
      const signed = algosdk.signTransaction(decoded, secretKey);
      return signed.blob;
    });
  },
};

const client = new x402Client();
client.register("algorand:*", new ExactAvmScheme(signer));

const maxPaymentPolicy: PaymentPolicy = (version, reqs) => {
  return reqs.filter((r) => BigInt(r.amount ?? "0") <= BigInt("5000000"));
};

client.registerPolicy(maxPaymentPolicy);

client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
  const usdcAmount = Number(selectedRequirements.amount) / 1_000_000;
  console.log(`[x402] Paying $${usdcAmount.toFixed(6)} to ${selectedRequirements.payTo}`);
});

client.onAfterPaymentCreation(async () => {
  console.log("[x402] Transaction signed and submitted");
});

const api = wrapAxiosWithPayment(
  axios.create({
    baseURL: "https://api.example.com",
    timeout: 30000,
    headers: {
      Accept: "application/json",
      "User-Agent": "x402-avm-client/1.0",
    },
  }),
  client,
);

async function fetchPremiumContent(contentId: string) {
  try {
    const response = await api.get(`/premium/content/${contentId}`);
    console.log("Content:", response.data);

    const paymentReceipt = response.headers["payment-response"];
    if (paymentReceipt) {
      console.log("Payment receipt:", paymentReceipt);
    }

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 402) {
        console.error("Payment failed -- server rejected our payment");
      } else if (error.response?.status === 404) {
        console.error("Content not found");
      } else {
        console.error(`API error: ${error.response?.status}`, error.response?.data);
      }
    } else {
      console.error("Unexpected error:", error);
    }
    throw error;
  }
}

async function main() {
  console.log(`Wallet address: ${address}`);
  console.log(`Network: ${ALGORAND_TESTNET_CAIP2}\n`);

  const content = await fetchPremiumContent("article-123");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
```

---

## Axios Interceptor Order

```typescript
const api = axios.create();

api.interceptors.request.use((config) => {
  config.headers.set("Authorization", `Bearer ${getToken()}`);
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log(`${response.config.method} ${response.config.url}: ${response.status}`);
    return response;
  },
);

// Add payment interceptor last
wrapAxiosWithPayment(api, client);
```
