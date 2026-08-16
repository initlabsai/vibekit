# x402 Paywall Examples

## AVM-Only Paywall

```typescript
import { createPaywall, avmPaywall } from "@x402/paywall";

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withConfig({
    appName: "My DApp",
    appLogo: "https://example.com/logo.png",
    testnet: true,
  })
  .build();
```

---

## EVM-Only Paywall

```typescript
import { createPaywall, evmPaywall } from "@x402/paywall";

const paywall = createPaywall()
  .withNetwork(evmPaywall)
  .withConfig({
    appName: "EVM DApp",
    testnet: true,
  })
  .build();
```

---

## Multi-Network Paywall (AVM + EVM)

```typescript
import { createPaywall, avmPaywall, evmPaywall } from "@x402/paywall";

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withNetwork(evmPaywall)
  .withConfig({
    appName: "Multi-Chain Premium",
    testnet: true,
  })
  .build();
```

---

## Universal Paywall (AVM + EVM + SVM)

```typescript
import { createPaywall, avmPaywall, evmPaywall, svmPaywall } from "@x402/paywall";

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withNetwork(evmPaywall)
  .withNetwork(svmPaywall)
  .withConfig({
    appName: "Universal Paywall",
    testnet: true,
  })
  .build();
```

---

## Express.js Basic Integration

```typescript
import express from "express";
import {
  paymentMiddleware,
  x402ResourceServer,
} from "@x402/express";
import { createPaywall, avmPaywall } from "@x402/paywall";

const app = express();

const routes = {
  "/api/premium-content": {
    accepts: {
      scheme: "exact",
      network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      asset: "10458941",
      payTo: "YOUR_ALGORAND_ADDRESS_HERE",
      price: "$0.01",
      maxTimeoutSeconds: 300,
    },
    description: "Access to premium content",
    mimeType: "application/json",
  },
};

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withConfig({
    appName: "Premium API",
    appLogo: "https://example.com/logo.png",
    testnet: true,
  })
  .build();

const facilitatorUrl = process.env.FACILITATOR_URL || "https://facilitator.example.com";
const server = new x402ResourceServer({ url: facilitatorUrl });

app.use(paymentMiddleware(routes, server, { testnet: true }, paywall));

app.get("/api/premium-content", (req, res) => {
  res.json({
    title: "Premium Article",
    content: "This is the paid content that was unlocked by your USDC payment.",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/free-content", (req, res) => {
  res.json({ message: "This content is free!" });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```

---

## Express.js with HTTP Resource Server and Hooks

```typescript
import {
  paymentMiddlewareFromHTTPServer,
  x402ResourceServer,
  x402HTTPResourceServer,
} from "@x402/express";
import { createPaywall, avmPaywall } from "@x402/paywall";

const resourceServer = new x402ResourceServer({ url: facilitatorUrl });

const httpServer = new x402HTTPResourceServer(resourceServer, routes)
  .onProtectedRequest(async (context) => {
    console.log(`[x402] Protected request: ${context.path}`);
  });

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withConfig({ appName: "My App", testnet: true })
  .build();

app.use(paymentMiddlewareFromHTTPServer(httpServer, { testnet: true }, paywall));
```

---

## Express.js Multiple Protected Routes

```typescript
const routes = {
  "/api/weather": {
    accepts: {
      scheme: "exact",
      network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      asset: "10458941",
      payTo: "YOUR_ADDRESS",
      price: "$0.001",
      maxTimeoutSeconds: 60,
    },
    description: "Real-time weather data",
    mimeType: "application/json",
  },
  "/api/analytics": {
    accepts: {
      scheme: "exact",
      network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      asset: "10458941",
      payTo: "YOUR_ADDRESS",
      price: "$0.05",
      maxTimeoutSeconds: 300,
    },
    description: "Detailed analytics report",
    mimeType: "application/json",
  },
  "/api/ai-summary": {
    accepts: {
      scheme: "exact",
      network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      asset: "10458941",
      payTo: "YOUR_ADDRESS",
      price: "$0.10",
      maxTimeoutSeconds: 600,
    },
    description: "AI-powered content summary",
    mimeType: "application/json",
  },
};
```

