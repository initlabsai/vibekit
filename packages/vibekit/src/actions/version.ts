import { z } from 'zod'

/**
 * Version stamped on every record and event (results, view specs,
 * write-stage events). A literal, so a bump rejects old messages outright;
 * nothing persists across app runs, so there is no migration path to keep.
 */
export const RECORD_PROTOCOL_VERSION = '0.1.0' as const

/** Zod schema for the current record protocol version. */
export const recordProtocolVersionSchema = z.literal(RECORD_PROTOCOL_VERSION)

/** The current record protocol version. */
export type RecordProtocolVersion = z.infer<typeof recordProtocolVersionSchema>
