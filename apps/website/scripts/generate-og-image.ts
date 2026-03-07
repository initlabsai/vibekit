import satori, { type SatoriNode } from 'satori'
import sharp from 'sharp'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const WIDTH = 1200
const HEIGHT = 630

const ASCII_LINES = [
  '██    ██ ██ ██████  ███████ ██   ██ ██ ████████',
  '██    ██ ██ ██   ██ ██      ██  ██  ██    ██   ',
  '██    ██ ██ ██████  █████   █████   ██    ██   ',
  ' ██  ██  ██ ██   ██ ██      ██  ██  ██    ██   ',
  '  ████   ██ ██████  ███████ ██   ██ ██    ██   ',
]

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  return res.arrayBuffer()
}

async function main() {
  const interBold = await fetchFont(
    'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf'
  )
  const interRegular = await fetchFont(
    'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf'
  )
  const jetbrainsMono = await fetchFont(
    'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8L6tjPQ.ttf'
  )

  const node: SatoriNode = {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#121212',
          padding: '32px',
        },
        children: {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid #2a2a2a',
            },
            children: [
              // Title bar
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px 20px',
                    backgroundColor: '#1a1a1a',
                    gap: '8px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', gap: '8px' },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                width: 12,
                                height: 12,
                                borderRadius: 6,
                                backgroundColor: '#ff5f57',
                              },
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                width: 12,
                                height: 12,
                                borderRadius: 6,
                                backgroundColor: '#febc2e',
                              },
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                width: 12,
                                height: 12,
                                borderRadius: 6,
                                backgroundColor: '#28c840',
                              },
                            },
                          },
                        ],
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          marginLeft: '12px',
                          fontSize: '14px',
                          color: '#888',
                          fontFamily: 'Inter',
                        },
                        children: 'vibekit',
                      },
                    },
                  ],
                },
              },
              // Terminal body
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    backgroundColor: '#171717',
                    padding: '40px',
                    gap: '32px',
                  },
                  children: [
                    // ASCII logo
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                        },
                        children: ASCII_LINES.map((line) => ({
                          type: 'div',
                          props: {
                            style: {
                              fontSize: '24px',
                              lineHeight: '1.1',
                              color: '#5de4c7',
                              fontFamily: 'JetBrains Mono',
                              letterSpacing: '-1px',
                              whiteSpace: 'pre',
                            },
                            children: line,
                          },
                        })),
                      },
                    },
                    // Text
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px',
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '32px',
                                fontWeight: 700,
                                color: '#ffffff',
                                fontFamily: 'Inter',
                              },
                              children: 'From prompt to mainnet.',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                fontSize: '20px',
                                color: '#888888',
                                fontFamily: 'Inter',
                              },
                              children: 'AI-powered Algorand smart contract development',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
  }

  const svg = await satori(node, {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
        { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
        { name: 'JetBrains Mono', data: jetbrainsMono, weight: 700, style: 'normal' },
      ],
    }
  )

  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const outputPath = join(scriptDir, '..', 'public', 'og-image.png')
  await mkdir(dirname(outputPath), { recursive: true })
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  await writeFile(outputPath, new Uint8Array(png))
  console.log(`Generated ${outputPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
