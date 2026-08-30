/**
 * The share poster. The URL is a content hash, so the image is immutable:
 * X caches it per unique URL and the CDN serves later crawls from the edge.
 */
import { ImageResponse } from 'next/og'

import { ogFonts } from '../../../src/og-fonts'
import { ShareCard } from '../../../src/share-card'
import { readShare } from '../../api/share/store'

export const alt = 'A qt314 exchange — she reads Algorand for you.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params
  const payload = /^[0-9a-f]{12}$/.test(hash) ? await readShare(hash) : undefined
  if (!payload)
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0b0e', color: '#8e8476', fontSize: 40 }}>
          this share has expired
        </div>
      ),
      { ...size, fonts: await ogFonts() },
    )
  return new ImageResponse(<ShareCard payload={payload} />, {
    ...size,
    fonts: await ogFonts(),
    headers: { 'cache-control': 'public, max-age=31536000, immutable' },
  })
}
