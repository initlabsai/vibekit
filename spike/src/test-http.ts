/**
 * Verdict (a): can BOTH a modern 2026-07-28 client AND a legacy 2025-era client
 * (v1 SDK, initialize handshake + Mcp-Session-Id) talk to our stateless HTTP server?
 */
import { Client } from '@modelcontextprotocol/client'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
// v1 SDK aliased as mcp-v1 — the legacy client
import { Client as LegacyClient } from 'mcp-v1/client/index.js'
import { StreamableHTTPClientTransport as LegacyTransport } from 'mcp-v1/client/streamableHttp.js'

const url = new URL(process.env.MCP_URL ?? 'http://localhost:8788/')

// --- modern client ---
{
  const client = new Client({ name: 'modern-client', version: '0.0.0' })
  await client.connect(new StreamableHTTPClientTransport(url))
  const tools = await client.listTools()
  const status = await client.callTool({ name: 'get_network_status', arguments: {} })
  console.log('[modern 2026-07-28] tools:', tools.tools.map((t) => t.name).join(','))
  console.log('[modern 2026-07-28] call ok:', JSON.stringify(status.content).includes('lastRound'))
  await client.close()
}

// --- legacy client (v1 SDK, 2025-era protocol) ---
{
  const client = new LegacyClient({ name: 'legacy-client', version: '0.0.0' })
  await client.connect(new LegacyTransport(url))
  const tools = await client.listTools()
  const status = await client.callTool({ name: 'get_network_status', arguments: {} })
  console.log('[legacy 2025-era ] tools:', tools.tools.map((t) => t.name).join(','))
  console.log(
    '[legacy 2025-era ] call ok:',
    JSON.stringify(status.content).includes('lastRound'),
  )
  await client.close()
}
