/**
 * The app's card: qt314, large, on the ground color. Rendered once at build
 * by Next, with the vendored JetBrains Mono.
 */
import { ImageResponse } from 'next/og'

import { ogFonts } from '../src/og-fonts'

export const alt = 'qt314 — VibeKit Agent. She reads Algorand for you.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0a0b0e',
          color: '#e8e2d6',
          fontFamily: 'JetBrains Mono, monospace',
          padding: '56px 72px',
          position: 'relative',
        }}
      >
        {/* the grid the feed sits on */}
        {Array.from({ length: 11 }, (_, i) => (
          <div key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: 100 + i * 100, width: 1, background: 'rgba(42,39,35,.55)' }} />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <div key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: 90 + i * 100, height: 1, background: 'rgba(42,39,35,.55)' }} />
        ))}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 26, letterSpacing: 6, color: '#605c56' }}>
          <span style={{ color: '#c4a06a', marginRight: 14 }}>◆</span>
          <span>VIBEKIT</span>
          <span style={{ color: '#ffb454', fontWeight: 700, marginLeft: 14 }}>AGENT</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 64 }}>
          <div style={{ display: 'flex', fontSize: 168, fontWeight: 500, color: '#ffb454', textShadow: '0 0 48px rgba(255,180,84,.55)', letterSpacing: -4 }}>(^‿^)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, letterSpacing: -3 }}>
              <span>hi. i&apos;m&nbsp;</span>
              <span style={{ color: '#ffb454' }}>qt314</span>
              <span>.</span>
            </div>
            <div style={{ display: 'flex', fontSize: 34, color: '#8e8476', letterSpacing: -1 }}>i read algorand for you.</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 24, color: '#6fd3d3', letterSpacing: 2 }}>
          <span>agent.getvibekit.ai</span>
          <span style={{ color: '#605c56' }}>ask anything, paste an id, or / for commands</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
