import { z } from 'zod'

/** web_search's wire shape (the `web.results` view). */
export const webResultsSchema = z.object({
  query: z.string(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      published: z.string().optional().describe('ISO date when the page states one'),
      highlights: z.array(z.string()).describe('The passages that matched, in page order'),
    }),
  ),
})
export type WebResults = z.infer<typeof webResultsSchema>

/** read_page's wire shape (the `web.page` view). */
export const webPageSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  content: z.string().describe('Markdown, capped'),
  truncated: z.boolean(),
})
export type WebPage = z.infer<typeof webPageSchema>