---

## Hono Basic Integration

```typescript
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { createPaywall, avmPaywall } from "@x402/paywall";

const app = new Hono();

const routes = {
  "/api/premium": {
    accepts: {
      scheme: "exact",
      network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      asset: "10458941",
      payTo: "YOUR_ALGORAND_ADDRESS",
      price: "$0.01",
      maxTimeoutSeconds: 300,
    },
    description: "Premium content access",
    mimeType: "application/json",
  },
};

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withConfig({ appName: "Hono API", testnet: true })
  .build();

const server = new x402ResourceServer({ url: process.env.FACILITATOR_URL! });

app.use("*", paymentMiddleware(routes, server, { testnet: true }, paywall));

app.get("/api/premium", (c) => {
  return c.json({
    content: "This is premium content, paid with USDC on Algorand!",
  });
});

app.get("/", (c) => c.text("Welcome to the Hono API"));

export default app;
```

---

## Hono with Cloudflare Workers

```typescript
import { Hono } from "hono";
import { paymentMiddlewareFromConfig, x402ResourceServer } from "@x402/hono";
import { createPaywall, avmPaywall } from "@x402/paywall";

type Env = {
  FACILITATOR_URL: string;
  PAYTO_ADDRESS: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const routes = {
    "/api/data": {
      accepts: {
        scheme: "exact",
        network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
        asset: "10458941",
        payTo: c.env.PAYTO_ADDRESS,
        price: "$0.01",
        maxTimeoutSeconds: 300,
      },
      description: "Paid API data",
      mimeType: "application/json",
    },
  };

  const paywall = createPaywall()
    .withNetwork(avmPaywall)
    .withConfig({ appName: "Worker API", testnet: true })
    .build();

  const server = new x402ResourceServer({ url: c.env.FACILITATOR_URL });

  const middleware = paymentMiddleware(routes, server, { testnet: true }, paywall);
  return middleware(c, next);
});

app.get("/api/data", (c) => {
  return c.json({ data: "Premium data from Cloudflare Worker" });
});

export default app;
```

---

## Next.js Middleware Approach

```typescript
// middleware.ts
import { paymentProxy, x402ResourceServer } from "@x402/next";
import { createPaywall, avmPaywall } from "@x402/paywall";
import { NextRequest, NextResponse } from "next/server";

const routes = {
  "/api/premium": {
    accepts: {
      scheme: "exact",
      network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      asset: "10458941",
      payTo: process.env.PAYTO_ADDRESS!,
      price: "$0.01",
      maxTimeoutSeconds: 300,
    },
    description: "Premium API endpoint",
    mimeType: "application/json",
  },
};

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withConfig({
    appName: "Next.js App",
    appLogo: "/logo.png",
    testnet: true,
  })
  .build();

const server = new x402ResourceServer({ url: process.env.FACILITATOR_URL! });

const proxy = paymentProxy(routes, server, { testnet: true }, paywall);

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/premium")) {
    return proxy(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/premium/:path*"],
};
```

---

## Next.js Route Handler (withX402)

```typescript
// app/api/premium/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { createPaywall, avmPaywall } from "@x402/paywall";

const server = new x402ResourceServer({
  url: process.env.FACILITATOR_URL!,
});

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withConfig({ appName: "Next.js App", testnet: true })
  .build();

const routeConfig = {
  accepts: {
    scheme: "exact",
    network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    asset: "10458941",
    payTo: process.env.PAYTO_ADDRESS!,
    price: "$0.01",
    maxTimeoutSeconds: 300,
  },
  description: "Premium content",
  mimeType: "application/json",
};

async function handler(request: NextRequest) {
  return NextResponse.json({
    content: "Premium content unlocked with Algorand USDC payment!",
    timestamp: new Date().toISOString(),
  });
}

export const GET = withX402(handler, routeConfig, server, { testnet: true }, paywall);
```

