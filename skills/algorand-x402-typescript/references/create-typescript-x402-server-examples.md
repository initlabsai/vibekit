# x402-avm Server Examples

## Express Quick Start (paymentMiddlewareFromConfig)

```typescript
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { x402ResourceServer } from "@x402/core/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const app = express();

const routes = {
  "GET /api/weather": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "ALGORAND_ADDRESS_HERE_58_CHARS_AAAAAAAAAAAAAAAAAAAAAAAAAA",
      price: "$0.01",
    },
    description: "Current weather data",
  },
};

const facilitatorClient = new HTTPFacilitatorClient();
const server = new x402ResourceServer(facilitatorClient);
server.register("algorand:*", new ExactAvmScheme());

app.use(
  paymentMiddlewareFromConfig(
    routes,
    facilitatorClient,
    [{ network: "algorand:*", server: server }],
  ),
);

app.get("/api/weather", (req, res) => {
  res.json({ temperature: 72, condition: "sunny", city: "San Francisco" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(4021, () => {
  console.log("Resource server running on http://localhost:4021");
});
```

## Express with x402ResourceServer (paymentMiddleware)

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const app = express();

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator",
});
const server = new x402ResourceServer(facilitatorClient);
server.register("algorand:*", new ExactAvmScheme());

const routes = {
  "GET /api/premium/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "ALGORAND_ADDRESS_HERE_58_CHARS_AAAAAAAAAAAAAAAAAAAAAAAAAA",
      price: "$0.10",
    },
    description: "Premium API access",
  },
  "POST /api/generate": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "ALGORAND_ADDRESS_HERE_58_CHARS_AAAAAAAAAAAAAAAAAAAAAAAAAA",
      price: "$0.50",
    },
    description: "AI content generation",
  },
};

app.use(paymentMiddleware(routes, server));

app.get("/api/premium/data", (req, res) => {
  res.json({ data: "premium content" });
});

app.post("/api/generate", express.json(), (req, res) => {
  res.json({ generated: "AI-generated content based on your prompt" });
});

app.listen(4021);
```

## Express with HTTPServer Hooks (paymentMiddlewareFromHTTPServer)

```typescript
import express from "express";
import {
  paymentMiddlewareFromHTTPServer,
  x402ResourceServer,
  x402HTTPResourceServer,
} from "@x402/express";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const app = express();

const facilitatorClient = new HTTPFacilitatorClient();
const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register("algorand:*", new ExactAvmScheme());

const routes = {
  "GET /api/data": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "ALGORAND_ADDRESS_HERE_58_CHARS_AAAAAAAAAAAAAAAAAAAAAAAAAA",
      price: "$0.05",
    },
    description: "Protected data endpoint",
  },
};

const httpServer = new x402HTTPResourceServer(resourceServer, routes);

httpServer.onProtectedRequest(async (context, routeConfig) => {
  const apiKey = context.adapter.getHeader("x-api-key");
  if (apiKey && apiKey === process.env.API_KEY) {
    return { grantAccess: true };
  }
  return undefined;
});

app.use(paymentMiddlewareFromHTTPServer(httpServer));

app.get("/api/data", (req, res) => {
  res.json({ data: "protected content" });
});

app.listen(4021);
```

## Algorand ALGO Native Token Route

```typescript
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const routes = {
  "GET /api/data": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "ALGORAND_ADDRESS_HERE_58_CHARS_AAAAAAAAAAAAAAAAAAAAAAAAAA",
      price: "$0.01",
    },
    description: "Data endpoint paid in ALGO",
  },
};
```

## Algorand USDC (ASA) Route

```typescript
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

const routes = {
  "GET /api/premium": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "ALGORAND_ADDRESS_HERE_58_CHARS_AAAAAAAAAAAAAAAAAAAAAAAAAA",
      price: "$0.50",
      extra: {
        asset: USDC_TESTNET_ASA_ID,
      },
    },
    description: "Premium endpoint paid in USDC",
  },
};
```

## Multi-Network Route (Testnet + Mainnet)

```typescript
import { ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2 } from "@x402/avm";

