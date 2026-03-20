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
// Alpha Arcade domain types
// ---------------------------------------------------------------------------

export interface Market {
  id: string
  title: string
  description?: string
  category?: string
  status?: string
  outcomes?: Outcome[]
  [key: string]: unknown
}

export interface Outcome {
  id: string
  title: string
  price?: number
  [key: string]: unknown
}

export interface Orderbook {
  marketId: string
  bids?: OrderbookEntry[]
  asks?: OrderbookEntry[]
  [key: string]: unknown
}

export interface OrderbookEntry {
  price: number
  quantity: number
  [key: string]: unknown
}

export interface WalletPosition {
  marketId: string
  outcomeId: string
  shares: number
  [key: string]: unknown
}

export interface OpenOrder {
  orderId: string
  marketId: string
  side: string
  price: number
  quantity: number
  [key: string]: unknown
}
