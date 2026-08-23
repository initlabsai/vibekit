/**
 * Packs every publishable package and builds the out-of-workspace consumer
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

const PACKABLE = [
  'core',
  'tools',
  'mcp',
  'agent',
  'signer-keystore',
  'plugin-nfd',
  'plugin-alpha-arcade',
  'plugin-vestige',
  'plugin-pera',
  'preset',
]

await $`bunx turbo run build`.cwd(ROOT).quiet()

rmSync(TARBALLS, { recursive: true, force: true })
mkdirSync(TARBALLS, { recursive: true })
for (const name of PACKABLE) {
  await $`bun pm pack --destination ${TARBALLS}`.cwd(join(ROOT, 'packages', name)).quiet()
}

const dependencies: Record<string, string> = {
  // Peers the packages declare; the consumer must provide them, like any real user.
  algosdk: '3.7.0',
  zod: '^4.4.3',
}
for (const file of readdirSync(TARBALLS).sort()) {
  const match = /^(initlabs-vibekit-.+)-\d+\.\d+\.\d+\.tgz$/.exec(file)
  if (!match) continue
  dependencies[`@initlabs/${match[1]!.replace('initlabs-', '')}`] = `file:tarballs/${file}`
}

// Overrides pin the packages' own @initlabs peer references to the
// tarballs; without them the installer resolves those peers against the
// registry, where nothing is published yet.
const overrides = Object.fromEntries(
  Object.entries(dependencies).filter(([name]) => name.startsWith('@initlabs/')),
)

writeFileSync(
  join(CONSUMER, 'package.json'),
  JSON.stringify(
    {
      name: 'vibekit-packed-consumer',
      private: true,
      type: 'module',
      dependencies,
      devDependencies: { typescript: '^5.7.0', '@types/bun': '^1.2.0' },
      overrides,
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

console.log('verify-packed: all packed packages compile and run in an out-of-workspace consumer')
