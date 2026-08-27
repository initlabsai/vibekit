/**
 * The orchestrator's stream protocol. Every head (TUI, hosted API, web agent)
 * renders from these events (streaming text, tool activity, results with
 * their view cues), never from per-tool knowledge of its own.
 */
export type AgentEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'tool-call'; id: string; toolName: string; input: unknown }
  | {
      type: 'tool-result'
      id: string
      toolName: string
      /** The arguments the model passed (includes `network` on multi-network deployments). */
      input?: unknown
      /** JSON-safe tool output; on isError, `{ error: { code, message } }`. */
      output: unknown
      /** The tool's declared view cue: a semantic Explorer id or a coarse hint. */
      view?: string
      isError: boolean
    }
  | { type: 'error'; message: string }
  | { type: 'finish'; finishReason: string; usage?: { inputTokens?: number; outputTokens?: number } }

/** The error payload tool failures produce (returned to the model, not thrown). */
export interface ToolErrorOutput {
  error: { code: string; message: string }
}

export function isToolErrorOutput(output: unknown): output is ToolErrorOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    'error' in output &&
    typeof (output as { error: unknown }).error === 'object'
  )
}
