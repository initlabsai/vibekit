/**
 * `vibekit add <component…>` — copies a component's source into the project,
 * ShadCN-style: the files are yours after that. No registry, no network.
 */
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'

import { BUNDLED_COMPONENTS } from './bundled.js'

export interface BundledComponent {
  name: string
  description: string
  files: Array<{ path: string; content: string }>
}

export function listComponents(): BundledComponent[] {
  return BUNDLED_COMPONENTS
}

export interface AddResult {
  written: string[]
  /** Files that already existed with different content and were left alone (no --force). */
  kept: string[]
  /** Files that already existed with identical content. */
  unchanged: string[]
}

/** Writes the named components' files under `dir`. Refuses to overwrite a differing file unless `force`. */
export async function addComponents(names: string[], dir: string, force = false): Promise<AddResult> {
  const unknown = names.filter((name) => !BUNDLED_COMPONENTS.some((component) => component.name === name))
  if (unknown.length) {
    throw new Error(`Unknown component${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Available: ${BUNDLED_COMPONENTS.map((c) => c.name).join(', ')}`)
  }
  const result: AddResult = { written: [], kept: [], unchanged: [] }
  const seen = new Set<string>()
  for (const component of BUNDLED_COMPONENTS.filter((component) => names.includes(component.name))) {
    for (const file of component.files) {
      if (seen.has(file.path)) continue
      seen.add(file.path)
      const target = resolve(dir, file.path)
      const existing = await readFile(target, 'utf-8').catch(() => undefined)
      if (existing === file.content) {
        result.unchanged.push(file.path)
        continue
      }
      if (existing !== undefined && !force) {
        result.kept.push(file.path)
        continue
      }
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, file.content)
      result.written.push(file.path)
    }
  }
  return result
}

export function parseAddArgs(args: string[]): { names: string[]; dir: string; force: boolean; list: boolean } {
  const names: string[] = []
  let dir = 'components'
  let force = false
  let list = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--force' || arg === '-f') force = true
    else if (arg === '--list' || arg === '-l') list = true
    else if (arg === '--dir' || arg === '-d') dir = args[++i] ?? dir
    else if (arg.startsWith('--dir=')) dir = arg.slice('--dir='.length)
    else names.push(arg)
  }
  return { names, dir: join(dir), force, list }
}
