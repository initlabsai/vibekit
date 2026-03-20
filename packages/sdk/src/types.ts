// ---------------------------------------------------------------------------
// Query response types
// ---------------------------------------------------------------------------

export interface QueryResult {
  text: string | null
  toolResults: ToolResult[]
  usage: Usage | null
}

export interface ToolResult {
  tool: string
  data: unknown
}

export interface Usage {
  inputTokens: number
  outputTokens: number
}

// ---------------------------------------------------------------------------
// Stream event types (NDJSON)
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { type: 'tool_call'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; data: unknown }
  | { type: 'text'; content: string }
  | { type: 'done'; usage: Usage | null }
  | { type: 'error'; error: string }

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export interface QueryOptions {
  tools?: string[]
  systemPrompt?: string
  signal?: AbortSignal
}

// ---------------------------------------------------------------------------
// Chat options
// ---------------------------------------------------------------------------

export interface ChatOptions {
  systemPrompt?: string
  tools?: string[]
}

// ---------------------------------------------------------------------------
// Client config
// ---------------------------------------------------------------------------

export interface VibeKitConfig {
  apiKey: string
  baseUrl?: string
}

// ---------------------------------------------------------------------------
// Alpha Arcade domain types (derived from @vibekit/alpha-arcade)
// ---------------------------------------------------------------------------

export type {
  FormattedMarket as Market,
  FormattedOrderbook as Orderbook,
  FormattedPosition as WalletPosition,
  FormattedOpenOrder as OpenOrder,
} from './generated/alpha-arcade'

import type {
  FormattedMarket,
  FormattedOrderbook,
  FormattedPosition,
  FormattedOpenOrder,
} from './generated/alpha-arcade'

// ---------------------------------------------------------------------------
// Tool output map — maps tool names to their result shapes
// ---------------------------------------------------------------------------

export interface ToolOutputMap {
  get_live_markets: { markets: FormattedMarket[] }
  get_market: FormattedMarket
  get_orderbook: FormattedOrderbook
  get_positions: { positions: FormattedPosition[] }
  get_open_orders: { orders: FormattedOpenOrder[] }
  [key: string]: unknown
}