const routes = {
  "GET /api/data": {
    accepts: [
      {
        scheme: "exact",
        network: ALGORAND_TESTNET_CAIP2,
        payTo: "YOUR_TESTNET_ADDRESS",
        price: "$0.01",
      },
      {
        scheme: "exact",
        network: ALGORAND_MAINNET_CAIP2,
        payTo: "YOUR_MAINNET_ADDRESS",
        price: "$0.01",
      },
    ],
    description: "Accepts payment on testnet or mainnet",
  },
};
```

## Cross-Chain Route (Algorand + EVM)

```typescript
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const routes = {
  "GET /api/data": {
    accepts: [
      {
        scheme: "exact",
        network: ALGORAND_TESTNET_CAIP2,
        payTo: "YOUR_ALGORAND_ADDRESS",
        price: "$0.01",
      },
      {
        scheme: "exact",
        network: "eip155:84532",
        payTo: "0xYourEvmAddress",
        price: "$0.01",
      },
    ],
    description: "Cross-chain: pay with ALGO or ETH",
  },
};
```

## Dynamic Pricing

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const app = express();
const facilitatorClient = new HTTPFacilitatorClient();
const server = new x402ResourceServer(facilitatorClient);
server.register("algorand:*", new ExactAvmScheme());

const routes = {
  "GET /api/ai/generate": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "YOUR_ALGORAND_ADDRESS",
      price: (context) => {
        const model = context.adapter.getQueryParam("model") || "basic";
        switch (model) {
          case "gpt4": return "$0.50";
          case "gpt3": return "$0.10";
          default: return "$0.01";
        }
      },
    },
    description: "AI generation with model-based pricing",
  },
  "POST /api/image/resize": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "YOUR_ALGORAND_ADDRESS",
      price: (context) => {
        const body = context.adapter.getBody();
        const width = body?.width || 256;
        if (width > 2048) return "$0.25";
        if (width > 1024) return "$0.10";
        return "$0.05";
      },
    },
    description: "Image resize with size-based pricing",
  },
};

app.use(paymentMiddleware(routes, server));

app.get("/api/ai/generate", (req, res) => {
  res.json({ model: req.query.model || "basic", result: "Generated content..." });
});

app.post("/api/image/resize", express.json(), (req, res) => {
  res.json({ resized: true, width: req.body.width });
});

app.listen(4021);
```

## Multiple Routes with Different Prices

```typescript
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

const app = express();
const PAY_TO = "YOUR_ALGORAND_ADDRESS";
const facilitatorClient = new HTTPFacilitatorClient();

const routes = {
  "GET /api/lookup/:id": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.001",
    },
    description: "Simple data lookup",
  },
  "GET /api/analytics/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.05",
    },
    description: "Analytics dashboard data",
  },
  "POST /api/generate": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$1.00",
    },
    description: "AI content generation",
  },
  "GET /api/subscription/status": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$5.00",
      extra: { asset: USDC_TESTNET_ASA_ID },
    },
    description: "Monthly subscription verification",
  },
};

app.use(paymentMiddlewareFromConfig(routes, facilitatorClient));

app.get("/api/lookup/:id", (req, res) => {
  res.json({ id: req.params.id, data: "lookup result" });
});

app.get("/api/analytics/*", (req, res) => {
  res.json({ analytics: "dashboard data" });
});

app.post("/api/generate", express.json(), (req, res) => {
  res.json({ generated: "content" });
});

app.get("/api/subscription/status", (req, res) => {
  res.json({ active: true, expiresAt: "2026-03-01" });
});

app.get("/", (req, res) => {
  res.json({ message: "Welcome! See /api/* for paid endpoints." });
});

app.listen(4021);
```

## Fee Abstraction Setup

