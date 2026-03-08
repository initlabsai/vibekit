import type { NfdApiClient } from '@txnlab/nfd-sdk'

/** Convert an ipfs:// URL to an HTTPS gateway URL. Returns the input unchanged if not IPFS. */
function ipfsToHttps(url: string): string {
  return url.startsWith('ipfs://') ? url.replace('ipfs://', 'https://images.nf.domains/ipfs/') : url
}

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
  if (picked.avatar) picked.avatar = ipfsToHttps(picked.avatar)

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

export async function batchReverseResolveNfd(
  api: NfdApiClient,
  args: { addresses: string[] }
) {
  const result = await api.reverseLookup(args.addresses, { view: 'thumbnail' })
  return {
    results: args.addresses.map((address) => {
      const nfd = result[address]
      if (!nfd) return { address, name: null }
      const avatar = nfd.properties?.userDefined?.avatar
      return { address, name: nfd.name, avatar: avatar ? ipfsToHttps(avatar) : undefined }
    }),
  }
}
