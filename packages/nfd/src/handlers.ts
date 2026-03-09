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

  // Avatar priority: verified.avatar > verified.avatarasaid > userDefined.avatar
  if (v.avatar) {
    picked.avatar = ipfsToHttps(v.avatar)
  } else if (v.avatarasaid) {
    picked.avatar = `assetid:${v.avatarasaid}`
  } else if (u.avatar) {
    picked.avatar = ipfsToHttps(u.avatar)
  }

  // Verified socials / contact
  for (const key of ['twitter', 'discord', 'telegram', 'github', 'email', 'domain', 'blueskydid', 'nostrpubkey'] as const) {
    if (v[key]) picked[key] = v[key]
  }

  // User-defined profile fields (bio, website, name) — avatar handled above
  for (const key of ['bio', 'website', 'name'] as const) {
    if (u[key] && !picked[key]) picked[key] = u[key]
  }

  return Object.keys(picked).length > 0 ? picked : undefined
}

export async function resolveNfd(api: NfdApiClient, args: { name: string }) {
  const nfd = await api.resolve(args.name.toLowerCase(), { view: 'full' })
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
      const v = nfd.properties?.verified ?? {}
      const u = nfd.properties?.userDefined ?? {}
      let avatar: string | undefined
      if (v.avatar) avatar = ipfsToHttps(v.avatar)
      else if (v.avatarasaid) avatar = `assetid:${v.avatarasaid}`
      else if (u.avatar) avatar = ipfsToHttps(u.avatar)
      return { address, name: nfd.name, avatar }
    }),
  }
}
