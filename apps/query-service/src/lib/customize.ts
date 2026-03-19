import type { ToolSet } from 'ai'
import { SYSTEM_PROMPT } from './system-prompt'

const MAX_SYSTEM_PROMPT_LENGTH = 2000

/**
 * Filter the full tool set down to a subset by name.
 * Returns all tools if no filter is provided.
 */
export function filterTools(allTools: ToolSet, toolNames?: string[]): ToolSet {
  if (!toolNames || !Array.isArray(toolNames) || toolNames.length === 0) {
    return allTools
  }

  const filtered: ToolSet = {}
  for (const name of toolNames) {
    if (typeof name === 'string' && allTools[name]) {
      filtered[name] = allTools[name]
    }
  }

  if (Object.keys(filtered).length === 0) {
    return allTools
  }

  return filtered
}

/**
 * Build the final system prompt by appending the consumer's custom instructions.
 * The base prompt is always included — consumers can only append, not replace.
 */
export function buildSystemPrompt(append?: string): string {
  if (!append || typeof append !== 'string') {
    return SYSTEM_PROMPT
  }

  const trimmed = append.trim().slice(0, MAX_SYSTEM_PROMPT_LENGTH)
  return `${SYSTEM_PROMPT}\n\n## Consumer-specific instructions\n\n${trimmed}`
}
