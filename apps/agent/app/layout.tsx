import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { ShellMount } from '../src/shell-mount'
import './styles.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://agent.getvibekit.ai'),
  title: 'VibeKit Agent',
  description: 'qt314 reads Algorand for you: live chain data as cards, a compose-only write flow, your wallet signs.',
  openGraph: {
    title: 'VibeKit Agent — qt314',
    description: 'She reads Algorand for you. Ask anything, paste an id, or / for commands.',
    url: 'https://agent.getvibekit.ai',
    siteName: 'VibeKit Agent',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'VibeKit Agent — qt314', description: 'She reads Algorand for you.' },
}

/** Fonts and tokens; the shell (top bar, session nav, composer) persists across every route. */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ShellMount>{children}</ShellMount>
      </body>
    </html>
  )
}
