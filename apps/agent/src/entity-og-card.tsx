/**
 * The entity poster, 1200×630, on the ShareCard's visual language: grid
 * ground, kicker + network chip, one big headline fact, a fact panel, the
 * brand footer. Satori constraints throughout — inline styles, explicit flex
 * on every container, text nodes only.
 */
import type { EntityCardModel } from './entity-og'
import { COLORS } from './theme'
import { shorten } from './theme'

const GRID = 'rgba(42,39,35,.55)'

const networkColor = (network: string): string =>
  network === 'mainnet' ? COLORS.red : network === 'testnet' ? COLORS.brass : COLORS.signal

function Frame({ children, network }: { children: React.ReactNode; network?: string }) {
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
      {Array.from({ length: 11 }, (_, i) => (
        <div
          key={`v${i}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 100 + i * 100,
            width: 1,
            background: GRID,
            display: 'flex',
          }}
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={`h${i}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 90 + i * 100,
            height: 1,
            background: GRID,
            display: 'flex',
          }}
        />
      ))}
      {children}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 20,
          letterSpacing: 2,
          marginTop: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: COLORS.faint,
            letterSpacing: 5,
            fontSize: 19,
          }}
        >
          <span style={{ color: COLORS.brass, marginRight: 12 }}>◆</span>
          <span>QT314</span>
          <span style={{ color: COLORS.brassBright, fontWeight: 700, marginLeft: 10 }}>AGENT</span>
        </div>
        <div style={{ display: 'flex', color: COLORS.signal }}>qt314.ai</div>
      </div>
    </div>
  )
}

function Header({ kicker, network }: { kicker: string; network: string }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}
    >
      <div style={{ display: 'flex', fontSize: 26, letterSpacing: 6, color: COLORS.brass }}>
        {kicker}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 20,
          letterSpacing: 3,
          color: networkColor(network),
          border: `1px solid ${COLORS.borderSoft}`,
          padding: '6px 14px',
        }}
      >
        {network.toUpperCase()}
      </div>
    </div>
  )
}

function Facts({ facts }: { facts: Array<[string, string] | undefined> }) {
  const present = facts.filter((fact): fact is [string, string] => !!fact)
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 34,
        background: 'rgba(17,19,24,.9)',
        border: `1px solid ${COLORS.borderSoft}`,
        borderLeft: `2px solid ${COLORS.brassBright}`,
        padding: '22px 28px',
      }}
    >
      {present.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: COLORS.muted, fontSize: 17, letterSpacing: 1 }}>{label}</span>
          <span style={{ color: COLORS.text, fontSize: 23 }}>{value}</span>
        </div>
      ))}
    </div>
  )
}

function Headline({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '14px 0' }}>
      <div
        style={{
          display: 'flex',
          fontSize: 62,
          fontWeight: 700,
          letterSpacing: -1,
          color: COLORS.text,
          textShadow: '0 0 32px rgba(255,180,84,.25)',
        }}
      >
        {text}
      </div>
      {sub ? <div style={{ display: 'flex', fontSize: 27, color: COLORS.muted }}>{sub}</div> : null}
    </div>
  )
}

const party = (value: string): string => (value.length > 20 ? shorten(value, 16) : value)

