---
name: algorand-x402-typescript
description: Builds x402 HTTP-native payment applications on Algorand using TypeScript. Covers clients (fetch, axios), servers (Express, Hono), facilitators, paywalls, Next.js integration, and the @x402/core library. Use when implementing x402 payment flows in TypeScript, creating payment-gated APIs, building x402 facilitators or paywalls, or integrating @x402/* packages.
---

# x402 on Algorand - TypeScript

Build x402 HTTP-native payment applications on Algorand with TypeScript. Use the reference files below for detailed guidance on each component.

## TypeScript Quick Start

```bash
# Core + AVM mechanism + key/signer helpers from algokit-utils
npm install @x402/core @x402/avm @algorandfoundation/algokit-utils

# Server middleware (pick one)
npm install @x402/express    # Express.js
npm install @x402/hono       # Hono
npm install @x402/next       # Next.js

# HTTP clients (pick one)
npm install @x402/fetch      # Fetch API (re-exports x402Client, wrapFetchWithPayment)
npm install @x402/axios      # Axios   (re-exports x402Client, wrapAxiosWithPayment)

# Optional: only needed for custom/manual signers (e.g., browser wallet flows)
npm install algosdk
```

### Register AVM Scheme

Every component registers the AVM exact scheme unconditionally — no environment variable guards:

Every AVM scheme is the same class — `ExactAvmScheme` — exported from three subpaths (each implementing a different `SchemeNetwork*` interface).

```typescript
// Client (x402Client is also re-exported from @x402/fetch and @x402/axios)
import { x402Client } from "@x402/core/client";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { toClientAvmSigner, ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const avmSigner = toClientAvmSigner(secretKey);
const client = new x402Client()
  .register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(avmSigner));

// Server (x402ResourceServer is also re-exported from @x402/hono, @x402/express, @x402/next)
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const server = new x402ResourceServer(facilitatorClient)
  .register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme());

// Facilitator
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactAvmScheme } from "@x402/avm/exact/facilitator";
import { toFacilitatorAvmSigner, ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const avmSigner = toFacilitatorAvmSigner(secretKey);
const facilitator = new x402Facilitator()
  .register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(avmSigner));
```

The `register` builder also accepts a glob pattern (e.g. `"algorand:*"`) when you want one scheme to handle all Algorand networks. Use the exported CAIP-2 constants (`ALGORAND_TESTNET_CAIP2`, `ALGORAND_MAINNET_CAIP2`) when targeting a single network.

### TypeScript algosdk Encoding

TypeScript algosdk works with raw `Uint8Array` directly — no conversion needed. This matches the `@txnlab/use-wallet` ecosystem standard. Encoding/decoding to/from base64 happens only at protocol boundaries (PAYMENT-SIGNATURE header serialization).

## Reference Guide

Navigate to the appropriate reference based on your task. Each topic has three files:
- **`{name}.md`** — Step-by-step implementation guide
- **`{name}-reference.md`** — API details and type signatures
- **`{name}-examples.md`** — Complete, runnable code samples

### Explaining x402 for TypeScript

Understand @x402/* TypeScript package structure, signer interfaces (ClientAvmSigner, FacilitatorAvmSigner), registration patterns, builder patterns, constants, and utilities.

- [explain-algorand-x402-typescript.md](./references/explain-algorand-x402-typescript.md) — Package ecosystem explanation
- [explain-algorand-x402-typescript-reference.md](./references/explain-algorand-x402-typescript-reference.md) — API reference for @x402/* packages
- [explain-algorand-x402-typescript-examples.md](./references/explain-algorand-x402-typescript-examples.md) — TypeScript pattern examples

### Building Clients

Build HTTP clients with @x402/fetch or @x402/axios that automatically handle 402 payments. Covers wrapFetchWithPayment, wrapAxiosWithPayment, ClientAvmSigner for browser wallets or Node.js private keys.

- [create-typescript-x402-client.md](./references/create-typescript-x402-client.md) — Client creation guide
- [create-typescript-x402-client-reference.md](./references/create-typescript-x402-client-reference.md) — Fetch/Axios API reference
- [create-typescript-x402-client-examples.md](./references/create-typescript-x402-client-examples.md) — Client code examples

### Building Servers

Build payment-protected servers with @x402/express or @x402/hono middleware. Covers route pricing, multi-network support (AVM+EVM+SVM), 402 responses, and dynamic pricing.

- [create-typescript-x402-server.md](./references/create-typescript-x402-server.md) — Server creation guide
- [create-typescript-x402-server-reference.md](./references/create-typescript-x402-server-reference.md) — Express/Hono middleware API reference
- [create-typescript-x402-server-examples.md](./references/create-typescript-x402-server-examples.md) — Server code examples

### Building Next.js Apps

Build fullstack Next.js apps with @x402/next payment protection using paymentProxy and withX402. Covers App Router integration, middleware-level protection, and per-endpoint control.

- [create-typescript-x402-nextjs.md](./references/create-typescript-x402-nextjs.md) — Next.js integration guide
- [create-typescript-x402-nextjs-reference.md](./references/create-typescript-x402-nextjs-reference.md) — Next.js API reference
- [create-typescript-x402-nextjs-examples.md](./references/create-typescript-x402-nextjs-examples.md) — Next.js code examples

### Building Facilitators and Bazaar Discovery

Build facilitator services that verify and settle Algorand payments on-chain with @x402/avm. Covers FacilitatorAvmSigner, Express.js facilitator servers, and Bazaar discovery extension for API cataloging (bazaarResourceServerExtension, withBazaar, declare_discovery_extension on servers).

- [create-typescript-x402-facilitator.md](./references/create-typescript-x402-facilitator.md) — Facilitator creation guide (includes Bazaar setup in Step 5)
- [create-typescript-x402-facilitator-reference.md](./references/create-typescript-x402-facilitator-reference.md) — Facilitator + Bazaar API reference
- [create-typescript-x402-facilitator-examples.md](./references/create-typescript-x402-facilitator-examples.md) — Facilitator + Bazaar code examples

### Building Paywalls

Build browser paywall UIs with server-side middleware and client-side wallet integration (Pera, Defly, Lute) using @x402/avm. Covers PaywallBuilder, avmPaywall, multi-network paywalls.

- [create-typescript-x402-paywall.md](./references/create-typescript-x402-paywall.md) — Paywall creation guide
- [create-typescript-x402-paywall-reference.md](./references/create-typescript-x402-paywall-reference.md) — Paywall API reference
- [create-typescript-x402-paywall-examples.md](./references/create-typescript-x402-paywall-examples.md) — Paywall code examples

### Low-Level SDK Usage

Use @x402/core and @x402/avm packages directly for custom integrations. Covers payment policies, AVM signer interfaces, transaction groups, fee abstraction, and low-level primitives.

- [use-typescript-x402-core-avm.md](./references/use-typescript-x402-core-avm.md) — Core SDK usage guide
- [use-typescript-x402-core-avm-reference.md](./references/use-typescript-x402-core-avm-reference.md) — Core/AVM API reference
- [use-typescript-x402-core-avm-examples.md](./references/use-typescript-x402-core-avm-examples.md) — Core SDK code examples

## TypeScript Package Quick Reference

| Package | Purpose |
| ------- | ------- |
| `@x402/core` | Core protocol types and client/server/facilitator implementations |
| `@x402/avm` | Algorand Virtual Machine implementation with signers and transaction builders |
| `@x402/fetch` | HTTP Fetch wrapper with automatic 402 payment handling |
| `@x402/axios` | Axios wrapper with automatic 402 payment handling |
| `@x402/express` | Express.js payment middleware |
| `@x402/hono` | Hono payment middleware |
| `@x402/next` | Next.js payment middleware and route wrappers |
| `@x402/paywall` | Browser paywall UI builder for HTML 402 responses |
| `@x402/extensions` | Optional protocol extensions (e.g. Bazaar discovery, offer/receipt) |
| `@algorandfoundation/algokit-utils` | Mnemonic → ed25519 key derivation used by `toClientAvmSigner` / `toFacilitatorAvmSigner` |
| `algosdk` | Only required for custom/manual signer construction (browser wallets, advanced flows) |

## How to Use This Skill

1. **Start here** to understand which reference you need
2. **Read the `{name}.md`** file for step-by-step implementation guidance
3. **Consult `{name}-reference.md`** for API details
4. **Use `{name}-examples.md`** for complete, runnable code samples
