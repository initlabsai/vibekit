/**
 * Once-a-day check for a newer release, printed as one dim line on exit.
 * Never blocks a command: the cached answer is free, a stale cache costs one
 * capped fetch, and any failure is silently cached so offline runs stay fast.
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'

import pc from 'picocolors'
import { vibekitConfigPath } from '@initlabs/vibekit/agent/config'

import { writeJsonFile } from './utils/files.js'
import { VERSION } from './version.js'

const TTL_MS = 24 * 60 * 60 * 1000
// Not /releases/latest: that endpoint hides prereleases, and alphas are the product.
const RELEASE_URL = 'https://api.github.com/repos/initlabsai/vibekit/releases?per_page=1'

interface Cache {
  checkedAt: number
  latest: string
}

function cachePath(): string {
  return join(dirname(vibekitConfigPath()), 'update-check.json')
}

function readCache(): Cache | null {
  try {
    const raw = JSON.parse(readFileSync(cachePath(), 'utf-8')) as Cache
    return typeof raw.checkedAt === 'number' && typeof raw.latest === 'string' ? raw : null
  } catch {
    return null
  }
}

async function fetchLatest(): Promise<string | null> {
  try {
    const res = await fetch(RELEASE_URL, { signal: AbortSignal.timeout(1500) })
    if (!res.ok) return null
    const [release] = (await res.json()) as { tag_name?: string }[]
    return typeof release?.tag_name === 'string' ? release.tag_name.replace(/^v/, '') : null
  } catch {
    return null
  }
}

/** The nudge line when a newer release exists, else null. Consults the cache, fetching at most daily. */
export async function updateNudge(): Promise<string | null> {
  const cached = readCache()
  let latest = cached?.latest
  if (!cached || Date.now() - cached.checkedAt > TTL_MS) {
    // A failed fetch still refreshes the timestamp, so offline runs don't
    // pay the timeout every time.
    latest = (await fetchLatest()) ?? latest ?? VERSION
    await writeJsonFile(cachePath(), { checkedAt: Date.now(), latest } satisfies Cache)
  }

  if (!latest || Bun.semver.order(latest, VERSION) !== 1) return null
  const cmd =
    process.platform === 'win32'
      ? 'irm https://getvibekit.ai/alpha.ps1 | iex'
      : 'curl -fsSL https://getvibekit.ai/alpha | sh'
  return `vibekit ${latest} is out (you have ${VERSION}) — upgrade: ${cmd}`
}

/** Print the upgrade nudge if a newer release exists. Call once, right before exit. */
export async function notifyIfOutdated(): Promise<void> {
  if (process.env.CI || process.env.VIBEKIT_NO_UPDATE_CHECK || !process.stderr.isTTY) return
  const nudge = await updateNudge()
  if (nudge) console.error(pc.dim(`\n${nudge}`))
}