```typescript
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const app = express();

const routes = {
  "GET /api/premium": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "YOUR_RESOURCE_SERVER_ADDRESS",
      price: "$0.10",
      extra: {
        feePayer: "FACILITATOR_FEE_PAYER_ADDRESS",
      },
    },
    description: "Fee-abstracted premium endpoint",
  },
};

const facilitatorClient = new HTTPFacilitatorClient({
  url: "http://localhost:4020",
});

app.use(paymentMiddlewareFromConfig(routes, facilitatorClient));

app.get("/api/premium", (req, res) => {
  res.json({ premium: true, data: "Fee-abstracted content" });
});

app.listen(4021);
```

## Express Facilitator Server

```typescript
import express from "express";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import type { FacilitatorAvmSigner } from "@x402/avm";
import algosdk from "algosdk";

const app = express();
app.use(express.json());

const privateKeyBytes = Buffer.from(process.env.AVM_PRIVATE_KEY!, "base64");
const address = algosdk.encodeAddress(privateKeyBytes.slice(32));
const algodClient = new algosdk.Algodv2(
  process.env.ALGOD_TOKEN || "",
  process.env.ALGOD_SERVER || "https://testnet-api.algonode.cloud",
  "",
);

const signer: FacilitatorAvmSigner = {
  address,
  async getAlgodClient(network: string) { return algodClient; },
  async signGroupTransactions(groupTxnBytes: Uint8Array[], myIndices: number[]) {
    const result = [...groupTxnBytes];
    for (const idx of myIndices) {
      const txn = algosdk.decodeUnsignedTransaction(groupTxnBytes[idx]);
      result[idx] = txn.signTxn(privateKeyBytes);
    }
    return result;
  },
  async sendGroup(signedGroupBytes: Uint8Array[]) {
    const combined = new Uint8Array(
      signedGroupBytes.reduce((acc, b) => acc + b.length, 0),
    );
    let offset = 0;
    for (const bytes of signedGroupBytes) {
      combined.set(bytes, offset);
      offset += bytes.length;
    }
    const { txId } = await algodClient.sendRawTransaction(combined).do();
    return txId;
  },
  async simulateGroup(groupTxnBytes: Uint8Array[]) {
    const txns = groupTxnBytes.map((bytes) => {
      try { return algosdk.decodeSignedTransaction(bytes); }
      catch {
        const unsigned = algosdk.decodeUnsignedTransaction(bytes);
        return new algosdk.SignedTransaction(unsigned);
      }
    });
    const request = new algosdk.modelsv2.SimulateRequest({
      txnGroups: [
        new algosdk.modelsv2.SimulateRequestTransactionGroup({
          txns: txns.map((t) => algosdk.decodeObj(algosdk.encodeMsgpack(t))),
        }),
      ],
      allowEmptySignatures: true,
    });
    return algodClient.simulateTransactions(request).do();
  },
};

const facilitator = new x402Facilitator();
facilitator.register("algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=", new ExactAvmScheme(signer));

app.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/supported", (req, res) => {
  res.json(facilitator.getSupported());
});

app.listen(4020);
```

## Hono Quick Start

```typescript
import { Hono } from "hono";
import { paymentMiddlewareFromConfig } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const app = new Hono();

const routes = {
  "GET /api/weather": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "ALGORAND_ADDRESS_HERE_58_CHARS_AAAAAAAAAAAAAAAAAAAAAAAAAA",
      price: "$0.01",
    },
    description: "Current weather data",
  },
};

const facilitatorClient = new HTTPFacilitatorClient();
app.use(paymentMiddlewareFromConfig(routes, facilitatorClient));

app.get("/api/weather", (c) => {
  return c.json({ temperature: 72, condition: "sunny", city: "San Francisco" });
});

app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

export default app;
```

## Hono with Node.js Server

```typescript
import { serve } from "@hono/node-server";

serve({
  fetch: app.fetch,
  port: 4021,
}, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});
```

## Hono with Bun

```typescript
export default {
  port: 4021,
  fetch: app.fetch,
};
```

## Hono with Deno

```typescript
Deno.serve({ port: 4021 }, app.fetch);
```

