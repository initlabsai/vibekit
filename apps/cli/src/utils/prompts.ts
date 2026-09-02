/**
 * Prompt helpers — reduce boilerplate for @clack/prompts with cancellation handling.
 */

import * as p from '@clack/prompts'

/** Handle clack cancel — exits if cancelled, returns value otherwise. */
export function handleCancel<T>(value: T | symbol, message = 'Cancelled.'): T {
  if (p.isCancel(value)) {
    p.cancel(message)
    process.exit(0)
  }
  return value
}

export async function confirm(message: string, initialValue = false): Promise<boolean> {
  return handleCancel(await p.confirm({ message, initialValue })) as boolean
}

export async function select<T extends Parameters<typeof p.select>[0]>(
  options: T,
): Promise<T['options'][number]['value']> {
  return handleCancel(await p.select(options)) as T['options'][number]['value']
}

export async function text(options: Parameters<typeof p.text>[0]): Promise<string> {
  return handleCancel(await p.text(options)) as string
}

export async function multiselect<T extends Parameters<typeof p.multiselect>[0]>(
  options: T,
): Promise<T['options'][number]['value'][]> {
  return handleCancel(await p.multiselect(options)) as T['options'][number]['value'][]
}

/** Filesystem path input with tab completion. */
export async function path(options: Parameters<typeof p.path>[0]): Promise<string> {
  return handleCancel(await p.path(options)) as string
}
