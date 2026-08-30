/**
 * The fallback for any tool result: the output as JSON, the error state
 * plain. Render this when no dedicated component claims the tool's view.
 */
import type { AgentEvent } from '@initlabs/vibekit/agent'

export type ToolResultProps = Pick<Extract<AgentEvent, { type: 'tool-result' }>, 'toolName' | 'output' | 'isError'> & {
  className?: string
}

export function ToolResult({ toolName, output, isError, className = '' }: ToolResultProps) {
  const error = isError ? (output as { error?: { code?: string; message?: string } })?.error : undefined
  return (
    <section className={`vk-result${isError ? ' vk-result-error' : ''} ${className}`} data-tool={toolName}>
      <header className="vk-kicker">{toolName}</header>
      {error ? (
        <p className="vk-error">
          {error.code ? <code>{error.code}</code> : null} {error.message ?? 'failed'}
        </p>
      ) : (
        <pre className="vk-json">{JSON.stringify(output, null, 2)}</pre>
      )}
    </section>
  )
}
