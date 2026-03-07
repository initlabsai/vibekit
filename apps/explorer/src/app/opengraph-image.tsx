import { ImageResponse } from 'next/og'

export const alt = 'VibeKit Explorer — AI-powered Algorand blockchain explorer'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ASCII_LINES = [
  '██    ██ ██ ██████  ███████ ██   ██ ██ ████████',
  '██    ██ ██ ██   ██ ██      ██  ██  ██    ██   ',
  '██    ██ ██ ██████  █████   █████   ██    ██   ',
  ' ██  ██  ██ ██   ██ ██      ██  ██  ██    ██   ',
  '  ████   ██ ██████  ███████ ██   ██ ██    ██   ',
]

async function loadFonts() {
  const [interBold, jetbrainsMono] = await Promise.all([
    fetch(
      'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf'
    ).then((res) => res.arrayBuffer()),
    fetch(
      'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8L6tjPQ.ttf'
    ).then((res) => res.arrayBuffer()),
  ])
  return { interBold, jetbrainsMono }
}

export default async function Image() {
  const { interBold, jetbrainsMono } = await loadFonts()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#121212',
          padding: '32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid #2a2a2a',
          }}
        >
          {/* Title bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '14px 20px',
              backgroundColor: '#1a1a1a',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff5f57' }} />
              <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#febc2e' }} />
              <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#28c840' }} />
            </div>
            <div
              style={{
                marginLeft: '12px',
                fontSize: '14px',
                color: '#888',
                fontFamily: 'Inter',
              }}
            >
              vibekit
            </div>
          </div>

          {/* Terminal body */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              backgroundColor: '#171717',
              padding: '40px',
              gap: '32px',
            }}
          >
            {/* ASCII logo */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              {ASCII_LINES.map((line, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '24px',
                    lineHeight: '1.1',
                    color: '#5de4c7',
                    fontFamily: 'JetBrains Mono',
                    letterSpacing: '-1px',
                    whiteSpace: 'pre',
                  }}
                >
                  {line}
                </div>
              ))}
            </div>

            {/* Text */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: '#ffffff',
                  fontFamily: 'Inter',
                }}
              >
                VibeKit Explorer
              </div>
              <div
                style={{
                  fontSize: '20px',
                  color: '#888888',
                  fontFamily: 'Inter',
                }}
              >
                AI-powered Algorand blockchain explorer
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: interBold, style: 'normal' as const, weight: 700 as const },
        {
          name: 'JetBrains Mono',
          data: jetbrainsMono,
          style: 'normal' as const,
          weight: 700 as const,
        },
      ],
    }
  )
}
