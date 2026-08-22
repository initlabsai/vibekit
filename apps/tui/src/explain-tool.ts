/**
 * The agent's one "render" tool: its write-up of a contract becomes the
 * EXPLANATION card. The handler keeps the markdown verbatim — the card is
 * labelled as the model's words, not chain data.
 */
import { defineTool } from '@initlabs/vibekit-core'
import { applicationExplanationDataSchema } from '@initlabs/vibekit-experience'
import { z } from 'zod'

export const explainApplicationTool = defineTool({
  name: 'explain_application',
  description:
    'Render your explanation of a contract as the EXPLANATION card. Call once, after get_application_program, with the complete write-up in markdown — headings, lists, and tables render. Describe what the program does; never rate its security.',
  parameters: z.object({
    applicationId: z.number().describe('The application explained'),
    markdown: z.string().min(1).describe('The full explanation, markdown'),
  }),
  output: applicationExplanationDataSchema,
  view: 'application.explanation',
  handler: async (_ctx, args) => ({ applicationId: args.applicationId, markdown: args.markdown }),
})
