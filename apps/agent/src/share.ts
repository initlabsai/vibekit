/**
 * One shareable exchange: the payload, its content hash, and how a section
 * becomes one. Shared by the share glyph, the API route, the share page,
 * and the OG image — one definition of the shape and one of the hash.
 */
import { z } from 'zod'

import {
  findResultRecord,
  structuredResultSchema,
  viewSpecSchema,
  type ResultStore,
} from '@initlabs/vibekit/actions'

import type { Section } from './feed/hooks'
import { plainAgentText } from './theme'

/** Matches the agent route's own body limit; list tools paginate, so it should never fire. */
export const MAX_SHARE_BYTES = 256 * 1024

/**
 * The stored shape, whole. Action blocks (a composed transaction group) and
 * raw blocks are unrepresentable here on purpose: a landing page that could
 * rebuild an approval flow would be "sign this group" phishing at a genuine
 * URL.
 */
export const sharePayloadSchema = z
  .object({
    prompt: z.string().min(1).max(4000),
    /** Her answer, whole. The card truncates; the page shows all of it. */
    reply: z.string().min(1).max(16000),
    network: z.enum(['localnet', 'testnet', 'mainnet']),
    blocks: z
      .array(z.object({ view: viewSpecSchema, record: structuredResultSchema }).strict())
      .max(24),
  })
  .strict()

export type SharePayload = z.infer<typeof sharePayloadSchema>

/** Control characters (newlines survive) and bidi overrides never reach a rendered card or the composer prefill. */
export function stripShareText(text: string): string {
  return text
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .trim()
}

/** JSON with object keys sorted at every level, so the hash ignores key order. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

/**
 * sha256 over everything the card displays — prompt, tool calls, network,
 * reply — first 48 bits as 12 lowercase hex characters. Hex over base32: a
 * base32 string next to Algorand addresses reads like a truncated address.
 */
export async function hashPayload(payload: SharePayload): Promise<string> {
  const preimage = [
    payload.prompt,
    payload.blocks.map((block) => block.record.toolName + canonical(block.record.input ?? {})).join('|'),
    payload.network,
    payload.reply,
  ].join('\n')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(preimage))
  return [...new Uint8Array(digest).slice(0, 6)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** A note that is her answer, not her `→ tool…` narration. */
const substantive = (item: Section['items'][number]): boolean =>
  item.kind === 'note' && item.tone === 'agent' && !item.pending && !item.text.startsWith('→')

/** The section as a shareable exchange, or nothing while she has not answered. */
export function payloadFor(section: Section, store: ResultStore): SharePayload | undefined {
  const reply = [...section.items].reverse().find(substantive)
  if (!reply || reply.kind !== 'note') return undefined
  const blocks = section.items.flatMap((item) => {
    if (item.kind !== 'block' || item.block.kind !== 'view') return []
    const record = findResultRecord(store, item.block.view.source)
    return record ? [{ view: item.block.view, record }] : []
  })
  const payload = {
    prompt: stripShareText(section.prompt),
    reply: stripShareText(plainAgentText(reply.text)),
    network: section.network,
    blocks,
  }
  return sharePayloadSchema.safeParse(payload).success ? payload : undefined
}

/** What one block shows on the poster and the page — RawCard's derivation, pure. */
export interface ShareEvidence {
  kicker: string
  facts: Array<[label: string, value: string]>
  listName?: string
  listCount?: number
}

export function evidenceFor(block: SharePayload['blocks'][number]): ShareEvidence {
  const data = block.record.state === 'success' ? block.record.data : block.record.error
  const object =
    data !== null && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  const facts = Object.entries(object)
    .filter(([, value]) => typeof value !== 'object' || value === null)
    .slice(0, 6)
    .map(([key, value]) => [key, stripShareText(String(value)).slice(0, 80)] as [string, string])
  const list = Object.entries(object).find(
    ([, value]) => Array.isArray(value) && value.every((entry) => typeof entry === 'object'),
  )
  return {
    kicker: block.view.view.toUpperCase(),
    facts,
    ...(list ? { listName: list[0], listCount: (list[1] as unknown[]).length } : {}),
  }
}