## Hono Multiple Protected Routes

```typescript
import { Hono } from "hono";
import { paymentMiddlewareFromConfig } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

const app = new Hono();
const PAY_TO = "YOUR_ALGORAND_ADDRESS";
const facilitatorClient = new HTTPFacilitatorClient();

const routes = {
  "GET /api/lookup/:id": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.001",
    },
    description: "Simple data lookup",
  },
  "GET /api/analytics/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.05",
    },
    description: "Analytics data",
  },
  "POST /api/generate": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$1.00",
    },
    description: "AI content generation",
  },
  "GET /api/report/full": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$10.00",
      extra: { asset: USDC_TESTNET_ASA_ID },
    },
    description: "Full analytics report (USDC)",
  },
};

app.use(paymentMiddlewareFromConfig(routes, facilitatorClient));

app.get("/api/lookup/:id", (c) => {
  return c.json({ id: c.req.param("id"), data: "lookup result" });
});

app.get("/api/analytics/*", (c) => {
  return c.json({ pageViews: 15420, uniqueVisitors: 8734 });
});

app.post("/api/generate", async (c) => {
  const body = await c.req.json();
  return c.json({ prompt: body.prompt, result: "Generated content" });
});

app.get("/api/report/full", (c) => {
  return c.json({ report: "Comprehensive analytics report..." });
});

app.get("/", (c) => {
  return c.json({
    name: "x402-avm Hono API",
    endpoints: {
      lookup: "GET /api/lookup/:id ($0.001)",
      analytics: "GET /api/analytics/* ($0.05)",
      generate: "POST /api/generate ($1.00)",
      report: "GET /api/report/full ($10.00 USDC)",
    },
  });
});

export default app;
```

## Hono Cloudflare Workers

### wrangler.toml

```toml
name = "x402-avm-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[vars]
PAY_TO = "YOUR_ALGORAND_ADDRESS"
FACILITATOR_URL = "https://x402.org/facilitator"
```

### src/index.ts

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { paymentMiddlewareFromConfig } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

