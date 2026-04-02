import { Hono, type Context, type Next } from 'hono'
import { cors } from 'hono/cors'
import { validateApiKey } from './lib/auth'
import { chatRoute } from './routes/chat'
import { queryRoute } from './routes/query'
import { env } from './lib/env'

type Env = { Variables: { apiKeyLabel: string } }

const app = new Hono<Env>()

app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? '*' }))

// Health check (no auth required)
app.get('/health', (c) => c.json({ status: 'ok' }))

// Auth middleware for API routes
app.use('/chat/*', authMiddleware)
app.use('/query/*', authMiddleware)

app.route('/chat', chatRoute)
app.route('/query', queryRoute)

const port = env.PORT
console.log(`Query service listening on port ${port}`)

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120,
}

async function authMiddleware(c: Context<Env>, next: Next) {
  const keyInfo = validateApiKey(c.req.header('Authorization') ?? null)
  if (!keyInfo) {
    return c.json({ error: 'Invalid or missing API key' }, 401)
  }
  c.set('apiKeyLabel', keyInfo.label)
  await next()
}
