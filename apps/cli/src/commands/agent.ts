/**
 * `vibekit agent` — launch the VibeKit Agent, the web experience where you
 * explore and act on Algorand by conversation (the Lora replacement, Phase 8).
 *
 * Until the hosted product ships, this points people at the path that works
 * today: their own AI agent in a vibekit-configured directory.
 */

import pc from 'picocolors'

/** Set once the hosted VibeKit Agent is live; VIBEKIT_AGENT_URL overrides. */
const AGENT_URL: string | undefined = undefined

function openInBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  Bun.spawn([command, url], { stdout: 'ignore', stderr: 'ignore' })
}

export async function commandAgent(): Promise<void> {
  const url = process.env.VIBEKIT_AGENT_URL ?? AGENT_URL

  if (url) {
    console.log(`Opening the VibeKit Agent: ${pc.cyan(url)}`)
    openInBrowser(url)
    return
  }

  console.log(`
${pc.bold('VibeKit Agent')} — explore and act on Algorand by conversation.

The web experience hasn't shipped yet. Until it does, you already have the
same brain with better hands: any AI agent in a vibekit-configured directory.

  ${pc.cyan('vibekit init')}     configure your agent (Claude Code, Cursor, ...)
  ${pc.cyan('claude')}           then just ask — all VibeKit tools are on the MCP
`)
}