type Bindings = {
  PAY_TO: string;
  FACILITATOR_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();
app.use("*", cors());

app.use("*", async (c, next) => {
  const routes = {
    "GET /api/data": {
      accepts: {
        scheme: "exact",
        network: ALGORAND_TESTNET_CAIP2,
        payTo: c.env.PAY_TO,
        price: "$0.01",
      },
      description: "Edge data endpoint",
    },
  };

  const facilitatorClient = new HTTPFacilitatorClient({
    url: c.env.FACILITATOR_URL,
  });

  const middleware = paymentMiddlewareFromConfig(
    routes,
    facilitatorClient,
    undefined,
    undefined,
    undefined,
    false,
  );

  return middleware(c, next);
});

app.get("/api/data", (c) => {
  return c.json({
    data: "Edge-served paid content",
    region: c.req.header("cf-ipcountry") || "unknown",
  });
});

app.get("/", (c) => {
  return c.json({ name: "x402-avm Edge API", runtime: "Cloudflare Workers" });
});

export default app;
```

## Hono Facilitator Server

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import algosdk from "algosdk";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import type { FacilitatorAvmSigner } from "@x402/avm";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const app = new Hono();
app.use("*", cors());

const privateKeyBytes = Buffer.from(process.env.AVM_PRIVATE_KEY!, "base64");
const facilitatorAddress = algosdk.encodeAddress(privateKeyBytes.slice(32));
const algodClient = new algosdk.Algodv2(
  process.env.ALGOD_TOKEN || "",
  process.env.ALGOD_SERVER || "https://testnet-api.algonode.cloud",
  "",
);

const signer: FacilitatorAvmSigner = {
  address: facilitatorAddress,
  async getAlgodClient(_network: string) { return algodClient; },
  async signGroupTransactions(groupTxnBytes: Uint8Array[], myIndices: number[]) {
    const result = [...groupTxnBytes];
    for (const idx of myIndices) {
      const txn = algosdk.decodeUnsignedTransaction(groupTxnBytes[idx]);
      result[idx] = txn.signTxn(privateKeyBytes);
    }
    return result;
  },
  async sendGroup(signedGroupBytes: Uint8Array[]) {
    const combined = new Uint8Array(
      signedGroupBytes.reduce((acc, b) => acc + b.length, 0),
    );
    let offset = 0;
    for (const bytes of signedGroupBytes) {
      combined.set(bytes, offset);
      offset += bytes.length;
    }
    const { txId } = await algodClient.sendRawTransaction(combined).do();
    return txId;
  },
  async simulateGroup(groupTxnBytes: Uint8Array[]) {
    const txns = groupTxnBytes.map((bytes) => {
      try { return algosdk.decodeSignedTransaction(bytes); }
      catch {
        const unsigned = algosdk.decodeUnsignedTransaction(bytes);
        return new algosdk.SignedTransaction(unsigned);
      }
    });
    const request = new algosdk.modelsv2.SimulateRequest({
      txnGroups: [
        new algosdk.modelsv2.SimulateRequestTransactionGroup({
          txns: txns.map((t) => algosdk.decodeObj(algosdk.encodeMsgpack(t))),
        }),
      ],
      allowEmptySignatures: true,
    });
    return algodClient.simulateTransactions(request).do();
  },
};

const facilitator = new x402Facilitator();
facilitator.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer));

app.post("/verify", async (c) => {
  try {
    const { paymentPayload, paymentRequirements } = await c.req.json();
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/settle", async (c) => {
  try {
    const { paymentPayload, paymentRequirements } = await c.req.json();
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/supported", (c) => {
  return c.json(facilitator.getSupported());
});

app.get("/", (c) => {
  return c.json({
    name: "x402-avm Facilitator",
    address: facilitatorAddress,
    networks: [ALGORAND_TESTNET_CAIP2],
  });
});

serve({ fetch: app.fetch, port: 4020 }, (info) => {
  console.log(`Facilitator running on http://localhost:${info.port}`);
  console.log(`Address: ${facilitatorAddress}`);
});
```

## Paywall Integration (Express)

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const app = express();
const facilitatorClient = new HTTPFacilitatorClient();
const server = new x402ResourceServer(facilitatorClient);
server.register("algorand:*", new ExactAvmScheme());

const routes = {
  "GET /premium-article": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "YOUR_ALGORAND_ADDRESS",
      price: "$0.25",
    },
    description: "Premium article access",
    mimeType: "text/html",
  },
};

const paywallConfig = {
  title: "Premium Content",
  description: "Pay to access this article",
  logoUrl: "https://example.com/logo.png",
  theme: {
    primaryColor: "#6366f1",
    backgroundColor: "#ffffff",
  },
};

app.use(paymentMiddleware(routes, server, paywallConfig));

app.get("/premium-article", (req, res) => {
  res.send("<html><body><h1>Premium Article</h1><p>Full content here.</p></body></html>");
});

app.listen(4021);
```

## Custom Paywall HTML

```typescript
const routes = {
  "GET /premium": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "YOUR_ALGORAND_ADDRESS",
      price: "$0.10",
    },
    description: "Premium content",
    customPaywallHtml: `
      <html>
        <head><title>Payment Required</title></head>
        <body>
          <h1>Payment Required</h1>
          <p>Please pay $0.10 in ALGO to access this content.</p>
        </body>
      </html>
    `,
  },
};
```

## Unpaid Response Body (API Preview)

```typescript
const routes = {
  "GET /api/article/:id": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "YOUR_ALGORAND_ADDRESS",
      price: "$0.10",
    },
    description: "Full article",
    unpaidResponseBody: (context) => ({
      contentType: "application/json",
      body: {
        title: "Article Title",
        preview: "First paragraph of the article...",
        message: "Pay $0.10 to read the full article",
      },
    }),
  },
};
```

## Complete Express Application

