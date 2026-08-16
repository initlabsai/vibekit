# @x402/next Examples

## Installation

```bash
npm install @x402/next @x402/avm @x402/core
```

For paywall UI support:

```bash
npm install @x402/next @x402/avm @x402/core @x402/paywall
```

---

## paymentProxyFromConfig

### middleware.ts

```typescript
import { NextRequest } from "next/server";
import { paymentProxyFromConfig } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const PAY_TO = process.env.PAY_TO!;

const routes = {
  "GET /api/weather": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.01",
    },
    description: "Weather data",
  },
  "GET /api/premium/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.10",
    },
    description: "Premium API endpoints",
  },
};

const facilitatorClient = new HTTPFacilitatorClient();

const proxy = paymentProxyFromConfig(routes, facilitatorClient);

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: "/api/:path*",
};
```

### app/api/weather/route.ts

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    temperature: 72,
    condition: "sunny",
    city: "San Francisco",
  });
}
```

### app/api/premium/data/route.ts

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    data: "premium content",
    tier: "gold",
  });
}
```

---

## paymentProxy

### middleware.ts

```typescript
import { NextRequest } from "next/server";
import { paymentProxy, x402ResourceServer } from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const PAY_TO = process.env.PAY_TO!;

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
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
  "POST /api/generate": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$1.00",
    },
    description: "AI content generation",
  },
};

const proxy = paymentProxy(routes, server);

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: "/api/:path*",
};
```

---

## paymentProxyFromHTTPServer

### middleware.ts

```typescript
import { NextRequest } from "next/server";
import {
  paymentProxyFromHTTPServer,
  x402ResourceServer,
  x402HTTPResourceServer,
} from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const PAY_TO = process.env.PAY_TO!;

const facilitatorClient = new HTTPFacilitatorClient();
const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register("algorand:*", new ExactAvmScheme());

const routes = {
  "GET /api/data": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.05",
    },
    description: "Protected data",
  },
};

const httpServer = new x402HTTPResourceServer(resourceServer, routes);

httpServer.onProtectedRequest(async (context, routeConfig) => {
  const authToken = context.adapter.getHeader("authorization");

  if (authToken && await verifyToken(authToken)) {
    return { grantAccess: true };
  }

  const clientIP = context.adapter.getHeader("x-forwarded-for");
  if (clientIP && isRateLimited(clientIP)) {
    return { abort: true, reason: "Rate limited" };
  }

  return undefined;
});

const proxy = paymentProxyFromHTTPServer(httpServer);

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: "/api/:path*",
};

async function verifyToken(token: string): Promise<boolean> {
  return token.startsWith("Bearer valid-");
}

function isRateLimited(ip: string): boolean {
  return false;
}
```

---

## withX402

### app/api/weather/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const facilitatorClient = new HTTPFacilitatorClient();
const server = new x402ResourceServer(facilitatorClient);
server.register("algorand:*", new ExactAvmScheme());

const routeConfig = {
  accepts: {
    scheme: "exact",
    network: ALGORAND_TESTNET_CAIP2,
    payTo: process.env.PAY_TO!,
    price: "$0.01",
  },
  description: "Weather data",
};

async function handler(request: NextRequest) {
  return NextResponse.json({
    temperature: 72,
    condition: "sunny",
    city: "San Francisco",
    timestamp: new Date().toISOString(),
  });
}

export const GET = withX402(handler, routeConfig, server);
```

---

## Shared Config Module (lib/x402.ts)

### lib/x402.ts

```typescript
import { x402ResourceServer } from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
});

export const x402Server = new x402ResourceServer(facilitatorClient);
x402Server.register("algorand:*", new ExactAvmScheme());

export const PAY_TO = process.env.PAY_TO!;
export const NETWORK = ALGORAND_TESTNET_CAIP2;
```

### app/api/weather/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, PAY_TO, NETWORK } from "@/lib/x402";

const handler = async (request: NextRequest) => {
  return NextResponse.json({
    temperature: 72,
    condition: "sunny",
  });
};

export const GET = withX402(handler, {
  accepts: {
    scheme: "exact",
    network: NETWORK,
    payTo: PAY_TO,
    price: "$0.01",
  },
  description: "Weather data",
}, x402Server);
```

### app/api/premium/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, PAY_TO, NETWORK } from "@/lib/x402";

const handler = async (request: NextRequest) => {
  return NextResponse.json({
    data: "premium content",
    tier: "gold",
  });
};

