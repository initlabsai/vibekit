/**
 * An x402 gate over a web-standard handler: no payment header → 402 with the
 * requirements; a verified payment → run the handler, settle, credit. This
 * is @x402/next's withX402 with a plain Request in place of NextRequest, so
 * it mounts in Next, Bun, Hono, or Workers unchanged.
 */
import { ALGORAND_MAINNET_GENESIS_HASH, ALGORAND_TESTNET_GENESIS_HASH } from '@x402/avm'
import { ExactAvmScheme } from '@x402/avm/exact/server'
import {
  FacilitatorResponseError,
  HTTPFacilitatorClient,
  SETTLEMENT_OVERRIDES_HEADER,
  withPrivateCacheControl,
  x402HTTPResourceServer,
  x402ResourceServer,
  type HTTPAdapter,
  type HTTPRequestContext,
  type RouteConfig,
} from '@x402/core/server'

export type Handler = (request: Request) => Promise<Response>

/** The x402 network string for an Algorand chain: `algorand:<genesis hash>`, the form facilitators advertise. */
export function x402Network(chain: 'mainnet' | 'testnet'): `algorand:${string}` {
  return `algorand:${chain === 'mainnet' ? ALGORAND_MAINNET_GENESIS_HASH : ALGORAND_TESTNET_GENESIS_HASH}`
}

export interface X402GateOptions {
  chain: 'mainnet' | 'testnet'
  payTo: string
  /** ASA id the payment moves. */
  asset: string
  facilitatorUrl: string
  /** Atomic amount in the asset's base units, sized per request (a `?turns=` query, say). */
  amount: (request: Request) => string
  description?: string
  /** A payment settled: `amount` is what the facilitator actually moved, never a caller-sent figure. */
  onSettled: (settled: { payer: string; amount: string; request: Request }) => Promise<void>
}

class RequestAdapter implements HTTPAdapter {
  constructor(private readonly request: Request) {}
  getHeader = (name: string) => this.request.headers.get(name) || undefined
  getMethod = () => this.request.method
  getPath = () => new URL(this.request.url).pathname
  getUrl = () => this.request.url
  getAcceptHeader = () => this.request.headers.get('Accept') || ''
  getUserAgent = () => this.request.headers.get('User-Agent') || ''
  getQueryParams = () => {
    const params: Record<string, string | string[]> = {}
    new URL(this.request.url).searchParams.forEach((value, key) => {
      const existing = params[key]
      params[key] = existing ? [...(Array.isArray(existing) ? existing : [existing]), value] : value
    })
    return params
  }
  getQueryParam = (name: string) => {
    const all = new URL(this.request.url).searchParams.getAll(name)
    return all.length === 0 ? undefined : all.length === 1 ? all[0] : all
  }
  getBody = async () => {
    try {
      return await this.request.clone().json()
    } catch {
      return undefined
    }
  }
}

const json = (status: number, body: unknown, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body ?? {}), { status, headers: { 'content-type': 'application/json', ...headers } })

/** Wraps `handler` so the request must carry a verified x402 payment before it runs. */
export function createX402Gate(options: X402GateOptions): (handler: Handler) => Handler {
  const network = x402Network(options.chain)
  const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: options.facilitatorUrl })).register(
    network,
    new ExactAvmScheme(),
  )
  const requests = new WeakMap<object, Request>()
  server.onAfterSettle(async ({ result, requirements, transportContext }) => {
    if (!result.success || !result.payer) return
    const context = transportContext as { request?: { adapter?: object }; adapter?: object } | undefined
    const adapter = context?.request?.adapter ?? context?.adapter
    const request = adapter && requests.get(adapter)
    if (!request) return
    await options.onSettled({ payer: result.payer, amount: String(requirements.amount), request })
  })
  const route: RouteConfig = {
    accepts: {
      scheme: 'exact',
      network,
      payTo: options.payTo,
      price: (context) => ({
        asset: options.asset,
        amount: options.amount(requests.get(context.adapter) ?? new Request('http://x')),
      }),
    },
    ...(options.description ? { description: options.description } : {}),
  }
  const http = new x402HTTPResourceServer(server, { '*': route })
  let initialized: Promise<void> | undefined

  return (handler) => async (request) => {
    try {
      await (initialized ??= http.initialize().catch((error) => {
        initialized = undefined
        throw error
      }))
    } catch (error) {
      return error instanceof FacilitatorResponseError ? json(502, { error: error.message }) : json(500, { error: 'Internal Server Error' })
    }
    const adapter = new RequestAdapter(request)
    requests.set(adapter, request)
    const context: HTTPRequestContext = {
      adapter,
      path: adapter.getPath(),
      method: request.method,
      paymentHeader: adapter.getHeader('payment-signature') || adapter.getHeader('x-payment'),
    }
    let result
    try {
      result = await http.processHTTPRequest(context)
    } catch (error) {
      return error instanceof FacilitatorResponseError ? json(502, { error: error.message }) : json(500, { error: 'Internal Server Error' })
    }
    if (result.type === 'no-payment-required') return handler(request)
    if (result.type === 'payment-error') {
      const { response } = result
      const headers = new Headers(response.headers)
      headers.set('content-type', response.isHtml ? 'text/html' : 'application/json')
      return new Response(response.isHtml ? (response.body as string) : JSON.stringify(response.body ?? {}), { status: response.status, headers })
    }
    // payment-verified: run the handler, then settle; a failed handler cancels the settlement.
    let response: Response
    try {
      response = await handler(request)
    } catch (error) {
      const cancel = await result.cancellationDispatcher.cancel({ reason: 'handler_threw', error })
      if (!result.beforeHandlerSettlement && !cancel) throw error
      const failed = json(500, { error: 'Internal Server Error' })
      const failureHeaders = http.createFailurePathSettlementHeaders(cancel, result.beforeHandlerSettlement, result.paymentPayload, null)
      for (const [key, value] of Object.entries(failureHeaders ?? {})) failed.headers.set(key, value)
      return failed
    }
    if (response.status >= 400) {
      const cancel = await result.cancellationDispatcher.cancel({ reason: 'handler_failed', responseStatus: response.status })
      response.headers.delete(SETTLEMENT_OVERRIDES_HEADER)
      const failureHeaders = http.createFailurePathSettlementHeaders(cancel, result.beforeHandlerSettlement, result.paymentPayload, response.headers.get('Cache-Control'))
      for (const [key, value] of Object.entries(failureHeaders ?? {})) response.headers.set(key, value)
      return response
    }
    try {
      const responseBody = Buffer.from(await response.clone().arrayBuffer())
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => (responseHeaders[key] = value))
      const settled = await http.processSettlement(
        result.paymentPayload,
        result.paymentRequirements,
        result.declaredExtensions,
        { request: context, responseBody, responseHeaders },
        undefined,
        result.beforeHandlerSettlement,
      )
      if (!settled.success) {
        const { response: failure } = settled
        return new Response(failure.isHtml ? (failure.body as string) : JSON.stringify(failure.body ?? {}), { status: failure.status, headers: failure.headers })
      }
      for (const [key, value] of Object.entries(settled.headers)) response.headers.set(key, value)
      response.headers.set('Cache-Control', withPrivateCacheControl(response.headers.get('Cache-Control')))
      response.headers.delete(SETTLEMENT_OVERRIDES_HEADER)
      return response
    } catch (error) {
      if (error instanceof FacilitatorResponseError) return json(502, { error: error.message })
      console.error('Settlement failed:', error)
      return json(402, {})
    }
  }
}
