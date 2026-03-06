import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Algorand Explorer',
  description: 'AI-powered Algorand blockchain explorer',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-algo-dark text-algo-text antialiased min-h-screen">{children}</body>
    </html>
  )
}
