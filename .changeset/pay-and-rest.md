---
'@initlabs/vibekit': minor
---

`@initlabs/vibekit/pay`: `createPaywall` — an x402 payment in USDC becomes credit on a store you supply, and `charge` takes a turn (free by IP, then paid by bearer token) or answers 402; `createX402Gate` is the web-standard gate underneath, mounting in Next, Bun, Hono, or Workers unchanged. `@initlabs/vibekit/rest`: `createQueryHandler` — `POST …/query/<tool>` over the tool contract, plus a JSON Schema catalogue. Both are optional peers on `@x402/core` and `@x402/avm`.
