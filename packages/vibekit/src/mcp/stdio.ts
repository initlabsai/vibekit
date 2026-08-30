import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio'
import { createMcpServerFactory } from './index.js'
import type { VibekitMcpOptions } from './options.js'

/** Serve over stdio (local agents). Legacy 2025-era clients are bridged by the SDK default. */
export function serveMcpStdio(options: VibekitMcpOptions): StdioServerHandle {
  return serveStdio(createMcpServerFactory(options))
}
