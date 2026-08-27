import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@initlabs/vibekit-explorer'],
  // Turbo owns the workspace typecheck; Next's Bun-spawned type worker exits
  // without diagnostics in this monorepo, so production builds use that gate.
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
