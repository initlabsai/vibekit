/**
 * The route is a mount: env names the model, the paywall or the house bills,
 * the package streams the turn. The handler's own behaviour (drafts, caps,
 * context) is tested in the package; here, the wiring.
 */
import { afterEach, describe, expect, test } from 'bun:test'

const { GET, POST } = await import('../app/api/agent/route.js')

const env = { ...process.env }
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]
  Object.assign(process.env, env)
})

async function events(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text()
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>)
}
const turn = (body: unknown) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }))

describe('agent route', () => {
  test('without a Together key the lane is off: GET says so, POST is 404', async () => {
    delete process.env.TOGETHER_API_KEY
    delete process.env.AGENT_API_KEY
    expect(await (await GET()).json()).toEqual({ enabled: false, private: false })
    expect((await turn({ network: 'localnet', input: 'hi' })).status).toBe(404)
  })

  test('env names the model; the endpoint host is the provider shown', async () => {
    process.env.TOGETHER_API_KEY = 'test-key'
    process.env.TOGETHER_MODEL = 'test/model'
    expect(await (await GET()).json()).toEqual({ enabled: true, model: 'test/model', provider: 'together', billing: 'house', private: false })
    process.env.AGENT_API_KEY = 'or-key'
    process.env.AGENT_BASE_URL = 'https://openrouter.ai/api/v1'
    process.env.AGENT_MODEL = 'z-ai/glm-5.3-flash'
    expect(await (await GET()).json()).toMatchObject({ enabled: true, model: 'z-ai/glm-5.3-flash', provider: 'openrouter' })
  })

  test('a turn is the package handler: validated, streamed as NDJSON, the model failure reported in-stream', async () => {
    process.env.AGENT_API_KEY = 'test'
    // The model endpoint answers 401 at once — a status the SDK does not retry — so the failure lands in the stream immediately.
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => Response.json({ error: 'nope' }, { status: 401 })) as unknown as typeof fetch
    try {
      expect((await turn({ network: 'moonnet', input: 'hi' })).status).toBe(400)
      const response = await turn({ network: 'localnet', input: 'hi' })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('x-ndjson')
      const stream = await events(response)
      expect(stream.at(-1)?.type).toBe('error')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
