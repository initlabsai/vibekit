/**
 * MCP over streamable HTTP, behind the same paywall as the REST route: a
 * `tools/call` costs a turn; the handshake and listings are free.
 */
import { chargeTurn, mcpHandler } from '../tools/deployment'

export const runtime = 'nodejs'
export const maxDuration = 30

async function isToolCall(request: Request): Promise<boolean> {
  try {
    const body = (await request.clone().json()) as { method?: string } | { method?: string }[]
    return (Array.isArray(body) ? body : [body]).some((message) => message?.method === 'tools/call')
  } catch {
    return false
  }
}

export async function POST(request: Request): Promise<Response> {
  if (await isToolCall(request)) {
    const refused = await chargeTurn(request)
    if (refused) return refused
  }
  return mcpHandler().fetch(request)
}

export const GET = (request: Request): Promise<Response> => mcpHandler().fetch(request)
export const DELETE = (request: Request): Promise<Response> => mcpHandler().fetch(request)
