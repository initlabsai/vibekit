import { readFileSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { dirname } from 'path'

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDir(dirname(filePath))
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath))
  await writeFile(filePath, content, 'utf-8')
}

/**
 * Append `block` to an existing file unless `marker` already appears in it —
 * the guard is what makes re-running init idempotent.
 */
export async function appendIfMissing(
  filePath: string,
  marker: string,
  block: string,
): Promise<boolean> {
  const existing = readFileSync(filePath, 'utf-8')
  if (existing.includes(marker)) return false
  await writeTextFile(filePath, `${existing.trimEnd()}\n\n${block}\n`)
  return true
}
