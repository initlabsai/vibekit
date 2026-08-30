import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@initlabs/vibekit/views'],
  // The DeFi SDKs stay Node modules: bundling them re-resolves their algokit peer to the
  // wrong major and trips Turbopack's export analysis.
  serverExternalPackages: [
    '@alpha-arcade/sdk',
    '@txnlab/haystack-router',
    '@algorandfoundation/algokit-utils',
  ],
  // Turbo owns the workspace typecheck; Next's Bun-spawned type worker exits
  // without diagnostics in this monorepo, so production builds use that gate.
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
