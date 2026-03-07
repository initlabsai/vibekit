import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@vibekit/indexer', '@vibekit/nfd'],
}

export default nextConfig
