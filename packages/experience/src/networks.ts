import { z } from 'zod'

/** Authoritative health metrics required by the trusted network status view. */
export const networkStatusDataSchema = z
  .object({
    network: z.string().min(1),
    latestRound: z.number().int().nonnegative(),
    avgTps: z.number().finite().nonnegative(),
    avgBlockTime: z.number().finite().nonnegative(),
    participation: z.number().finite().nonnegative(),
  })
  .strict()

/** Authoritative network snapshot required by the trusted network status view. */
export type NetworkStatusData = z.infer<typeof networkStatusDataSchema>
