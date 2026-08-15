import { homedir } from 'os'
import { join, resolve } from 'path'

/** Expand a leading ~ and resolve to an absolute path. */
export function expandPath(inputPath: string): string {
  let expanded = inputPath
  if (expanded === '~') {
    expanded = homedir()
  } else if (expanded.startsWith('~/')) {
    expanded = join(homedir(), expanded.slice(2))
  }
  return resolve(expanded)
}
