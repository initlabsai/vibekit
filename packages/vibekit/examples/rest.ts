/**
 * REST over the tool contract with an x402 paywall, under Bun. Three free
 * calls a day per IP, then `POST /buy` (402 → pay in USDC → credit) and a
 * bearer token. Swap the memory store for KV/Redis to survive restarts.
 *
 *   X402_PAY_TO=<house address> bun packages/vibekit/examples/rest.ts
 *   curl -X POST :8789/tools/lookup_asset -d '{"assetId":31566704}'
 */
import { createPaywall, memoryStore } from '@initlabs/vibekit/pay'
import { defaultPlugins, defaultTools } from '@initlabs/vibekit/preset'
import { createRestHandler } from '@initlabs/vibekit/rest'

const rest = createRestHandler({ network: 'testnet', mode: 'compose', tools: defaultTools, plugins: defaultPlugins() })
const paywall = process.env.X402_PAY_TO
  ? createPaywall({ chain: 'testnet', payTo: process.env.X402_PAY_TO, priceMicroUsdc: 1_000_000, turnsPerPack: 25, store: memoryStore() })
  : undefined

Bun.serve({
  port: Number(process.env.PORT ?? 8789),
  async fetch(request) {
    const { pathname } = new URL(request.url)
    if (pathname === '/tools' && request.method === 'GET') return Response.json({ tools: rest.catalogue() })
    if (pathname === '/buy' && paywall) return request.method === 'POST' ? paywall.buy(request) : Response.json(await paywall.status(request))
    const name = pathname.match(/^\/tools\/([a-z0-9_]+)$/)?.[1]
    if (!name || request.method !== 'POST') return new Response('Not found', { status: 404 })
    if (paywall) {
      const charge = await paywall.charge(request)
      if (!charge.ok) return charge.response
    }
    return rest.call(name, request)
  },
})
console.error(`vibekit rest on :${process.env.PORT ?? 8789}${paywall ? ' (x402)' : ' (free)'}`)
