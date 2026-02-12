/**
 * MCP Tool Definitions and Handler
 *
 * Aggregates all tools from feature modules and routes calls to their handlers.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { McpConfig } from '../config.js'
import type { ToolContext, ToolHandler, ToolRegistration } from './types.js'
import { isResultWithImage } from './types.js'

import { contractTools } from './contracts/index.js'
import { stateTools } from './state/index.js'
import { accountTools } from './accounts/index.js'
import { assetTools } from './assets/index.js'
import { githubTools } from './github/index.js'
import { networkTools } from './network/index.js'
import { providerTools } from './provider/index.js'
import { indexerTools } from './indexer/index.js'
import { transactionTools } from './transactions/index.js'
import { utilityTools } from './utilities/index.js'
import { walletconnectTools } from './walletconnect/index.js'

// Combine all tool registrations
const allToolRegistrations: ToolRegistration[] = [
  ...contractTools,
  ...stateTools,
  ...accountTools,
  ...assetTools,
  ...networkTools,
  ...providerTools,
  ...githubTools,
  ...indexerTools,
  ...transactionTools,
  ...utilityTools,
  ...walletconnectTools,
]

// Export tool definitions for MCP server registration
export const toolDefinitions: Tool[] = allToolRegistrations.map((t) => t.definition)

// Build handler map from all registrations
const handlers: Record<string, ToolHandler> = Object.fromEntries(
  allToolRegistrations.map((t) => [t.definition.name, t.handler])
)

// MCP content block types
type TextContent = { type: 'text'; text: string }
type ImageContent = { type: 'image'; data: string; mimeType: string }
type ContentBlock = TextContent | ImageContent

interface ToolResult {
  content: ContentBlock[]
  isError?: boolean
}

/**
 * Create an image content block from a data URL.
 * Parses "data:image/png;base64,..." format into MCP image content.
 */
export function imageContent(dataUrl: string): ImageContent {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('Invalid data URL format')
  return { type: 'image', data: match[2], mimeType: match[1] }
}

export async function handleToolCall(
  request: { params: { name: string; arguments?: Record<string, unknown> } },
  algorand: AlgorandClient,
  config: McpConfig
): Promise<ToolResult> {
  const { name, arguments: args = {} } = request.params

  try {
    const handler = handlers[name]
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`)
    }

    const ctx: ToolContext = { algorand, config }
    const result = await handler(args, ctx)

    // Handle results that include image content
    if (isResultWithImage(result)) {
      const content: ContentBlock[] = [
        {
          type: 'text',
          text: JSON.stringify(result.data, bigIntReplacer, 2),
        },
        imageContent(result.imageDataUrl),
      ]
      return { content }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, bigIntReplacer, 2),
        },
      ],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Detect connection errors and provide helpful hints
    let message = errorMessage
    let hint: string | undefined

    if (
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('Unable to connect') ||
      errorMessage.includes('fetch failed')
    ) {
      hint =
        'Is localnet running? Run: algokit localnet start. ' +
        'If localnet was just started, call switch_network to refresh the connection.'
    } else if (errorMessage.includes('Vault request timed out')) {
      hint = 'Run: vibekit vault status'
    } else if (name === 'fund_account' && !errorMessage.includes('vibekit dispenser login')) {
      // Add hint for fund_account errors that don't already have the login hint
      hint = 'For testnet funding, run: vibekit dispenser login'
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message,
              hint,
              tool: name,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    }
  }
}

/**
 * JSON replacer that handles BigInt serialization.
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  return value
}
