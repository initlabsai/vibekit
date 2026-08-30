import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { defineAction, defineQuery } from '../../src/core/index.js'
import { createQueryHandler } from '../../src/rest/index.js'

const echo = defineQuery({
  name: 'echo',
  description: 'says it back',
  parameters: z.object({ text: z.string() }),
  output: z.object({ text: z.string() }),
  handler: async (_ctx, args) => ({ text: args.text }),
})
const draft = defineAction({
  name: 'draft_thing',
  description: 'drafts',
  parameters: z.object({ sender: z.string() }),
  output: z.unknown(),
  handler: async () => ({ unsignedGroup: ['AAAA'], summary: 'thing' }),
})
const rest = createQueryHandler({ network: 'localnet', mode: 'compose', tools: [echo, draft] })
const post = (name: string, body?: string) => rest.call(name, new Request('http://x/api/query/' + name, { method: 'POST', ...(body === undefined ? {} : { body }) }))

describe('REST over the tool contract', () => {
  test('runs a query with the JSON body as arguments', async () => {
    const response = await post('echo', JSON.stringify({ text: 'hi' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ tool: 'echo', result: { text: 'hi' } })
  })

  test('an action returns the draft, never a signature', async () => {
    const body = (await (await post('draft_thing', JSON.stringify({ sender: 'a' }))).json()) as { result: { unsignedGroup: string[] } }
    expect(body.result.unsignedGroup).toEqual(['AAAA'])
  })

  test('404 for an unknown tool, 400 for bad JSON or arguments', async () => {
    expect((await post('nope', '{}')).status).toBe(404)
    expect((await post('echo', '{not json')).status).toBe(400)
    const invalid = await post('echo', JSON.stringify({ text: 1 }))
    expect(invalid.status).toBe(400)
    expect(((await invalid.json()) as { code: string }).code).toBe('INVALID_ARGS')
  })

  test('the catalogue names every tool, its kind, and a JSON Schema', () => {
    const entries = rest.catalogue()
    expect(entries.map((entry) => [entry.name, entry.kind])).toEqual([['echo', 'query'], ['draft_thing', 'action']])
    expect(entries[0]!.parameters).toMatchObject({ type: 'object', properties: { text: { type: 'string' } } })
  })
})
