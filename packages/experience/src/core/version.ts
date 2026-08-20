import { z } from 'zod'

/**
 * Version carried by the first Explorer presentation messages. The prerelease
 * label is deliberate: the contract remains provisional until both renderers
 * exercise it.
 */
export const EXPERIENCE_PROTOCOL_VERSION = '0.1.0-provisional' as const

/** Zod schema for the current provisional Explorer protocol version. */
export const experienceProtocolVersionSchema = z.literal(EXPERIENCE_PROTOCOL_VERSION)

/** The current provisional Explorer protocol version. */
export type ExperienceProtocolVersion = z.infer<typeof experienceProtocolVersionSchema>
