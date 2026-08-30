/**
 * REST over the tool contract: `POST …/query/<name>` with the tool's
 * arguments as the JSON body returns its result. Actions return the draft
 * (an unsigned group) and never sign — the same compose rule as MCP over
 * HTTP. Put a paywall's `charge` in front of it when turns cost money.
 */
import { z } from 'zod'

import {
  executeToolCall,
  isAction,
  jsonSafe,
  resolveDeployment,
  ToolError,
  type DeploymentOptions,
} from '../core/index.js'

export interface QueryHandler {
  /** Runs the named tool with the request's JSON body as arguments. */
  call(toolName: string, request: Request): Promise<Response>
  /** The catalogue: every tool's name, description, kind, and input schema (JSON Schema). */
  catalogue(): { name: string; description: string; kind: 'query' | 'action'; parameters: unknown }[]
}

const json = (status: number, body: unknown) => Response.json(body, { status })

export function createQueryHandler(options: DeploymentOptions): QueryHandler {
  const deployment = resolveDeployment(options)
  return {
    async call(toolName, request) {
      const tool = deployment.tools.find((candidate) => candidate.name === toolName)
      if (!tool) return json(404, { error: `No tool named ${toolName}` })
      let args: unknown = {}
      const text = await request.text()
      if (text.trim()) {
        try {
          args = JSON.parse(text)
        } catch {
          return json(400, { error: 'Malformed JSON body' })
        }
      }
      try {
        return json(200, { tool: toolName, ...(tool.view ? { view: tool.view } : {}), result: jsonSafe(await executeToolCall(deployment, tool, args)) })
      } catch (error) {
        if (error instanceof ToolError) return json(error.code === 'INVALID_ARGS' || error.code === 'UNKNOWN_NETWORK' ? 400 : 502, { error: error.message, code: error.code })
        return json(500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
    catalogue: () =>
      deployment.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        kind: isAction(tool) ? 'action' : 'query',
        parameters: z.toJSONSchema(tool.parameters),
      })),
  }
}
