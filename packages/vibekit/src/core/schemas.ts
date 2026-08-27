/** Shared zod schemas for write-tool outputs (compose | execute result union). */
import { z } from 'zod'

export const unsignedGroupResultSchema = z.object({
  unsignedGroup: z.array(z.string()).describe('base64-encoded unsigned transactions, group order'),
  summary: z.string(),
})

export const executeGroupResultSchema = z.object({
  txids: z.array(z.string()),
  confirmedRound: z.number(),
  // nullish: zod 4 treats a bare z.unknown() field as a required key, and
  // jsonSafe drops undefined entries — absent-or-null must both validate.
  returns: z.array(z.object({ index: z.number(), value: z.unknown().nullish() })),
})

/** What every write tool returns: unsigned group (compose mode) or execution result. */
export const writeResultSchema = z.union([unsignedGroupResultSchema, executeGroupResultSchema])
