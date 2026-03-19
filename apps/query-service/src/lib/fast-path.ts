import { generateId, type ToolSet } from 'ai'
import type { InputHint } from './input-classifier'

export interface FastPathResult {
  call: { tool: string; args: Record<string, unknown> }
  output: unknown
}

/** Execute hint tool calls. Handles tryAll (parallel, drop errors) and sequential with NFD chaining. */
export async function executeFastPath(
  hint: InputHint,
  tools: ToolSet,
  timeoutMs: number
): Promise<FastPathResult[]> {
  if (hint.tryAll) {
    return executeTryAll(hint, tools, timeoutMs)
  }
  return executeSequential(hint, tools, timeoutMs)
}

async function executeTryAll(
  hint: InputHint,
  tools: ToolSet,
  timeoutMs: number
): Promise<FastPathResult[]> {
  const settled = await Promise.allSettled(
    hint.calls
      .filter((call) => tools[call.tool])
      .map(async (call) => {
        const output = await tools[call.tool].execute!(call.args, {
          toolCallId: generateId(),
          messages: [],
          abortSignal: AbortSignal.timeout(timeoutMs),
        })
        const isError =
          output && typeof output === 'object' && 'error' in (output as Record<string, unknown>)
        if (isError) throw new Error('Tool returned error')
        return { call, output }
      })
  )

  const results: FastPathResult[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') results.push(r.value)
  }
  return results
}

async function executeSequential(
  hint: InputHint,
  tools: ToolSet,
  timeoutMs: number
): Promise<FastPathResult[]> {
  const results: FastPathResult[] = []
  const calls = [...hint.calls]

  for (const call of calls) {
    const toolFn = tools[call.tool]
    if (!toolFn) continue

    const output = await toolFn.execute!(call.args, {
      toolCallId: generateId(),
      messages: [],
      abortSignal: AbortSignal.timeout(timeoutMs),
    })

    results.push({ call, output })

    // NFD special case: chain to address lookup after resolution
    if (
      call.tool === 'resolve_nfd' &&
      output &&
      typeof output === 'object' &&
      'address' in (output as Record<string, unknown>)
    ) {
      const address = (output as Record<string, unknown>).address as string
      if (address) {
        calls.push({ tool: 'lookup_account', args: { address } })
      }
    }
  }

  return results
}