export const GET = withX402(handler, {
  accepts: {
    scheme: "exact",
    network: NETWORK,
    payTo: PAY_TO,
    price: "$0.50",
  },
  description: "Premium content",
}, x402Server);
```

### app/api/generate/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, PAY_TO, NETWORK } from "@/lib/x402";

const handler = async (request: NextRequest) => {
  const { prompt } = await request.json();

  try {
    const result = await generateContent(prompt);
    return NextResponse.json({ prompt, result });
  } catch (error) {
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 },
    );
  }
};

export const POST = withX402(handler, {
  accepts: {
    scheme: "exact",
    network: NETWORK,
    payTo: PAY_TO,
    price: "$1.00",
  },
  description: "AI generation",
}, x402Server);

async function generateContent(prompt: string): Promise<string> {
  return "Generated content...";
}
```

---

## withX402FromHTTPServer

### app/api/data/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  withX402FromHTTPServer,
  x402ResourceServer,
  x402HTTPResourceServer,
} from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const facilitatorClient = new HTTPFacilitatorClient();
const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register("algorand:*", new ExactAvmScheme());

const routeConfig = {
  accepts: {
    scheme: "exact",
    network: ALGORAND_TESTNET_CAIP2,
    payTo: process.env.PAY_TO!,
    price: "$0.05",
  },
  description: "Protected data",
};

const httpServer = new x402HTTPResourceServer(resourceServer, {
  "*": routeConfig,
});

httpServer.onProtectedRequest(async (context, config) => {
  console.log(`Payment request: ${context.method} ${context.path}`);
  return undefined;
});

const handler = async (request: NextRequest) => {
  return NextResponse.json({ data: "protected content" });
};

export const GET = withX402FromHTTPServer(handler, httpServer);
```

---

## Protected Page Route (HTML)

### middleware.ts

```typescript
import { NextRequest } from "next/server";
import { paymentProxyFromConfig } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const routes = {
  "GET /premium-article": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: process.env.PAY_TO!,
      price: "$0.25",
    },
    description: "Premium article",
    mimeType: "text/html",
  },
  "GET /api/data/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: process.env.PAY_TO!,
      price: "$0.01",
    },
    description: "Data API",
  },
};

const proxy = paymentProxyFromConfig(routes, new HTTPFacilitatorClient());

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: ["/premium-article", "/api/data/:path*"],
};
```

### app/premium-article/page.tsx

```tsx
export default function PremiumArticlePage() {
  return (
    <article>
      <h1>Premium Article</h1>
      <p>This content is only accessible after payment.</p>
      <p>Full article text here...</p>
    </article>
  );
}
```

---

## Protecting Multiple HTTP Methods

### app/api/resource/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, PAY_TO, NETWORK } from "@/lib/x402";

const routeConfig = {
  accepts: {
    scheme: "exact",
    network: NETWORK,
    payTo: PAY_TO,
    price: "$0.05",
  },
  description: "Resource CRUD",
};

const getHandler = async (request: NextRequest) => {
  return NextResponse.json({ resource: "data", method: "GET" });
};

const postHandler = async (request: NextRequest) => {
  const body = await request.json();
  return NextResponse.json({ created: true, resource: body });
};

const putHandler = async (request: NextRequest) => {
  const body = await request.json();
  return NextResponse.json({ updated: true, resource: body });
};

export const GET = withX402(getHandler, routeConfig, x402Server);
export const POST = withX402(postHandler, routeConfig, x402Server);
export const PUT = withX402(putHandler, {
  accepts: {
    scheme: "exact",
    network: NETWORK,
    payTo: PAY_TO,
    price: "$0.10",
  },
  description: "Resource update",
}, x402Server);
```

---

## Conditional Payment (Free Tier + Paid Tier)

### app/api/search/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  withX402FromHTTPServer,
  x402ResourceServer,
  x402HTTPResourceServer,
} from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const facilitatorClient = new HTTPFacilitatorClient();
const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register("algorand:*", new ExactAvmScheme());

const httpServer = new x402HTTPResourceServer(resourceServer, {
  "*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: process.env.PAY_TO!,
      price: "$0.05",
    },
    description: "Search API",
  },
});

httpServer.onProtectedRequest(async (context) => {
  const limit = context.adapter.getQueryParam("limit");
  if (limit && parseInt(limit) <= 10) {
    return { grantAccess: true };
  }
  return undefined;
});

const handler = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "100");

  const results = await performSearch(query, limit);
  return NextResponse.json({ query, results, count: results.length });
};

export const GET = withX402FromHTTPServer(handler, httpServer);

async function performSearch(query: string, limit: number) {
  return Array.from({ length: Math.min(limit, 50) }, (_, i) => ({
    id: i,
    title: `Result ${i + 1} for "${query}"`,
  }));
}
```

---

## Dynamic Routes with Payment

### middleware.ts

```typescript
import { NextRequest } from "next/server";
import { paymentProxyFromConfig } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const PAY_TO = process.env.PAY_TO!;

