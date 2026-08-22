import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { FIXTURE_RECEIVER } from '@initlabs/vibekit-experience'

const TUI_DIR = join(import.meta.dir, '..')
const HAS_TMUX = Bun.spawnSync(['tmux', '-V']).success

const AGENT_VARS = [
  'VIBEKIT_AGENT_MODEL',
  'VIBEKIT_AGENT_PROVIDER',
  'VIBEKIT_AGENT_BASE_URL',
  'VIBEKIT_AGENT_API_KEY',
]

function tmux(args: string[]): string {
  const result = Bun.spawnSync(['tmux', '-f', '/dev/null', '-u', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) {
    throw new Error(`tmux ${args.join(' ')}: ${result.stderr.toString() || result.stdout.toString()}`)
  }
  return result.stdout.toString()
}

class TuiSession {
  readonly name: string
  private readonly tmp: string

  constructor() {
    this.tmp = mkdtempSync(join(tmpdir(), 'vibekit-tux-'))
    this.name = `vk-tux-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
    const unset = AGENT_VARS.flatMap((name) => ['-u', name])
    const command = [
      'env',
      ...unset,
      `XDG_CONFIG_HOME=${join(this.tmp, 'xdg')}`,
      `HOME=${this.tmp}`,
      'TERM=xterm-256color',
      'timeout',
      '-k',
      '2',
      '40',
      'bun',
      'run',
      'src/index.tsx',
    ].join(' ')
    tmux(['new-session', '-d', '-s', this.name, '-x', '120', '-y', '36', '-c', TUI_DIR, command])
  }

  capture(): string {
    return tmux(['capture-pane', '-t', this.name, '-p'])
  }

  send(...keys: string[]): void {
    tmux(['send-keys', '-t', this.name, ...keys])
  }

  type(text: string): void {
    tmux(['send-keys', '-t', this.name, '-l', text])
  }

  resize(cols: number, rows: number): void {
    tmux(['resize-window', '-t', this.name, '-x', String(cols), '-y', String(rows)])
  }

  async waitFor(needle: string | RegExp, ms = 10_000): Promise<string> {
    const start = Date.now()
    let last = ''
    while (Date.now() - start < ms) {
      try {
        last = this.capture()
      } catch {
        last = ''
      }
      if (typeof needle === 'string' ? last.includes(needle) : needle.test(last)) return last
      await Bun.sleep(150)
    }
    throw new Error(`Timed out waiting for ${String(needle)} in:\n${last}`)
  }

  close(): void {
    try {
      this.send('C-c')
    } catch {
      // session already gone
    }
    try {
      tmux(['kill-session', '-t', this.name])
    } catch {
      // already dead
    }
    rmSync(this.tmp, { recursive: true, force: true })
  }
}

describe('TUI tmux journeys', () => {
  let session: TuiSession | undefined
  afterEach(() => {
    session?.close()
    session = undefined
  })

  test.skipIf(!HAS_TMUX)(
    'unconfigured first run paints chrome, welcome, and a keybar',
    async () => {
      session = new TuiSession()
      const pane = await session.waitFor('set VIBEKIT_AGENT_MODEL to chat')
      expect(pane).toContain('VIBEKIT')
      expect(pane).toContain('EXPLORER')
      expect(pane).toMatch(/LOCALNET/)
      expect(pane).toMatch(/live|sample data|probing/)
      expect(pane).toContain('pay 0.5')
      expect(pane).toMatch(/\^w/)
      expect(pane).toMatch(/\^1/)
      expect(pane).toMatch(/enter send/)
    },
    { timeout: 20_000 },
  )


  test.skipIf(!HAS_TMUX)(
    'pay opens the approval modal over the feed',
    async () => {
      session = new TuiSession()
      await session.waitFor('set VIBEKIT_AGENT_MODEL to chat')
      session.type(`pay 0.5 to ${FIXTURE_RECEIVER}`)
      session.send('Enter')
      const pane = await session.waitFor(/APPROVE THIS/)
      expect(pane).toMatch(/APPROVE THIS (PAYMENT|GROUP)\?/)
      expect(pane).toMatch(/enter.*approve/i)
      expect(pane).toMatch(/esc.*deny/i)
    },
    { timeout: 20_000 },
  )

  test.skipIf(!HAS_TMUX)(
    'My Apps lists deployed, opted-in, and local-spec sections',
    async () => {
      session = new TuiSession()
      await session.waitFor('set VIBEKIT_AGENT_MODEL to chat')
      session.type('apps')
      session.send('Enter')
      const pane = await session.waitFor('MY APPS')
      expect(pane).toContain('Deployed')
      expect(pane).toContain('Opted in')
      expect(pane).toContain('Local specs')
      expect(pane).toMatch(/app \d+|No opted-in apps/)
      expect(pane).toMatch(/\[ \] cycle/)
    },
    { timeout: 20_000 },
  )

  test.skipIf(!HAS_TMUX)(
    'asset and txn shelves open from the composer commands',
    async () => {
      session = new TuiSession()
      await session.waitFor('set VIBEKIT_AGENT_MODEL to chat')
      session.type('assets')
      session.send('Enter')
      const assets = await session.waitFor('ASSET HOLDINGS')
      expect(assets).toContain('ASSETS')
      session.send('Escape')
      await session.waitFor('Algorand, by conversation')
      session.type('txns')
      session.send('Enter')
      const txns = await session.waitFor('TRANSACTIONS')
      expect(txns).toMatch(/TRANSACTIONS[\s\S]*\[esc\] chat|TRANSACTION LIST|No transactions/)
    },
    { timeout: 20_000 },
  )

  test.skipIf(!HAS_TMUX)(
    'Alt+2 opens My Apps when ctrl+digit cannot be sent',
    async () => {
      session = new TuiSession()
      await session.waitFor('set VIBEKIT_AGENT_MODEL to chat')
      session.send('M-2')
      const pane = await session.waitFor('MY APPS')
      expect(pane).toContain('Opted in')
    },
    { timeout: 20_000 },
  )

  test.skipIf(!HAS_TMUX)(
    'narrow width keeps the wordmark and a keybar',
    async () => {
      session = new TuiSession()
      await session.waitFor('set VIBEKIT_AGENT_MODEL to chat')
      session.resize(80, 24)
      await Bun.sleep(250)
      const pane = session.capture()
      expect(pane).toContain('VIBEKIT')
      expect(pane).toContain('EXPLORER')
      expect(pane).toMatch(/\^w|esc chat|enter send/)
    },
    { timeout: 20_000 },
  )
})
