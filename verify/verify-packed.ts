/**
 * Packs the publishable package and builds the out-of-workspace consumer
 * fixture against the tarballs, so workspace resolution cannot hide a
 * packaging defect (broken exports map, missing dist file, bad types).
 * Run from the repo root: `bun run verify:packed`.
 */
import { $ } from 'bun'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const CONSUMER = join(ROOT, 'verify/packed-consumer')
const TARBALLS = join(CONSUMER, 'tarballs')

await $`bunx turbo run build`.cwd(ROOT).quiet()

rmSync(TARBALLS, { recursive: true, force: true })
mkdirSync(TARBALLS, { recursive: true })
await $`bun pm pack --destination ${TARBALLS}`.cwd(join(ROOT, 'packages/vibekit')).quiet()

const manifest = JSON.parse(readFileSync(join(ROOT, 'packages/vibekit/package.json'), 'utf8')) as {
  peerDependencies: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}
const tarball = readdirSync(TARBALLS).find((f) => f.endsWith('.tgz'))
if (!tarball) throw new Error('verify-packed: bun pm pack produced no tarball')

/**
 * Two consumers, both installing the tarball like a real user. The full one
 * adds every optional peer (a batteries-included host); the light one adds
 * only the required peers and proves the optional ones stay out.
 */
const consumers = [
  { dir: 'verify/packed-consumer', peers: manifest.peerDependencies },
  {
    dir: 'verify/packed-consumer-light',
    peers: Object.fromEntries(
      Object.entries(manifest.peerDependencies).filter(
        ([name]) => !manifest.peerDependenciesMeta?.[name]?.optional,
      ),
    ),
  },
]

for (const consumer of consumers) {
  const dir = join(ROOT, consumer.dir)
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: consumer.dir.split('/').pop(),
        private: true,
        type: 'module',
        dependencies: {
          ...consumer.peers,
          '@initlabs/vibekit': `file:../packed-consumer/tarballs/${tarball}`,
        },
        devDependencies: { typescript: '^5.7.0', '@types/bun': '^1.2.0' },
      },
      null,
      2,
    ),
  )
  rmSync(join(dir, 'node_modules'), { recursive: true, force: true })
  rmSync(join(dir, 'bun.lock'), { force: true })
  await $`bun install`.cwd(dir).quiet()
  await $`bunx tsc -p tsconfig.json`.cwd(dir)
  await $`bun run consumer.ts`.cwd(dir)
}

console.log(
  'verify-packed: the packed package compiles and runs in both out-of-workspace consumers',
)