const routes = {
  "GET /api/users/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.01",
    },
    description: "User profile data",
  },
  "GET /api/reports/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.25",
    },
    description: "Monthly report",
  },
};

const proxy = paymentProxyFromConfig(routes, new HTTPFacilitatorClient());

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: ["/api/users/:path*", "/api/reports/:path*"],
};
```

### app/api/users/[id]/route.ts

```typescript
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await fetchUser(params.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json(user);
}

async function fetchUser(id: string) {
  return { id, name: "Alice", email: "alice@example.com" };
}
```

### app/api/reports/[year]/[month]/route.ts

```typescript
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { year: string; month: string } },
) {
  return NextResponse.json({
    year: params.year,
    month: params.month,
    data: "Monthly report data...",
  });
}
```

---

## Paywall with Proxy Pattern

### middleware.ts

```typescript
import { NextRequest } from "next/server";
import { paymentProxy, x402ResourceServer } from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const facilitatorClient = new HTTPFacilitatorClient();
const server = new x402ResourceServer(facilitatorClient);
server.register("algorand:*", new ExactAvmScheme());

const routes = {
  "GET /premium/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: process.env.PAY_TO!,
      price: "$0.25",
    },
    description: "Premium content",
    mimeType: "text/html",
  },
};

const paywallConfig = {
  title: "Premium Content",
  description: "Pay with Algorand to unlock this content",
  logoUrl: "/logo.png",
};

const proxy = paymentProxy(routes, server, paywallConfig);

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: "/premium/:path*",
};
```

---

## Custom Paywall HTML

```typescript
const routes = {
  "GET /premium/article": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: process.env.PAY_TO!,
      price: "$0.25",
    },
    description: "Premium article",
    customPaywallHtml: `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Required</title>
          <style>
            body { font-family: sans-serif; max-width: 600px; margin: 50px auto; }
            .price { font-size: 2em; color: #6366f1; }
          </style>
        </head>
        <body>
          <h1>Premium Article</h1>
          <p class="price">$0.25</p>
          <p>Pay with your Algorand wallet to read this article.</p>
          <p>Supported wallets: Pera, Defly, Kibisis</p>
        </body>
      </html>
    `,
  },
};
```

---

## Unpaid Response Body (for API Clients)

```typescript
const routes = {
  "GET /api/article/:id": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: process.env.PAY_TO!,
      price: "$0.10",
    },
    description: "Full article",
    unpaidResponseBody: (context) => ({
      contentType: "application/json",
      body: {
        title: "Article Preview",
        preview: "First paragraph of the article...",
        fullArticle: false,
        paymentRequired: {
          price: "$0.10",
          network: "Algorand Testnet",
        },
      },
    }),
  },
};
```

---

## Multiple Networks (Testnet and Mainnet)

```typescript
import {
  ALGORAND_TESTNET_CAIP2,
  ALGORAND_MAINNET_CAIP2,
} from "@x402/avm";

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
    description: "Data endpoint (testnet or mainnet)",
  },
};
```

---

## Cross-Chain: Algorand + EVM

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
    description: "Cross-chain: ALGO or ETH",
  },
};
```

---

## USDC Payments

```typescript
import {
  ALGORAND_TESTNET_CAIP2,
  USDC_TESTNET_ASA_ID,
} from "@x402/avm";

const routes = {
  "GET /api/premium": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: "YOUR_ALGORAND_ADDRESS",
      price: "$5.00",
      extra: {
        asset: USDC_TESTNET_ASA_ID,
      },
    },
    description: "Premium (USDC only)",
  },
};
```

---

## Complete App: Proxy Pattern

### Project Structure

```
my-x402-app/
  .env.local
  middleware.ts
  app/
    page.tsx
    api/
      health/route.ts
      weather/[city]/route.ts
      premium/data/route.ts
      generate/route.ts
  lib/
    x402.ts
```

### .env.local

```bash
PAY_TO=ALGORAND_ADDRESS_HERE_58_CHARS
FACILITATOR_URL=https://x402.org/facilitator
```

### lib/x402.ts

```typescript
import { x402ResourceServer } from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

export const PAY_TO = process.env.PAY_TO!;

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
});

export const x402Server = new x402ResourceServer(facilitatorClient);
x402Server.register("algorand:*", new ExactAvmScheme());
```

### middleware.ts

