import type { NfdApiClient } from '@txnlab/nfd-sdk'

/** Pick well-known social/profile fields from NFD properties. */
function extractProperties(properties?: {
  internal?: Record<string, string>
  userDefined?: Record<string, string>
  verified?: Record<string, string>
}) {
  if (!properties) return undefined

  const v = properties.verified ?? {}
  const u = properties.userDefined ?? {}

  const picked: Record<string, string> = {}

  // Verified socials / contact
  for (const key of ['twitter', 'discord', 'telegram', 'github', 'email', 'domain', 'blueskydid', 'nostrpubkey'] as const) {
    if (v[key]) picked[key] = v[key]
  }

  // User-defined profile fields (avatar, bio, website, name)
  for (const key of ['avatar', 'bio', 'website', 'name'] as const) {
    if (u[key] && !picked[key]) picked[key] = u[key]
  }

  // Convert IPFS avatar URL to HTTPS so the frontend can use it directly
  if (picked.avatar?.startsWith('ipfs://')) {
    picked.avatar = picked.avatar.replace('ipfs://', 'https://images.nf.domains/ipfs/')
  }

  return Object.keys(picked).length > 0 ? picked : undefined
}

export async function resolveNfd(api: NfdApiClient, args: { name: string }) {
  const nfd = await api.resolve(args.name, { view: 'full' })
  return {
    name: nfd.name,
    address: nfd.depositAccount ?? nfd.owner,
    owner: nfd.owner,
    appId: nfd.appID,
    state: nfd.state,
    properties: extractProperties(nfd.properties),
  }
}

export async function reverseResolveNfd(api: NfdApiClient, args: { address: string }) {
  const result = await api.reverseLookup([args.address], { view: 'full' })
  const nfd = result[args.address]
  if (!nfd) return { address: args.address, name: null }
  return {
    address: args.address,
    name: nfd.name,
    appId: nfd.appID,
    properties: extractProperties(nfd.properties),
  }
}
