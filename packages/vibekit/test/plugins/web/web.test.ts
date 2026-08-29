import { describe, expect, test } from 'bun:test'

import {
  parsePage,
  parseSearchResults,
  webPlugin,
  webTools,
} from '../../../src/plugins/web/index.js'

const SEARCH = `Title: Haystack Router - GitBook
URL: https://txnlab.gitbook.io/haystack-router
Published: 2026-02-18T00:00:00.000Z
Author: N/A
Highlights:
# Haystack Router
...
The Haystack order-router is an exchange infrastructure for best-in-class DeFi trading.
...
Usage is simply a matter of (1) requesting a swap plan and (2) executing this plan atomically.

---

Title: N/A
URL: https://txnlab.gitbook.io/haystack-router/order-router-protocol/introduction
Published: N/A
Author: N/A
Highlights:
Haystack Order Router is a protocol for on-chain market swaps of Algorand assets.
`

describe('web plugin', () => {
  test('exports two expensive reads with views and short descriptions', () => {
    expect(webTools.map((t) => t.name)).toEqual(['web_search', 'read_page'])
    for (const tool of webTools) {
      expect(tool.expensive).toBe(true)
      expect(tool.description.length).toBeLessThanOrEqual(200)
    }
    expect(Object.keys(webPlugin().views ?? {})).toEqual(['web.results', 'web.page'])
  })

  test('parses Exa search blocks into results with highlights', () => {
    const results = parseSearchResults(SEARCH)
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      title: 'Haystack Router - GitBook',
      url: 'https://txnlab.gitbook.io/haystack-router',
      published: '2026-02-18T00:00:00.000Z',
    })
    expect(results[0]!.highlights).toHaveLength(3)
    expect(results[0]!.highlights[1]).toBe(
      'The Haystack order-router is an exchange infrastructure for best-in-class DeFi trading.',
    )
    // A missing title falls back to the URL; a missing date is absent, not "N/A".
    expect(results[1]!.title).toBe(results[1]!.url)
    expect(results[1]!.published).toBeUndefined()
  })

  test('parses a fetched page: heading, URL line, then the markdown', () => {
    const page = parsePage('# Haystack Router\nURL: https://x.y\n\n# Body\n\nText.', 'https://x.y')
    expect(page).toEqual({
      url: 'https://x.y',
      title: 'Haystack Router',
      content: '# Body\n\nText.',
      truncated: false,
    })
    expect(parsePage('# (no title)\nURL: https://x.y\n\nT', 'https://x.y').title).toBeUndefined()
  })

  test('web_search calls Exa and maps the reply', async () => {
    let captured: unknown
    const service = {
      call: async (tool: string, args: unknown) => ((captured = [tool, args]), SEARCH),
    }
    const ctx = { services: { web: service }, network: { id: 'testnet' } } as never
    const result = (await webTools[0]!.handler(ctx, { query: 'haystack router', limit: 3 })) as {
      results: unknown[]
    }
    expect(captured).toEqual(['web_search_exa', { query: 'haystack router', numResults: 3 }])
    expect(result.results).toHaveLength(2)
  })
})