---

## Multi-Network Server Routes

```typescript
const routes = {
  "/api/premium": {
    accepts: [
      {
        scheme: "exact",
        network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
        asset: "10458941",
        payTo: "ALGO_ADDRESS_HERE",
        price: "$0.01",
        maxTimeoutSeconds: 300,
      },
      {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0xEVM_ADDRESS_HERE",
        price: "$0.01",
        maxTimeoutSeconds: 30,
      },
    ],
    description: "Premium content - pay with USDC on Algorand or Base",
    mimeType: "application/json",
  },
};
```

---

## Custom Paywall Handler

```typescript
import type { PaywallNetworkHandler, PaymentRequirements, PaymentRequired, PaywallConfig } from "@x402/paywall";

const customAvmPaywall: PaywallNetworkHandler = {
  supports(requirement: PaymentRequirements): boolean {
    return requirement.network.startsWith("algorand:");
  },

  generateHtml(
    requirement: PaymentRequirements,
    paymentRequired: PaymentRequired,
    config: PaywallConfig,
  ): string {
    const amount = requirement.amount
      ? parseFloat(requirement.amount) / 1_000_000
      : 0;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${config.appName || "Payment Required"}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 40px auto;
            padding: 20px;
            text-align: center;
          }
          .amount { font-size: 2em; font-weight: bold; color: #1a1a2e; }
          .pay-btn {
            background: #6c63ff;
            color: white;
            border: none;
            padding: 16px 48px;
            font-size: 1.1em;
            border-radius: 12px;
            cursor: pointer;
            margin-top: 24px;
          }
        </style>
        <script>
          window.x402 = {
            amount: ${amount},
            paymentRequired: ${JSON.stringify(paymentRequired)},
            testnet: ${config.testnet ?? true},
            currentUrl: "${paymentRequired.resource?.url || config.currentUrl || ""}",
            config: { chainConfig: {} },
            appName: "${config.appName || ""}",
            appLogo: "${config.appLogo || ""}",
          };
        </script>
      </head>
      <body>
        ${config.appLogo ? `<img src="${config.appLogo}" style="width:64px;height:64px;border-radius:12px" />` : ""}
        <h1>Payment Required</h1>
        <p>${paymentRequired.resource?.description || "Access to premium content"}</p>
        <div class="amount">$${amount.toFixed(2)} USDC</div>
        <p>on Algorand ${config.testnet ? "Testnet" : "Mainnet"}</p>
        <button class="pay-btn" id="payBtn">Connect Wallet & Pay</button>
      </body>
      </html>
    `;
  },
};

const paywall = createPaywall()
  .withNetwork(customAvmPaywall)
  .withConfig({ appName: "Custom Paywall" })
  .build();
```

---

## Wallet Configuration

```typescript
import { getWallets } from "@wallet-standard/app";

const walletsApi = getWallets();
const algorandWallets = walletsApi.get().filter((wallet) => {
  return "algorand:signTransaction" in wallet.features;
});
```

---

## Custom Wallet Integration (Outside Paywall)

```typescript
import { useWallet } from "@txnlab/use-wallet-react";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import type { ClientAvmSigner } from "@x402/avm";

