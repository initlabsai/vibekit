/**
 * Fetch a GitHub codeload tarball and extract it into a directory.
 * Codeload is not the REST API — public-repo downloads carry no
 * unauthenticated rate limit, so no token is needed for public sources.
 */

import { mkdir } from 'fs/promises'

export async function extractTarball(
  url: string,
  targetDir: string,
  headers?: Record<string, string>,
): Promise<void> {
  const response = await fetch(url, headers ? { headers } : undefined)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch ${url} (${response.status}). Check your network connection.`)
  }

  await mkdir(targetDir, { recursive: true })

  // --strip-components=1 drops the "<repo>-<ref>/" wrapper directory
  const proc = Bun.spawn(['tar', '-xzf', '-', '--strip-components=1', '-C', targetDir], {
    stdin: response.body,
    stderr: 'pipe',
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`tar failed (exit ${exitCode}): ${stderr.trim()}`)
  }
}
