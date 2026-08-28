/**
 * The browser's Explorer host: a same-origin adapter over createLiveHost.
 * Every read and compose write is a live-host call; the deployment has no
 * signer, so nothing here can sign. Signed bytes arrive from the browser and
 * submit always verifies them against the approved draft before broadcast.
 */
import {
  structuredResultSchema,
  type LiveNetworkId,
  type StructuredResult,
} from '@initlabs/vibekit-explorer'
import {
  createEnrichmentHost,
  createLiveHost,
  resolveNfdName,
  signedGroupRecordFor,
  type EnrichmentHost,
  type LiveHost,
} from '@initlabs/vibekit-explorer/live'
import { z } from 'zod'

import { MissingEndpointsError, networkConfigFromEnv } from './endpoints'

export const runtime = 'nodejs'
export const maxDuration = 15

const MAX_BODY_BYTES = 256 * 1024

const networkSchema = z.enum(['localnet', 'testnet', 'mainnet'])
const signedBody = {
  network: networkSchema,
  draftRecord: structuredResultSchema,
  signedTransactions: z.array(z.string().min(1)).min(1).max(16),
}

export const explorerRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('probe'), network: networkSchema }),
  z.object({
    action: z.literal('call-tool'),
    network: networkSchema,
    toolName: z.string().min(1),
    args: z.record(z.string(), z.unknown()),
  }),
  z.object({ action: z.literal('lookup-account'), network: networkSchema, address: z.string().min(1) }),
  z.object({
    action: z.literal('lookup-accounts'),
    network: networkSchema,
    addresses: z.array(z.string().min(1)).min(1),
  }),
  z.object({ action: z.literal('lookup-account-assets'), network: networkSchema, address: z.string().min(1) }),
  z.object({ action: z.literal('lookup-account-app-states'), network: networkSchema, address: z.string().min(1) }),
  z.object({ action: z.literal('lookup-transaction'), network: networkSchema, txid: z.string().min(1) }),
  z.object({ action: z.literal('lookup-transaction-group'), network: networkSchema, groupId: z.string().min(1) }),
  z.object({ action: z.literal('lookup-asset'), network: networkSchema, assetId: z.number().int().nonnegative() }),
  z.object({
    action: z.literal('lookup-application'),
    network: networkSchema,
    applicationId: z.number().int().nonnegative(),
  }),
  z.object({ action: z.literal('lookup-block'), network: networkSchema, round: z.number().int().nonnegative() }),
  z.object({
    action: z.literal('search-transactions'),
    network: networkSchema,
    filter: z.object({
      address: z.string().optional(),
      assetId: z.number().int().nonnegative().optional(),
      applicationId: z.number().int().nonnegative().optional(),
      round: z.number().int().nonnegative().optional(),
      txType: z.string().optional(),
      nextToken: z.string().optional(),
    }),
  }),
  z.object({
    action: z.literal('draft-payment'),
    network: networkSchema,
    params: z.object({
      sender: z.string().min(1),
      receiver: z.string().min(1),
      amountMicroAlgos: z.number().int().positive(),
      note: z.string().min(1).optional(),
    }),
  }),
  z.object({ action: z.literal('simulate-draft'), network: networkSchema, draftRecord: structuredResultSchema }),
  z.object({ action: z.literal('record-signed'), ...signedBody }),
  z.object({ action: z.literal('submit-signed'), ...signedBody }),
  z.object({ action: z.literal('await-confirmation'), network: networkSchema, txid: z.string().min(1) }),
  z.object({ action: z.literal('status-round'), network: networkSchema }),
  z.object({ action: z.literal('resolve-nfd'), network: networkSchema, name: z.string().min(1).max(128) }),
  // The enrichment host owns its tool list (the three plugins' read tools); an unknown name is a 400 there.
  z.object({
    action: z.literal('plugin-tool'),
    network: networkSchema,
    toolName: z.string().min(1),
    args: z.record(z.string(), z.unknown()),
  }),
])

export type ExplorerRequest = z.infer<typeof explorerRequestSchema>

/**
 * Cache only signerless createLiveHost(network) with the stock tool list.
 * Do not put request- or user-scoped options on a cached host. Do not cache
 * createAgent. Serverless isolates each have their own Map.
 */
const hosts = new Map<LiveNetworkId, LiveHost>()
function hostFor(network: LiveNetworkId): LiveHost {
  let host = hosts.get(network)
  if (!host) {
    host = createLiveHost(networkConfigFromEnv(network))
    hosts.set(network, host)
  }
  return host
}

/** Same rule as `hosts`: signerless, stock plugin list, per isolate. */
const enrichments = new Map<LiveNetworkId, EnrichmentHost>()
function enrichmentFor(network: LiveNetworkId): EnrichmentHost {
  let host = enrichments.get(network)
  if (!host) {
    host = createEnrichmentHost(networkConfigFromEnv(network))
    enrichments.set(network, host)
  }
  return host
}

/** The probe's network when the query names none: the same default the page opens on. */
function defaultNetwork(): LiveNetworkId {
  const configured = process.env.NEXT_PUBLIC_EXPLORER_DEFAULT_NETWORK
  return configured === 'localnet' || configured === 'testnet' ? configured : 'mainnet'
}

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status })
}

