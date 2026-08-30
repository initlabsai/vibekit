/**
 * An ActionHost over HTTP: the server routes (draft, simulate, record a
 * wallet's signature, submit, confirmation) and the browser's host that
 * calls them. Signing happens on the client; the server verifies that every
 * signed transaction wraps the drafted bytes before it records or
 * broadcasts anything, because the browser is not trusted to say what it
 * signed. Web-standard Request/Response: mounts anywhere.
 */
import { z } from 'zod'

import { base64ToBytes } from '../core/codec.js'
import { signedGroupRecordFor } from './decode.js'
import type { ActionHost } from './host.js'
import { structuredResultSchema, type StructuredResult } from './records.js'

/** What the routes need from a host: an ActionHost that can also broadcast and report a confirmation. */
export interface ActionRouteHost extends ActionHost {
  broadcastSigned(signedRecord: StructuredResult): Promise<{ txid: string }>
  /** The confirmation record once the transaction is in a round; undefined while pending. */
  confirmation(txid: string): Promise<StructuredResult | undefined>
}

const signed = { draftRecord: structuredResultSchema, signedTransactions: z.array(z.string().min(1)).min(1).max(16) }
export const actionRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('draft'), network: z.string().min(1), toolName: z.string().min(1).max(64), args: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal('simulate'), network: z.string().min(1), draftRecord: structuredResultSchema }),
  z.object({ action: z.literal('record-signed'), network: z.string().min(1), ...signed }),
  z.object({ action: z.literal('submit'), network: z.string().min(1), ...signed }),
  z.object({ action: z.literal('confirmation'), network: z.string().min(1), txid: z.string().min(1) }),
])
export type ActionRequest = z.infer<typeof actionRequestSchema>

export interface ActionRoutesOptions {
  /** The host for a network; throw for one you do not serve. */
  hostFor(network: string): ActionRouteHost | Promise<ActionRouteHost>
  /** Maps a thrown error to a status; default 502 (400 for an unknown tool). */
  errorStatus?: (error: unknown) => number | undefined
  bodyBytes?: number
}

const fail = (status: number, error: string) => Response.json({ error }, { status })

/** Verifies that every signed transaction wraps the approved draft's bytes; a mismatch is a refusal. */
function verifiedSignedRecord(network: string, body: { draftRecord: StructuredResult; signedTransactions: string[] }): StructuredResult {
  return signedGroupRecordFor(
    { resultId: `result-signed-${crypto.randomUUID()}`, toolCallId: `tool-call-signed-${crypto.randomUUID()}`, network },
    body.draftRecord,
    body.signedTransactions.map(base64ToBytes),
  )
}

/** POST handler for the action steps a browser cannot do itself. */
export function createActionRoutes(options: ActionRoutesOptions): (request: Request) => Promise<Response> {
  const bodyBytes = options.bodyBytes ?? 256 * 1024
  return async (request) => {
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > bodyBytes) return fail(413, 'Request body is too large')
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return fail(400, 'Malformed JSON body')
    }
    const parsed = actionRequestSchema.safeParse(json)
    if (!parsed.success) return fail(400, 'Invalid action request')
    const body = parsed.data
    try {
      const host = await options.hostFor(body.network)
      switch (body.action) {
        case 'draft':
          return Response.json({ record: await host.draft(body.toolName, body.args) })
        case 'simulate':
          return Response.json({ record: await host.simulateDraft(body.draftRecord) })
        case 'record-signed':
          return Response.json({ record: verifiedSignedRecord(host.network, body) })
        case 'submit': {
          // Serverless isolates share nothing, so submit re-verifies rather than trusting record-signed.
          const signedRecord = verifiedSignedRecord(host.network, body)
          const { txid } = await host.broadcastSigned(signedRecord)
          return Response.json({ signedRecord, txid, pending: true })
        }
        case 'confirmation': {
          const confirmation = await host.confirmation(body.txid)
          return confirmation ? Response.json({ record: confirmation }) : Response.json({ pending: true })
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status =
        options.errorStatus?.(error) ??
        (/does not wrap the drafted bytes|not the pre-signed leg|does not match the drafted group|Cannot sign a failed/.test(message) ? 400 : undefined) ??
        (message.startsWith('This host has no tool named') || message.endsWith('not an action') ? 400 : 502)
      return fail(status, message)
    }
  }
}

export interface RemoteActionHostOptions {
  /** The routes' URL. */
  url: string
  network: string
  /** The wallet's signing, when one is connected; absent means the action rests at `approved`. */
  signDraft?: ActionHost['signDraft']
  fetch?: typeof fetch
  /** Confirmation polling. */
  pollMs?: number
  pollAttempts?: number
}

export interface RemoteActionHost extends ActionHost {
  /** Posts a wallet's signed bytes for verification; the `record` transport `createWalletSignDraft` takes. */
  recordSigned(draftRecord: StructuredResult, signedTransactions: string[]): Promise<StructuredResult>
}

/** The browser's ActionHost: every step is a POST to `createActionRoutes`; signing is injected. */
export function createRemoteActionHost(options: RemoteActionHostOptions): RemoteActionHost {
  const { url, network } = options
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init))
  const pollMs = options.pollMs ?? 1000
  const pollAttempts = options.pollAttempts ?? 30
  const post = async <T = { record?: unknown }>(body: Record<string, unknown>): Promise<T> => {
    const response = await doFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ network, ...body }) })
    const payload = (await response.json()) as T & { error?: string }
    if (!response.ok) throw new Error(payload.error ?? `Action route failed with status ${response.status}`)
    return payload
  }
  const record = async (body: Record<string, unknown>) => structuredResultSchema.parse((await post(body)).record)
  /** The draft the wallet last signed; submit sends it back so the server can re-verify the bytes. */
  let signedDraft: StructuredResult | undefined
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  return {
    network,
    draft: (toolName, args) => record({ action: 'draft', toolName, args }),
    simulateDraft: (draftRecord) => record({ action: 'simulate', draftRecord }),
    recordSigned: (draftRecord, signedTransactions) => record({ action: 'record-signed', draftRecord, signedTransactions }),
    ...(options.signDraft
      ? {
          async signDraft(draftRecord: StructuredResult) {
            const signed = await options.signDraft!(draftRecord)
            signedDraft = draftRecord
            return signed
          },
        }
      : {}),
    async submitSigned(signedRecord) {
      if (signedRecord.state !== 'success') throw new Error('Cannot submit a failed signed record')
      if (!signedDraft) throw new Error('No draft was signed in this session')
      const { transactions } = signedRecord.data as { transactions: string[] }
      const { txid } = await post<{ txid: string }>({ action: 'submit', draftRecord: signedDraft, signedTransactions: transactions })
      for (let attempt = 0; attempt < pollAttempts; attempt++) {
        const payload = await post<{ record?: unknown; pending?: boolean }>({ action: 'confirmation', txid })
        if (payload.record !== undefined) return structuredResultSchema.parse(payload.record)
        await sleep(pollMs)
      }
      throw new Error(`${txid} was broadcast but not confirmed within ${(pollAttempts * pollMs) / 1000}s`)
    },
  }
}
