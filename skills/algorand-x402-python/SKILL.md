---
name: algorand-x402-python
description: Builds x402 HTTP-native payment applications on Algorand using Python. Covers clients (httpx, requests), servers (FastAPI, Flask), facilitators, Bazaar discovery, and the x402-avm library. Use when implementing x402 payment flows in Python, creating payment-gated APIs, building x402 facilitators, or integrating the x402-avm package.
---

# x402 on Algorand - Python

Build x402 HTTP-native payment applications on Algorand with Python. Use the reference files below for detailed guidance on each component.

## Python Quick Start

The `x402-avm` package on PyPI bundles core protocol, AVM mechanism, HTTP clients, and server middleware. Pick the extras you need:

```bash
# AVM only (no HTTP client/server)
pip install "x402-avm[avm]"

# Server middleware (pick one)
pip install "x402-avm[fastapi,avm]"    # FastAPI async
pip install "x402-avm[flask,avm]"      # Flask sync

# HTTP clients (pick one)
pip install "x402-avm[httpx,avm]"      # Async with httpx
pip install "x402-avm[requests,avm]"   # Sync with requests

# Bazaar discovery extension
pip install "x402-avm[extensions,avm]"

# Everything
pip install "x402-avm[all]"
```

> Distribution name is `x402-avm` but the **import root is `x402`** (not `x402_avm`).

### Register AVM Scheme

Every component registers the AVM exact scheme unconditionally — no environment variable guards:

```python
# Client
from x402 import x402Client
from x402.mechanisms.avm.exact import ExactAvmScheme

client = x402Client()
client.register("algorand:*", ExactAvmScheme(signer=my_signer))

# Server
from x402.server import x402ResourceServer
from x402.mechanisms.avm.exact import ExactAvmServerScheme

server = x402ResourceServer()
server.register("algorand:*", ExactAvmServerScheme())

# Facilitator
from x402 import x402Facilitator
from x402.mechanisms.avm.exact import ExactAvmFacilitatorScheme

facilitator = x402Facilitator()
facilitator.register("algorand:*", ExactAvmFacilitatorScheme(signer=my_signer))
```

The `register_exact_avm_client/server/facilitator` helpers from `x402.mechanisms.avm.exact` are also valid.

### Python algosdk Encoding

Python algosdk's `msgpack_decode()` expects base64 strings, `msgpack_encode()` returns base64 strings. Boundary conversion: `msgpack_decode(base64.b64encode(raw_bytes).decode())` / `base64.b64decode(msgpack_encode(obj))`.

## Reference Guide

Navigate to the appropriate reference based on your task. Each topic has three files:
- **`{name}.md`** — Step-by-step implementation guide
- **`{name}-reference.md`** — API details and type signatures
- **`{name}-examples.md`** — Complete, runnable code samples

### Explaining x402 for Python

Understand the `x402-avm` Python package structure, extras installation (`[avm]`, `[fastapi]`, `[flask]`, `[httpx]`, `[requests]`, `[extensions]`, `[all]`), signer protocols, async vs sync variants, and algosdk encoding boundaries.

- [explain-algorand-x402-python.md](./references/explain-algorand-x402-python.md) — Package ecosystem explanation
- [explain-algorand-x402-python-reference.md](./references/explain-algorand-x402-python-reference.md) — API reference for the x402-avm package
- [explain-algorand-x402-python-examples.md](./references/explain-algorand-x402-python-examples.md) — Python pattern examples

### Building Clients

Build HTTP clients with httpx (async) or requests (sync) that automatically handle 402 payments. Covers wrapHttpxWithPayment, wrapRequestsWithPayment, ClientAvmSigner for payment signing.

- [create-python-x402-client.md](./references/create-python-x402-client.md) — Client creation guide
- [create-python-x402-client-reference.md](./references/create-python-x402-client-reference.md) — httpx/requests API reference
- [create-python-x402-client-examples.md](./references/create-python-x402-client-examples.md) — Client code examples

### Building Servers

Build payment-protected servers with FastAPI (async) or Flask (sync) middleware. Covers route pricing, PaymentMiddlewareASGI, Flask PaymentMiddleware, and multi-network support.

- [create-python-x402-server.md](./references/create-python-x402-server.md) — Server creation guide
- [create-python-x402-server-reference.md](./references/create-python-x402-server-reference.md) — FastAPI/Flask middleware API reference
- [create-python-x402-server-examples.md](./references/create-python-x402-server-examples.md) — Server code examples

### Building Facilitators and Bazaar Discovery

Build facilitator services that verify and settle Algorand payments on-chain. Covers FacilitatorAvmSigner protocol, register_exact_avm_facilitator, FastAPI facilitator endpoints (/verify, /settle, /supported), and Bazaar discovery extension for automatic cataloging and indexing of payment-gated APIs (declare_discovery_extension, extract_discovery_info, bazaar_resource_server_extension).

- [create-python-x402-facilitator.md](./references/create-python-x402-facilitator.md) — Facilitator creation guide (includes Bazaar setup in Steps 6-10)
- [create-python-x402-facilitator-reference.md](./references/create-python-x402-facilitator-reference.md) — Facilitator + Bazaar API reference
- [create-python-x402-facilitator-examples.md](./references/create-python-x402-facilitator-examples.md) — Facilitator + Bazaar code examples

### Low-Level SDK Usage

Use x402-avm core components and AVM mechanism directly for custom integrations. Covers x402Client, x402ResourceServer, x402Facilitator, AVM signer protocols, constants, utilities, transaction encoding, and fee abstraction.

- [use-python-x402-core-avm.md](./references/use-python-x402-core-avm.md) — Core SDK usage guide
- [use-python-x402-core-avm-reference.md](./references/use-python-x402-core-avm-reference.md) — Core/AVM API reference
- [use-python-x402-core-avm-examples.md](./references/use-python-x402-core-avm-examples.md) — Core SDK code examples

## Python Package Quick Reference

One PyPI distribution (`x402-avm`) provides everything via extras. Import root is `x402`.

| Install spec | Purpose |
| ------------ | ------- |
| `x402-avm[avm]` | Core protocol + Algorand SDK (py-algorand-sdk) |
| `x402-avm[httpx,avm]` | Async HTTP client wrapper (httpx) with automatic 402 payment handling |
| `x402-avm[requests,avm]` | Sync HTTP client wrapper (requests) with automatic 402 payment handling |
| `x402-avm[fastapi,avm]` | FastAPI async payment middleware |
| `x402-avm[flask,avm]` | Flask sync payment middleware |
| `x402-avm[extensions,avm]` | Bazaar discovery extension |
| `x402-avm[all]` | All extras (EVM, SVM, AVM, all servers and clients, extensions) |

## How to Use This Skill

1. **Start here** to understand which reference you need
2. **Read the `{name}.md`** file for step-by-step implementation guidance
3. **Consult `{name}-reference.md`** for API details
4. **Use `{name}-examples.md`** for complete, runnable code samples
