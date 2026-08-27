/**
 * Packs the publishable package and builds the out-of-workspace consumer
 * fixture against the tarballs, so workspace resolution cannot hide a
 * packaging defect (broken exports map, missing dist file, bad types).
 * Run from the repo root: `bun run verify:packed`.
 */
import { $ } from 'bun'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const CONSUMER = join(ROOT, 'verify/packed-consumer')
const TARBALLS = join(CONSUMER, 'tarballs')

await $`bunx turbo run build`.cwd(ROOT).quiet()

rmSync(TARBALLS, { recursive: true, force: true })
mkdirSync(TARBALLS, { recursive: true })
await $`bun pm pack --destination ${TARBALLS}`.cwd(join(ROOT, 'packages/vibekit')).quiet()

const dependencies: Record<string, string> = {
  // Peers the package declares; the consumer must provide them, like any real user.
  algosdk: '3.7.0',
  zod: '^4.4.3',
}
const tarball = readdirSync(TARBALLS).find((f) => f.endsWith('.tgz'))
if (!tarball) throw new Error('verify-packed: bun pm pack produced no tarball')
dependencies['@initlabs/vibekit'] = `file:tarballs/${tarball}`

writeFileSync(
  join(CONSUMER, 'package.json'),
  JSON.stringify(
    {
      name: 'vibekit-packed-consumer',
      private: true,
      type: 'module',
      dependencies,
      devDependencies: { typescript: '^5.7.0', '@types/bun': '^1.2.0' },
    },
    null,
    2,
  ),
)

rmSync(join(CONSUMER, 'node_modules'), { recursive: true, force: true })
rmSync(join(CONSUMER, 'bun.lock'), { force: true })
await $`bun install`.cwd(CONSUMER).quiet()
await $`bunx tsc -p tsconfig.json`.cwd(CONSUMER)
await $`bun run consumer.ts`.cwd(CONSUMER)

console.log('verify-packed: the packed package compiles and runs in an out-of-workspace consumer')