function CustomPaymentUI() {
  const { activeAccount, signTransactions } = useWallet();

  async function payAndFetch(url: string) {
    if (!activeAccount) throw new Error("Connect wallet first");

    const signer: ClientAvmSigner = {
      address: activeAccount.address,
      signTransactions: async (txns, indexes) => signTransactions(txns, indexes),
    };

    const client = new x402Client();
    client.register("algorand:*", new ExactAvmScheme(signer));
    const fetchWithPay = wrapFetchWithPayment(fetch, client);

    const response = await fetchWithPay(url);
    return response;
  }
}
```

---

## Paywall Config Override at Runtime

```typescript
app.use(paymentMiddleware(
  routes,
  server,
  {
    testnet: process.env.NODE_ENV !== "production",
    appName: process.env.APP_NAME || "My App",
  },
  paywall,
));
```

---

## Complete Express.js Server with AVM Paywall

```typescript
import express from "express";
import cors from "cors";
import {
  paymentMiddleware,
  x402ResourceServer,
} from "@x402/express";
import { createPaywall, avmPaywall } from "@x402/paywall";

const app = express();
app.use(cors());
app.use(express.json());

const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.example.com";
const PAYTO_ADDRESS = process.env.PAYTO_ADDRESS || "YOUR_ALGORAND_ADDRESS";
const PORT = parseInt(process.env.PORT || "3000");
const IS_TESTNET = process.env.NODE_ENV !== "production";

const ALGORAND_TESTNET_NETWORK = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";
const ALGORAND_MAINNET_NETWORK = "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=";
const USDC_TESTNET_ASA = "10458941";
const USDC_MAINNET_ASA = "31566704";

const network = IS_TESTNET ? ALGORAND_TESTNET_NETWORK : ALGORAND_MAINNET_NETWORK;
const usdcAsset = IS_TESTNET ? USDC_TESTNET_ASA : USDC_MAINNET_ASA;

const routes = {
  "/api/weather": {
    accepts: {
      scheme: "exact",
      network,
      asset: usdcAsset,
      payTo: PAYTO_ADDRESS,
      price: "$0.001",
      maxTimeoutSeconds: 60,
    },
    description: "Real-time weather data for any city",
    mimeType: "application/json",
  },
  "/api/article/:id": {
    accepts: {
      scheme: "exact",
      network,
      asset: usdcAsset,
      payTo: PAYTO_ADDRESS,
      price: "$0.05",
      maxTimeoutSeconds: 300,
    },
    description: "Full premium article access",
    mimeType: "application/json",
  },
  "/api/report": {
    accepts: {
      scheme: "exact",
      network,
      asset: usdcAsset,
      payTo: PAYTO_ADDRESS,
      price: "$1.00",
      maxTimeoutSeconds: 600,
    },
    description: "Comprehensive analytics report",
    mimeType: "application/json",
  },
};

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withConfig({
    appName: "Premium Data API",
    appLogo: "https://example.com/api-logo.png",
    testnet: IS_TESTNET,
  })
  .build();

const server = new x402ResourceServer({ url: FACILITATOR_URL });
app.use(paymentMiddleware(routes, server, { testnet: IS_TESTNET }, paywall));

app.get("/", (req, res) => {
  res.json({
    name: "Premium Data API",
    endpoints: {
      "/api/weather?city=London": "$0.001 USDC - Weather data",
      "/api/article/:id": "$0.05 USDC - Premium articles",
      "/api/report": "$1.00 USDC - Full analytics report",
    },
    network: IS_TESTNET ? "Algorand Testnet" : "Algorand Mainnet",
    payTo: PAYTO_ADDRESS,
  });
});

