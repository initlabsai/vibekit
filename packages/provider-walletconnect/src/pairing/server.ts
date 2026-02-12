/**
 * Local Pairing Server
 *
 * Starts a local HTTP server to display QR codes in the browser.
 */

import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import pageHtmlPath from './page.html' with { type: "file" }
import type { Server, ServerWebSocket } from 'bun'
import type { PairingResult } from '../types/index.js'
import type { AccountInfo } from '@vibekit/provider-interface'

/** Configuration for the pairing server */
export interface PairingServerOptions {
  /** WalletConnect URI for pairing */
  uri: string
  /** QR code as data URL (PNG base64) */
  qrDataUrl: string
  /** Network being connected to */
  network: 'testnet' | 'mainnet'
  /** Wallet name for display */
  walletName: string
  /** Connection timeout in ms (default: 5 minutes) */
  timeout?: number
  /** Whether to open browser automatically (default: true) */
  openBrowser?: boolean
}

/** Active pairing server handle */
export interface PairingServer {
  /** Server URL (http://127.0.0.1:PORT) */
  url: string
  /** Server port */
  port: number
  /** Close the server */
  close(): Promise<void>
  /** Promise that resolves when wallet connects */
  onConnected: Promise<PairingResult>
  /** Signal connection success (call from WalletConnect handler) */
  signalConnected(result: PairingResult): void
  /** Signal connection error (call from WalletConnect handler) */
  signalError(error: Error): void
}

/** WebSocket data attached to each connection */
interface WebSocketData {
  token: string
}

/**
 * Start a local pairing server to display QR code in browser.
 *
 * The server:
 * 1. Serves an HTML page with the QR code
 * 2. Opens the browser automatically
 * 3. Updates the page via WebSocket when connection happens
 * 4. Shuts down automatically after connection or timeout
 *
 * @param options - Server configuration
 * @returns PairingServer handle
 */
export async function startPairingServer(options: PairingServerOptions): Promise<PairingServer> {
  const {
    uri,
    qrDataUrl,
    network,
    walletName,
    timeout = 5 * 60 * 1000,
    openBrowser = true,
  } = options

  // Generate a single-use token for access control (capability URL pattern)
  // Even though the server is localhost-only, this ensures only the intended
  // browser tab can access the pairing page and WebSocket connection
  const token = crypto.randomUUID()

  // Track connected WebSocket clients
  const wsClients = new Set<ServerWebSocket<WebSocketData>>()

  // Promise resolvers for connection result
  let resolveConnected: (result: PairingResult) => void
  let rejectConnected: (error: Error) => void

  const onConnected = new Promise<PairingResult>((resolve, reject) => {
    resolveConnected = resolve
    rejectConnected = reject
  })

  // Load HTML template (Bun embeds the file into the binary)
  const htmlTemplate = readFileSync(pageHtmlPath, 'utf-8')

  // Start server on random available port, bound to localhost only
  const server = Bun.serve<WebSocketData>({
    hostname: '127.0.0.1',
    port: 0, // Random available port
    fetch(req: Request, server: Server<WebSocketData>): Response | undefined {
      const url = new URL(req.url)

      // WebSocket upgrade
      if (url.pathname === '/ws') {
        const reqToken = url.searchParams.get('token')
        if (reqToken !== token) {
          return new Response('Forbidden', { status: 403 })
        }

        const upgraded = server.upgrade(req, {
          data: { token: reqToken },
        })
        if (upgraded) {
          return undefined // Bun handles the upgrade
        }
        return new Response('WebSocket upgrade failed', { status: 500 })
      }

      // Main page
      if (url.pathname === '/' || url.pathname === '/index.html') {
        const reqToken = url.searchParams.get('token')
        if (reqToken !== token) {
          return new Response('Forbidden - Invalid or missing token', { status: 403 })
        }

        // Inject configuration into HTML via placeholder
        const wsUrl = `ws://127.0.0.1:${server.port}/ws?token=${token}`
        const config = JSON.stringify({ uri, qrDataUrl, network, walletName, wsUrl })
        const configScript = `<script>window.__PAIRING_CONFIG__ = ${config};</script>`
        const html = htmlTemplate.replace('<!--CONFIG_PLACEHOLDER-->', configScript)

        return new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      return new Response('Not Found', { status: 404 })
    },
    websocket: {
      open(ws: ServerWebSocket<WebSocketData>) {
        wsClients.add(ws)
        // Send initial status
        ws.send(JSON.stringify({ status: 'waiting', message: 'Waiting for connection...' }))
      },
      close(ws: ServerWebSocket<WebSocketData>) {
        wsClients.delete(ws)
      },
      message() {
        // We don't expect messages from clients
      },
    },
  })

  const port = server.port!
  const serverUrl = `http://127.0.0.1:${port}/?token=${token}`

  // Set up timeout
  const timeoutId = setTimeout(() => {
    broadcast({ status: 'timeout', message: 'Connection timed out. Please try again.' })
    rejectConnected(new Error('Pairing timed out'))
    cleanup()
  }, timeout)

  // Helper to broadcast to all WebSocket clients
  function broadcast(data: { status: string; message?: string; accounts?: AccountInfo[] }) {
    const message = JSON.stringify(data)
    for (const ws of wsClients) {
      try {
        ws.send(message)
      } catch {
        // Client may have disconnected
      }
    }
  }

  // Cleanup function
  function cleanup() {
    clearTimeout(timeoutId)
    // Give clients a moment to receive final message before closing
    setTimeout(() => {
      server.stop()
    }, 500)
  }

  // Open browser
  if (openBrowser) {
    openInBrowser(serverUrl).catch(() => {
      // Browser open failed - user will need to open URL manually
      // This is handled by the MCP tool returning the URL
    })
  }

  return {
    url: serverUrl,
    port,
    async close() {
      clearTimeout(timeoutId)
      server.stop()
    },
    onConnected,
    signalConnected(result: PairingResult) {
      broadcast({ status: 'connected', accounts: result.accounts })
      resolveConnected(result)
      cleanup()
    },
    signalError(error: Error) {
      broadcast({ status: 'error', message: error.message })
      rejectConnected(error)
      cleanup()
    },
  }
}

/**
 * Open URL in the default browser.
 * Uses platform-appropriate commands.
 */
async function openInBrowser(url: string): Promise<void> {
  const platform = process.platform

  let command: string
  let args: string[]

  if (platform === 'darwin') {
    command = 'open'
    args = [url]
  } else if (platform === 'win32') {
    command = 'cmd'
    args = ['/c', 'start', '', url]
  } else {
    // Linux and others
    command = 'xdg-open'
    args = [url]
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    })

    proc.on('error', reject)
    proc.on('spawn', () => {
      proc.unref()
      resolve()
    })
  })
}