```typescript
import express from "express";
import dotenv from "dotenv";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

dotenv.config();

const app = express();
app.use(express.json());

const PAY_TO = process.env.RESOURCE_PAY_TO!;
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz";

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const server = new x402ResourceServer(facilitatorClient);
server.register("algorand:*", new ExactAvmScheme());

const routes = {
  "GET /api/weather/:city": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.01",
    },
    description: "Weather data for a city",
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        message: "Pay $0.01 to get weather data",
        availableCities: ["san-francisco", "new-york", "london"],
      },
    }),
  },
  "GET /api/analytics/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.50",
      extra: { asset: USDC_TESTNET_ASA_ID },
    },
    description: "Analytics data (USDC only)",
  },
  "POST /api/ai/generate": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$1.00",
    },
    description: "AI content generation",
  },
};

app.use(paymentMiddleware(routes, server));

app.get("/api/weather/:city", (req, res) => {
  res.json({
    city: req.params.city,
    temperature: Math.floor(Math.random() * 40) + 50,
    condition: ["sunny", "cloudy", "rainy"][Math.floor(Math.random() * 3)],
  });
});

app.get("/api/analytics/*", (req, res) => {
  res.json({ pageViews: 15420, uniqueVisitors: 8734, bounceRate: 0.32 });
});

app.post("/api/ai/generate", (req, res) => {
  res.json({ prompt: req.body.prompt, generated: "AI-generated response..." });
});

app.get("/", (req, res) => {
  res.json({
    name: "x402-avm Demo API",
    endpoints: {
      weather: "GET /api/weather/:city ($0.01 ALGO)",
      analytics: "GET /api/analytics/* ($0.50 USDC)",
      generate: "POST /api/ai/generate ($1.00 ALGO)",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", uptime: process.uptime() });
});

const PORT = parseInt(process.env.PORT || "4021");
app.listen(PORT, () => {
  console.log(`Resource server: http://localhost:${PORT}`);
  console.log(`Facilitator:     ${FACILITATOR_URL}`);
  console.log(`Pay-to address:  ${PAY_TO}`);
});
```

## Complete Hono Application (Node.js)

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from "@x402/avm";

const app = new Hono();
app.use("*", cors());
app.use("*", logger());

const PAY_TO = process.env.PAY_TO || "YOUR_ALGORAND_ADDRESS";
const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz",
});

const server = new x402ResourceServer(facilitatorClient);
server.register("algorand:*", new ExactAvmScheme());

const routes = {
  "GET /api/weather/:city": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.01",
    },
    description: "City weather data",
  },
  "GET /api/analytics/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.50",
      extra: { asset: USDC_TESTNET_ASA_ID },
    },
    description: "Analytics (USDC)",
  },
  "POST /api/ai/generate": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$1.00",
    },
    description: "AI generation",
  },
};

app.use(paymentMiddleware(routes, server));

app.get("/api/weather/:city", (c) => {
  return c.json({
    city: c.req.param("city"),
    temperature: Math.floor(Math.random() * 40) + 50,
    condition: ["sunny", "cloudy", "rainy"][Math.floor(Math.random() * 3)],
  });
});

app.get("/api/analytics/*", (c) => {
  return c.json({ pageViews: 15420, uniqueVisitors: 8734, bounceRate: 0.32 });
});

app.post("/api/ai/generate", async (c) => {
  const { prompt } = await c.req.json();
  return c.json({ prompt, generated: "AI-generated response...", tokens: 256 });
});

app.get("/", (c) => {
  return c.json({
    name: "x402-avm Hono Demo",
    version: "2.0.0",
    endpoints: {
      weather: "GET /api/weather/:city ($0.01 ALGO)",
      analytics: "GET /api/analytics/* ($0.50 USDC)",
      generate: "POST /api/ai/generate ($1.00 ALGO)",
    },
  });
});

app.get("/api/health", (c) => c.json({ status: "healthy" }));

const port = parseInt(process.env.PORT || "4021");
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`x402-avm Hono server: http://localhost:${info.port}`);
});
```