app.get("/api/weather", (req, res) => {
  const city = req.query.city || "London";
  res.json({
    city,
    temperature: Math.round(15 + Math.random() * 20),
    humidity: Math.round(40 + Math.random() * 40),
    conditions: ["Sunny", "Cloudy", "Rainy", "Windy"][Math.floor(Math.random() * 4)],
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/article/:id", (req, res) => {
  res.json({
    id: req.params.id,
    title: "Premium Article: Advanced Algorand Development",
    content: "This is the full premium article content...",
    author: "x402-avm Team",
    publishedAt: new Date().toISOString(),
  });
});

app.get("/api/report", (req, res) => {
  res.json({
    title: "Comprehensive Analytics Report",
    generatedAt: new Date().toISOString(),
    metrics: {
      totalUsers: 15420,
      activeUsers: 8932,
      revenue: "$42,150",
      growth: "+15.3%",
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Network: ${IS_TESTNET ? "Algorand Testnet" : "Algorand Mainnet"}`);
  console.log(`Facilitator: ${FACILITATOR_URL}`);
});
```

---

## Complete Hono Multi-Network API

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { createPaywall, avmPaywall, evmPaywall } from "@x402/paywall";

const app = new Hono();
app.use("*", cors());

const routes = {
  "/api/data": {
    accepts: [
      {
        scheme: "exact",
        network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
        asset: "10458941",
        payTo: process.env.ALGO_PAYTO!,
        price: "$0.01",
        maxTimeoutSeconds: 300,
      },
      {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: process.env.EVM_PAYTO!,
        price: "$0.01",
        maxTimeoutSeconds: 30,
      },
    ],
    description: "Premium data - pay with USDC on Algorand or Base",
    mimeType: "application/json",
  },
};

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withNetwork(evmPaywall)
  .withConfig({
    appName: "Multi-Chain API",
    testnet: true,
  })
  .build();

const server = new x402ResourceServer({ url: process.env.FACILITATOR_URL! });

app.use("*", paymentMiddleware(routes, server, { testnet: true }, paywall));

app.get("/", (c) => {
  return c.json({
    name: "Multi-Chain Premium API",
    endpoints: { "/api/data": "$0.01 USDC (Algorand or Base)" },
  });
});

app.get("/api/data", (c) => {
  return c.json({
    message: "This content was unlocked with USDC payment!",
    timestamp: new Date().toISOString(),
  });
});

export default {
  port: 3000,
  fetch: app.fetch,
};
```

---

## Complete Next.js App with withX402

### app/api/premium/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { createPaywall, avmPaywall } from "@x402/paywall";

const server = new x402ResourceServer({
  url: process.env.FACILITATOR_URL!,
});

const paywall = createPaywall()
  .withNetwork(avmPaywall)
  .withConfig({
    appName: "Next.js Premium",
    appLogo: "/logo.svg",
    testnet: process.env.NODE_ENV !== "production",
  })
  .build();

const routeConfig = {
  accepts: {
    scheme: "exact",
    network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    asset: "10458941",
    payTo: process.env.PAYTO_ADDRESS!,
    price: "$0.01",
    maxTimeoutSeconds: 300,
  },
  description: "Premium AI-generated content",
  mimeType: "application/json",
};

async function handler(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const topic = searchParams.get("topic") || "Algorand";

  return NextResponse.json({
    topic,
    content: `Premium AI analysis of "${topic}"...`,
    generatedAt: new Date().toISOString(),
    model: "premium-v2",
  });
}

export const GET = withX402(
  handler,
  routeConfig,
  server,
  { testnet: process.env.NODE_ENV !== "production" },
  paywall,
);
```

### app/page.tsx

```tsx
"use client";

import { useState } from "react";

export default function Home() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function fetchPremium() {
    setLoading(true);
    try {
      const res = await fetch("/api/premium?topic=DeFi");
      if (res.ok) {
        const data = await res.json();
        setResult(JSON.stringify(data, null, 2));
      } else if (res.status === 402) {
        setResult("Payment required -- navigate to /api/premium in browser to see paywall");
      }
    } catch (err) {
      setResult(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "40px", maxWidth: "600px", margin: "auto" }}>
      <h1>x402-avm Next.js Demo</h1>
      <p>
        Visit{" "}
        <a href="/api/premium?topic=Algorand">/api/premium</a>{" "}
        in your browser to see the paywall.
      </p>
      <button onClick={fetchPremium} disabled={loading}>
        {loading ? "Loading..." : "Fetch Premium (programmatic)"}
      </button>
      {result && (
        <pre style={{ background: "#f0f0f0", padding: "16px", marginTop: "16px" }}>
          {result}
        </pre>
      )}
    </main>
  );
}
```