```typescript
import { NextRequest } from "next/server";
import { paymentProxy } from "@x402/next";
import { x402Server, PAY_TO } from "@/lib/x402";
import {
  ALGORAND_TESTNET_CAIP2,
  USDC_TESTNET_ASA_ID,
} from "@x402/avm";

const routes = {
  "GET /api/weather/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.01",
    },
    description: "Weather data",
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: { message: "Pay $0.01 for weather data" },
    }),
  },
  "GET /api/premium/*": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$0.50",
      extra: { asset: USDC_TESTNET_ASA_ID },
    },
    description: "Premium content (USDC)",
  },
  "POST /api/generate": {
    accepts: {
      scheme: "exact",
      network: ALGORAND_TESTNET_CAIP2,
      payTo: PAY_TO,
      price: "$1.00",
    },
    description: "AI generation",
  },
};

const paywallConfig = {
  title: "x402-avm Demo",
  description: "Pay with Algorand to access premium features",
};

const proxy = paymentProxy(routes, x402Server, paywallConfig);

export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: "/api/:path*",
};
```

### app/api/weather/[city]/route.ts

```typescript
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { city: string } },
) {
  return NextResponse.json({
    city: params.city,
    temperature: Math.floor(Math.random() * 40) + 50,
    condition: ["sunny", "cloudy", "rainy"][Math.floor(Math.random() * 3)],
    humidity: Math.floor(Math.random() * 60) + 30,
  });
}
```

### app/api/premium/data/route.ts

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    analytics: {
      pageViews: 15420,
      uniqueVisitors: 8734,
      bounceRate: 0.32,
    },
  });
}
```

### app/api/generate/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();
  return NextResponse.json({
    prompt,
    generated: "AI-generated content...",
    model: "gpt-4",
    tokens: 256,
  });
}
```

### app/api/health/route.ts

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "healthy" });
}
```

### app/page.tsx

```tsx
export default function Home() {
  return (
    <main>
      <h1>x402-avm Next.js Demo</h1>
      <p>API Endpoints:</p>
      <ul>
        <li>GET /api/weather/:city -- $0.01 ALGO</li>
        <li>GET /api/premium/data -- $0.50 USDC</li>
        <li>POST /api/generate -- $1.00 ALGO</li>
        <li>GET /api/health -- Free</li>
      </ul>
    </main>
  );
}
```

---

## Complete App: Route Handler Pattern

### Project Structure

```
my-x402-app/
  .env.local
  app/
    page.tsx
    api/
      health/route.ts
      weather/route.ts
      premium/route.ts
      generate/route.ts
  lib/
    x402.ts
```

### lib/x402.ts

```typescript
import { x402ResourceServer } from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

export const PAY_TO = process.env.PAY_TO!;
export const NETWORK = ALGORAND_TESTNET_CAIP2;

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
});

export const x402Server = new x402ResourceServer(facilitatorClient);
x402Server.register("algorand:*", new ExactAvmScheme());
```

### app/api/weather/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, PAY_TO, NETWORK } from "@/lib/x402";

const handler = async (request: NextRequest) => {
  const city = request.nextUrl.searchParams.get("city") || "san-francisco";
  return NextResponse.json({
    city,
    temperature: 72,
    condition: "sunny",
  });
};

export const GET = withX402(handler, {
  accepts: {
    scheme: "exact",
    network: NETWORK,
    payTo: PAY_TO,
    price: "$0.01",
  },
  description: "Weather data",
}, x402Server);
```

### app/api/premium/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, PAY_TO, NETWORK } from "@/lib/x402";
import { USDC_TESTNET_ASA_ID } from "@x402/avm";

const handler = async (request: NextRequest) => {
  return NextResponse.json({
    data: "premium content",
    analytics: { views: 15000, revenue: "$1234.56" },
  });
};

export const GET = withX402(handler, {
  accepts: {
    scheme: "exact",
    network: NETWORK,
    payTo: PAY_TO,
    price: "$0.50",
    extra: { asset: USDC_TESTNET_ASA_ID },
  },
  description: "Premium analytics (USDC)",
}, x402Server);
```

### app/api/generate/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, PAY_TO, NETWORK } from "@/lib/x402";

const handler = async (request: NextRequest) => {
  try {
    const { prompt } = await request.json();
    const result = await generateContent(prompt);
    return NextResponse.json({ prompt, result });
  } catch (error) {
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 },
    );
  }
};

export const POST = withX402(handler, {
  accepts: {
    scheme: "exact",
    network: NETWORK,
    payTo: PAY_TO,
    price: "$1.00",
  },
  description: "AI generation",
}, x402Server);

async function generateContent(prompt: string): Promise<string> {
  return "Generated content based on: " + prompt;
}
```

### app/api/health/route.ts

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "healthy" });
}
```
