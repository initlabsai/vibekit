/**
 * The share poster, 1200×630, on the palette of `app/opengraph-image.tsx`:
 * the question, her line, and the evidence. Satori constraints throughout —
 * inline styles, explicit flex on every container, text nodes only. No
 * record-derived URL ever reaches it.
 */
import { evidenceFor, type SharePayload } from './share'
import { COLORS } from './theme'

const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`

const GRID = 'rgba(42,39,35,.55)'

export function ShareCard({ payload }: { payload: SharePayload }) {
  const last = payload.blocks.at(-1)
  const evidence = last ? evidenceFor(last) : undefined
  const rest = payload.blocks.slice(0, -1).map((block) => block.view.view.toUpperCase())
  const chips = rest.slice(-3)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: COLORS.background,
        color: COLORS.text,
        fontFamily: 'JetBrains Mono, monospace',
        padding: '44px 60px',
        position: 'relative',
      }}
    >
      {/* the grid the feed sits on */}
      {Array.from({ length: 11 }, (_, i) => (
        <div key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: 100 + i * 100, width: 1, background: GRID, display: 'flex' }} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <div key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: 90 + i * 100, height: 1, background: GRID, display: 'flex' }} />
      ))}

      {/* header: the question left, the network chip right — the same row as prompt-line */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
          <span style={{ color: COLORS.brassBright, marginRight: 14 }}>›</span>
          <span>{clip(payload.prompt, 72)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 20,
            letterSpacing: 3,
            color: payload.network === 'mainnet' ? COLORS.red : payload.network === 'testnet' ? COLORS.brass : COLORS.signal,
            border: `1px solid ${COLORS.borderSoft}`,
            padding: '6px 14px',
          }}
        >
          {payload.network.toUpperCase()}
        </div>
      </div>

      {/* her line */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, margin: '18px 0' }}>
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 500, color: COLORS.brassBright, textShadow: '0 0 24px rgba(255,180,84,.55)' }}>(^‿^)</div>
        <div style={{ display: 'flex', fontSize: 27, lineHeight: 1.45, color: COLORS.text, maxWidth: 900 }}>
          {clip(payload.reply, 200)}
        </div>
      </div>

      {/* evidence: the last card, then a chip strip naming the rest */}
      {evidence ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(17,19,24,.9)',
            border: `1px solid ${COLORS.borderSoft}`,
            borderLeft: `2px solid ${COLORS.brassBright}`,
            padding: '20px 26px',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', fontSize: 19, letterSpacing: 4, color: COLORS.brass }}>{evidence.kicker}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {evidence.facts.slice(0, 4).map(([label, value]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: COLORS.muted, fontSize: 16, letterSpacing: 1 }}>{label}</span>
                <span style={{ color: COLORS.text, fontSize: 21 }}>{clip(value, 34)}</span>
              </div>
            ))}
          </div>
          {evidence.listName ? (
            <div style={{ display: 'flex', fontSize: 17, color: COLORS.muted }}>
              {evidence.listName} · {evidence.listCount} rows
            </div>
          ) : null}
          {chips.length > 0 ? (
            <div style={{ display: 'flex', gap: 12, fontSize: 15, letterSpacing: 2, color: COLORS.faint }}>
              {chips.join(' · ')}
              {rest.length > chips.length ? ` · +${rest.length - chips.length}` : ''}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex' }} />
      )}

      {/* footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 20, letterSpacing: 2, marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', color: COLORS.faint, letterSpacing: 5, fontSize: 19 }}>
          <span style={{ color: COLORS.brass, marginRight: 12 }}>◆</span>
          <span>QT314</span>
          <span style={{ color: COLORS.brassBright, fontWeight: 700, marginLeft: 10 }}>AGENT</span>
        </div>
        <div style={{ display: 'flex', color: COLORS.signal }}>qt314.ai</div>
      </div>
    </div>
  )
}