/** Verifies that every signed transaction wraps the approved draft's bytes; a mismatch is a refusal. */
function verifiedSignedRecord(
  host: LiveHost,
  body: { draftRecord: StructuredResult; signedTransactions: string[] },
): StructuredResult {
  return signedGroupRecordFor(
    {
      resultId: `result-live-signed-${crypto.randomUUID()}`,
      toolCallId: `tool-call-live-signed-${crypto.randomUUID()}`,
      network: host.network,
    },
    body.draftRecord,
    body.signedTransactions.map((txn) => new Uint8Array(Buffer.from(txn, 'base64'))),
  )
}

export async function GET(request: Request): Promise<Response> {
  const requested = new URL(request.url).searchParams.get('network')
  const parsed = networkSchema.safeParse(requested ?? defaultNetwork())
  if (!parsed.success) return fail(400, 'Unknown network')
  try {
    const host = hostFor(parsed.data)
    // One status call answers both questions; the probe's timeout still bounds it.
    const status = await Promise.race([
      host.statusRound(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]).catch(() => null)
    return Response.json(status ? { network: parsed.data, live: true, round: status.lastRound } : { network: parsed.data, live: false })
  } catch (error) {
    if (error instanceof MissingEndpointsError) return fail(503, error.message)
    return Response.json({ network: parsed.data, live: false })
  }
}

export async function POST(request: Request): Promise<Response> {
  const text = await request.text()
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return fail(413, 'Request body is too large')
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return fail(400, 'Malformed JSON body')
  }
  const parsed = explorerRequestSchema.safeParse(json)
  if (!parsed.success) return fail(400, 'Invalid explorer request')
  const body = parsed.data
  const started = Date.now()
  let status = 200
  try {
    const host = hostFor(body.network)
    const record = async (value: Promise<unknown>) => Response.json({ record: await value })
    switch (body.action) {
      case 'probe':
        return Response.json({ network: body.network, live: await host.probe() })
      case 'status-round':
        return Response.json(await host.statusRound())
      case 'plugin-tool':
        return Response.json({ output: await enrichmentFor(body.network).callTool(body.toolName, body.args) })
      case 'resolve-nfd': {
        // The nfd plugin's own client, beside the live host; the host itself carries no plugins.
        if (body.network === 'localnet') {
          status = 400
          return fail(400, 'NFD names resolve on mainnet and testnet only')
        }
        return Response.json({ nfd: await resolveNfdName(body.network, body.name) })
      }
      case 'call-tool':
        return await record(host.callTool(body.toolName, body.args))
      case 'lookup-account':
        return await record(host.lookupAccount(body.address))
      case 'lookup-accounts':
        return await record(host.lookupAccounts(body.addresses))
      case 'lookup-account-assets':
        return await record(host.lookupAccountAssets(body.address))
      case 'lookup-account-app-states':
        return await record(host.lookupAccountAppStates(body.address))
      case 'lookup-transaction':
        return await record(host.lookupTransaction(body.txid))
      case 'lookup-transaction-group':
        return await record(host.lookupTransactionGroup(body.groupId))
      case 'lookup-asset':
        return await record(host.lookupAsset(body.assetId))
      case 'lookup-application':
        return await record(host.lookupApplication(body.applicationId))
      case 'lookup-block':
        return await record(host.lookupBlock(body.round))
      case 'search-transactions':
        return await record(host.searchTransactions(body.filter))
      case 'draft-payment':
        return await record(host.draftPayment(body.params))
      case 'simulate-draft':
        return await record(host.simulateDraft(body.draftRecord))
      case 'record-signed': {
        let signedRecord
        try {
          signedRecord = verifiedSignedRecord(host, body)
        } catch (error) {
          status = 400
          return fail(400, error instanceof Error ? error.message : String(error))
        }
        return Response.json({ record: signedRecord })
      }
      case 'submit-signed': {
        // Serverless isolates share nothing, so submit re-verifies rather than trusting record-signed.
        let signedRecord
        try {
          signedRecord = verifiedSignedRecord(host, body)
        } catch (error) {
          status = 400
          return fail(400, error instanceof Error ? error.message : String(error))
        }
        const { txid } = await host.broadcastSigned(signedRecord)
        return Response.json({ signedRecord, txid, pending: true })
      }
      case 'await-confirmation': {
        const confirmation = await host.confirmation(body.txid)
        return confirmation ? Response.json({ record: confirmation }) : Response.json({ pending: true })
      }
    }
    return fail(400, 'Invalid explorer request')
  } catch (error) {
    if (error instanceof MissingEndpointsError) {
      status = 503
      return fail(503, error.message)
    }
    const message = error instanceof Error ? error.message : String(error)
    status = message.startsWith('This host has no tool named') ? 400 : 502
    return fail(status, message)
  } finally {
    console.log(
      `explorer ${body.action} ${body.network}${'toolName' in body ? ` ${body.toolName}` : ''} ${status} ${Date.now() - started}ms`,
    )
  }
}