export function EntityOgCard({ card }: { card: EntityCardModel }) {
  // Satori mishandles fragments: every branch hands Frame its children directly.
  if (card.kind === 'transaction')
    return (
      <Frame>
        <Header kicker={`${card.typeLabel} · CONFIRMED`} network={card.network} />
        <Headline
          text={card.amount ?? card.typeLabel}
          sub={
            card.to ? `${party(card.sender)}  →  ${party(card.to)}` : `from ${party(card.sender)}`
          }
        />
        <Facts
          facts={[
            card.round ? ['ROUND', String(card.round)] : undefined,
            card.time ? ['TIME', card.time] : undefined,
            ['FEE', card.fee],
            card.created ? ['CREATED', card.created] : undefined,
            ['TXN', shorten(card.id, 16)],
          ]}
        />
      </Frame>
    )
  if (card.kind === 'asset')
    return (
      <Frame>
        <Header kicker={`ASSET · ASA ${card.id}`} network={card.network} />
        <Headline text={card.name} sub={card.unitName ? `unit ${card.unitName}` : undefined} />
        <Facts
          facts={[
            ['TOTAL SUPPLY', card.total],
            ['DECIMALS', String(card.decimals)],
            ['CREATOR', shorten(card.creator, 16)],
            card.url
              ? ['URL', card.url.length > 34 ? `${card.url.slice(0, 33)}…` : card.url]
              : undefined,
          ]}
        />
      </Frame>
    )
  if (card.kind === 'application')
    return (
      <Frame>
        <Header kicker="APPLICATION" network={card.network} />
        <Headline text={`APP ${card.id}`} />
        <Facts
          facts={[
            ['CREATOR', shorten(card.creator, 16)],
            ['GLOBAL STATE', `${card.globalStateCount} entries`],
            ['SCHEMA', `${card.globalUints} uints · ${card.globalBytes} bytes`],
            card.extraPages ? ['EXTRA PAGES', String(card.extraPages)] : undefined,
          ]}
        />
      </Frame>
    )
  if (card.kind === 'address')
    return (
      <Frame>
        <Header kicker={`ADDRESS · ${card.status.toUpperCase()}`} network={card.network} />
        <Headline text={card.balance} sub={shorten(card.address, 24)} />
        <Facts
          facts={[
            ['ASSETS', `${card.assetsOptedIn} opted in`],
            ['APPS', `${card.appsOptedIn} opted in`],
            card.createdAssets || card.createdApps
              ? ['CREATED', `${card.createdAssets} assets · ${card.createdApps} apps`]
              : undefined,
          ]}
        />
      </Frame>
    )
  if (card.kind === 'group')
    return (
      <Frame>
        <Header kicker={`GROUP · ${card.count} TXNS · CONFIRMED`} network={card.network} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: 'rgba(17,19,24,.9)',
            border: `1px solid ${COLORS.borderSoft}`,
            borderLeft: `2px solid ${COLORS.brassBright}`,
            padding: '18px 26px',
            margin: '12px 0',
          }}
        >
          {card.rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 18, fontSize: 22 }}>
              <span style={{ display: 'flex', color: COLORS.brass, fontSize: 16, letterSpacing: 2, width: 190 }}>
                {row.typeLabel}
              </span>
              {row.amount ? (
                <span style={{ display: 'flex', color: COLORS.text, fontWeight: 700 }}>{row.amount}</span>
              ) : null}
              <span style={{ display: 'flex', color: COLORS.muted, fontSize: 19 }}>
                {row.to ? `${shorten(row.sender, 12)} → ${row.to.length > 16 ? shorten(row.to, 12) : row.to}` : shorten(row.sender, 12)}
              </span>
            </div>
          ))}
          {card.count > card.rows.length ? (
            <div style={{ display: 'flex', fontSize: 16, color: COLORS.faint, letterSpacing: 2 }}>
              + {card.count - card.rows.length} more
            </div>
          ) : null}
        </div>
        <Facts
          facts={[
            card.round ? ['ROUND', String(card.round)] : undefined,
            card.time ? ['TIME', card.time] : undefined,
            ['GROUP', shorten(card.id, 16)],
          ]}
        />
      </Frame>
    )
  return (
    <Frame>
      <Header kicker="BLOCK" network={card.network} />
      <Headline text={`ROUND ${card.round}`} sub={card.time} />
      <Facts
        facts={[
          ['TRANSACTIONS', String(card.txnCount)],
          card.proposer ? ['PROPOSER', shorten(card.proposer, 16)] : undefined,
        ]}
      />
    </Frame>
  )
}

/** The card for a miss or a not-yet-confirmed transaction. */
export function EntityOgMiss({
  kind,
  keyLabel,
  network,
  pending,
}: {
  kind: string
  keyLabel: string
  network: string
  pending?: boolean
}) {
  return (
    <Frame>
      <Header kicker={kind.toUpperCase()} network={network} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '14px 0' }}>
        <div
          style={{
            display: 'flex',
            fontSize: 44,
            fontWeight: 700,
            color: pending ? COLORS.brassBright : COLORS.muted,
          }}
        >
          {pending ? 'confirming…' : `no such ${kind} here`}
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: COLORS.muted }}>
          {shorten(keyLabel, 40)}
        </div>
      </div>
      <div style={{ display: 'flex' }} />
    </Frame>
  )
}
