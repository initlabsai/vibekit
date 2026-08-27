import { z } from 'zod'

/**
 * Version stamped on every Explorer protocol message (results, view specs,
 * write-stage events). A literal, so a bump rejects old messages outright;
 * nothing persists across app runs, so there is no migration path to keep.
 */
export const EXPLORER_PROTOCOL_VERSION = '0.1.0' as const

/** Zod schema for the current Explorer protocol version. */
export const explorerProtocolVersionSchema = z.literal(EXPLORER_PROTOCOL_VERSION)

/** The current Explorer protocol version. */
export type ExplorerProtocolVersion = z.infer<typeof explorerProtocolVersionSchema>
