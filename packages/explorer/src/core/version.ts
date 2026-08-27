import { z } from 'zod'

/**
 * Version carried by the first Explorer presentation messages. The prerelease
 * label is deliberate: the contract remains provisional until both renderers
 * exercise it.
 */
export const EXPLORER_PROTOCOL_VERSION = '0.1.0-provisional' as const

/** Zod schema for the current provisional Explorer protocol version. */
export const explorerProtocolVersionSchema = z.literal(EXPLORER_PROTOCOL_VERSION)

/** The current provisional Explorer protocol version. */
export type ExplorerProtocolVersion = z.infer<typeof explorerProtocolVersionSchema>
