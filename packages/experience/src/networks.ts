import { z } from 'zod'

/** Authoritative network snapshot required by the trusted network status view. */
export const networkStatusDataSchema = z
  .object({
    network: z.string().min(1),
    mode: z.enum(['execute', 'compose']).optional(),
    servedNetworks: z.array(z.string().min(1)).optional(),
    latestRound: z.number().int().nonnegative().optional(),
    avgTps: z.number().finite().nonnegative().optional(),
    avgBlockTime: z.number().finite().nonnegative().optional(),
    participation: z.number().finite().nonnegative().optional(),
    algodUrl: z.string().min(1).optional(),
    indexerUrl: z.string().min(1).optional(),
  })
  .strict()

/** Authoritative network snapshot required by the trusted network status view. */
export type NetworkStatusData = z.infer<typeof networkStatusDataSchema>
