import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { cn } from '@/lib/utils'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'VibeKit Explorer',
  description: 'AI-powered Algorand blockchain explorer',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'VibeKit Explorer',
    description: 'AI-powered Algorand blockchain explorer',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VibeKit Explorer',
    description: 'AI-powered Algorand blockchain explorer',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('dark', inter.variable, jetbrainsMono.variable)}>
      <body className="font-sans bg-algo-dark text-algo-text antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
