import { homedir } from 'os'
import { basename, extname, join, resolve } from 'path'

/**
 * The on-disk path of the running CLI. A bun-compiled binary reports its
 * embedded entry (/$bunfs/root/...) as argv[1] — never write that; the real
 * binary is execPath. From source, argv[1] is the dev entry, so callers pass
 * the fallback they mean: a shim that tracks the tree, or bin/vibekit.
 */
export function resolveVibekitPath(
  argv1: string | undefined,
  execPath: string,
  devFallback: string,
): string {
  if (argv1?.startsWith('/$bunfs')) return execPath
  if (argv1 && basename(argv1, extname(argv1)) === 'vibekit') return argv1
  return devFallback
}

/** Expand a leading ~ and resolve to an absolute path. */
export function expandPath(inputPath: string): string {
  let expanded = inputPath
  if (expanded === '~') {
    expanded = homedir()
  } else if (expanded.startsWith('~/') || expanded.startsWith('~\\')) {
    expanded = join(homedir(), expanded.slice(2))
  }
  return resolve(expanded)
}
