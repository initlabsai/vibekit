import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@vibekit/core', '@vibekit/network', '@vibekit/accounts', '@vibekit/assets', '@vibekit/contracts', '@vibekit/transactions', '@vibekit/nfd'],
}

export default nextConfig
