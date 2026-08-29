/**
 * Web plugin: search and read pages through Exa's hosted MCP. Keyless works
 * for a handful of calls, then Exa asks for a key (EXA_API_KEY). Every network; every call counts as expensive so a host can
 * cap how many one turn spends. The card is the citation; the model's
 * sentence is the answer.
 */
import { z } from 'zod'

import {
  defineTool,
  RATE_LIMITED,
  ToolError,
  type AnyTool,
  type ToolContext,
  type ToolPlugin,
} from '../../core/index.js'
import { webPageSchema, webResultsSchema, type WebPage, type WebResults } from './schemas.js'

export { webPageSchema, webResultsSchema, type WebPage, type WebResults }

export const PLUGIN_NAME = 'web'
const EXA_MCP_URL = 'https://mcp.exa.ai/mcp'
const PAGE_CHARS = 12_000

export interface WebOptions {
  /** Exa API key (dashboard.exa.ai); keyless answers a few calls a day, then rate-limits. */
  apiKey?: string
  /** Test seam and self-hosting hook. */
  endpoint?: string
}

/** One MCP tool call over JSON-RPC; the reply is the tool's text content. */
export interface WebService {
  call(tool: string, args: Record<string, unknown>): Promise<string>
}

function createWebService(options: WebOptions): WebService {
  const endpoint = new URL(options.endpoint ?? EXA_MCP_URL)
  // Exa reads the key from the URL, not a header.
  if (options.apiKey) endpoint.searchParams.set('exaApiKey', options.apiKey)
  let id = 0
  return {
    async call(tool, args) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++id,
          method: 'tools/call',
          params: { name: tool, arguments: args },
        }),
      })
      if (!response.ok) {
        throw new ToolError(
          response.status === 429 ? RATE_LIMITED : 'WEB_ERROR',
          `Web search answered ${response.status}`,
        )
      }
      const body = await response.text()
      // Streamable HTTP: either a JSON body or SSE lines; the result is one JSON-RPC message either way.
      const json = body
        .split('\n')
        .map((line) => line.replace(/^data: /, '').trim())
        .find((line) => line.startsWith('{'))
      const message = json
        ? (JSON.parse(json) as {
            result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean }
            error?: { message?: string }
          })
        : undefined
      if (!message || message.error) {
        throw new ToolError(
          'WEB_ERROR',
          message?.error?.message ?? 'Web search returned nothing readable',
        )
      }
      const text =
        message.result?.content
          ?.filter((part) => part.type === 'text')
          .map((part) => part.text ?? '')
          .join('\n') ?? ''
      if (message.result?.isError) {
        const limited = /rate limit/i.test(text)
        throw new ToolError(
          limited ? RATE_LIMITED : 'WEB_ERROR',
          limited
            ? 'Web search is rate-limited right now — try again later'
            : text || 'Web search failed',
        )
      }
      return text
    },
  }
}

/** Typed accessor for ctx.services. */
export function getWeb(ctx: ToolContext): WebService {
  const service = ctx.services[PLUGIN_NAME] as WebService | undefined
  if (!service)
    throw new ToolError(
      'PLUGIN_NOT_CONFIGURED',
      'The web plugin is not registered in this deployment',
    )
  return service
}

/** Exa's search text: blocks separated by `---`, each `Title:`/`URL:`/`Published:` lines then `Highlights:`. */
export function parseSearchResults(text: string): WebResults['results'] {
  return text
    .split(/\n-{3,}\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n')
      const field = (name: string) =>
        lines
          .find((line) => line.startsWith(`${name}:`))
          ?.slice(name.length + 1)
          .trim()
      const at = lines.findIndex((line) => line.startsWith('Highlights:'))
      const highlights =
        at < 0
          ? []
          : lines
              .slice(at + 1)
              .join('\n')
              .split(/\n\.\.\.\n|\n\n/)
              .map((part) => part.replace(/^\.\.\.|\.\.\.$/g, '').trim())
              .filter((part) => part && part !== '...')
      const url = field('URL')
      const title = field('Title')
      const published = field('Published')
      return url
        ? [
            {
              title: title && title !== 'N/A' ? title : url,
              url,
              ...(published && published !== 'N/A' ? { published } : {}),
              highlights,
            },
          ]
        : []
    })
    .flat()
}

/** Exa's page text: `# title`, `URL: …`, a blank line, then the markdown. */
export function parsePage(text: string, url: string): WebPage {
  const lines = text.split('\n')
  const heading = lines[0]?.startsWith('# ') ? lines[0].slice(2).trim() : undefined
  const title = heading && heading !== '(no title)' ? heading : undefined
  const body = lines
    .slice(heading === undefined ? 0 : 1)
    .filter((line, i) => !(i === 0 && line.startsWith('URL:')))
  const content = body.join('\n').trim()
  return {
    url,
    ...(title ? { title } : {}),
    content: content.slice(0, PAGE_CHARS),
    truncated: content.length > PAGE_CHARS,
  }
}

export const webTools: AnyTool[] = [
  defineTool({
    name: 'web_search',
    description:
      'Search the web for what the chain cannot answer — news, docs, who is behind a project. Describe the ideal page; cite the card, answer in one sentence.',
    parameters: z.object({
      query: z.string().min(1).describe('A description of the ideal page, not keywords'),
      limit: z.number().optional().describe('Results (default 5, max 10)'),
    }),
    output: webResultsSchema,
    view: 'web.results',
    expensive: true,
    handler: async (ctx, args) => {
      const text = await getWeb(ctx).call('web_search_exa', {
        query: args.query,
        numResults: Math.min(args.limit ?? 5, 10),
      })
      return { query: args.query, results: parseSearchResults(text) }
    },
  }),
  defineTool({
    name: 'read_page',
    description:
      'Read one web page as markdown when the search highlights are not enough. Quote briefly; the card holds the page.',
    parameters: z.object({ url: z.string().url() }),
    output: webPageSchema,
    view: 'web.page',
    expensive: true,
    handler: async (ctx, args) => {
      const text = await getWeb(ctx).call('web_fetch_exa', {
        urls: [args.url],
        maxCharacters: PAGE_CHARS,
      })
      return parsePage(text, args.url)
    },
  }),
]

/** The plugin factory — `plugins: [webPlugin()]`; keyless by default. */
export function webPlugin(options: WebOptions = {}): ToolPlugin {
  return {
    name: PLUGIN_NAME,
    description: 'Web search and page reading via Exa (keyless; every network)',
    tools: webTools,
    service: createWebService(options),
    views: { 'web.results': webResultsSchema, 'web.page': webPageSchema },
  }
}
