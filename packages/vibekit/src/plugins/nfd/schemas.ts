import { z } from 'zod'

export const propertiesSchema = z.record(z.string(), z.string()).optional()

/** resolve_nfd's wire shape; hosts that resolve names directly build the same record. */
export const nfdRecordSchema = z.object({
  name: z.string(),
  address: z.string().optional(),
  owner: z.string().optional(),
  appId: z.number().optional(),
  state: z.string().optional(),
  properties: propertiesSchema,
})

export type NfdRecord = z.infer<typeof nfdRecordSchema>

/** search_nfds' wire shape (the `nfd.list` view). */
export const nfdListSchema = z.object({
  query: z.string(),
  total: z.number(),
  nfds: z.array(
    nfdRecordSchema.extend({
      /** Asking price in microALGO when the name is for sale. */
      sellAmountMicroAlgos: z.number().optional(),
    }),
  ),
})
export type NfdList = z.infer<typeof nfdListSchema>
