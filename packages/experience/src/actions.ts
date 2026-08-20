import { z } from 'zod'

import {
  resolveResultReference,
  resultReferenceSchema,
  type ResultResolution,
  type ResultStore,
} from './results.js'

/** Domain targets supported by related-entity navigation. */
export const relatedEntityKindSchema = z.enum(['account', 'asset', 'application', 'block'])

/** A renderer-independent request to look up an entity named by result data. */
export const relatedEntityActionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    action: z.literal('open-related'),
    entity: relatedEntityKindSchema,
    target: resultReferenceSchema,
  })
  .strict()

/** A renderer-independent request to look up an entity named by result data. */
export type RelatedEntityAction = z.infer<typeof relatedEntityActionSchema>

/** Resolves a semantic action's authoritative target value. */
export function resolveRelatedEntityAction(
  store: ResultStore,
  action: RelatedEntityAction,
): ResultResolution {
  return resolveResultReference(store, action.target)
}
