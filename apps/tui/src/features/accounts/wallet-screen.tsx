import { formatMicroAlgos } from '@initlabs/vibekit/views'

import { COLORS, shorten } from '../../theme.js'

/** Keystore / sample address book: pick the active account for pay and shelves. */
export function WalletScreen({
  accounts,
  loading,
  signer,
  network,
  balances,
  activeSender,
  width,
  onSelect,
  keys,
}: {
  /** Key hints for this screen, drawn in the bottom frame line. */
  keys: string
  accounts: ReadonlyArray<{ address: string; name?: string }>
  loading: boolean
  /** down: no daemon; empty: daemon up, no keys; ready: keystore accounts. */
  signer: 'down' | 'empty' | 'ready'
  network: string
  /** address → microALGO on `network`; missing means not funded there (or still loading). */
  balances: Record<string, number | string>
  activeSender: string | undefined
  width: number
  onSelect: (address: string) => void
}) {
  const inner = Math.max(24, width - 6)
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      padding={1}
      border
      borderStyle="heavy"
      borderColor={COLORS.brass}
      title={` WALLET · ${signer === 'ready' ? 'keystore' : signer === 'empty' ? 'keystore (empty)' : 'sample'} `}
      titleColor={COLORS.brassBright}
      bottomTitle={` ${shorten(keys, Math.max(8, width - 6))} `}
      bottomTitleAlignment="right"
      backgroundColor={COLORS.background}
    >
      <text
        fg={COLORS.muted}
        content={`Active account is used for pay, assets, apps, and txns. Balances on ${network}.`}
      />
      {signer === 'down' ? (
        <text
          fg={COLORS.brass}
          marginTop={1}
          content="Keystore daemon isn't running — vibekit keystore start, then reopen the Explorer. Showing sample accounts."
        />
      ) : signer === 'empty' ? (
        <text
          fg={COLORS.brass}
          marginTop={1}
          content="No keystore accounts yet — vibekit keystore generate ed25519 --name alice, then ^w."
        />
      ) : null}
      {loading ? (
        <text fg={COLORS.muted} marginTop={1} content="Loading accounts…" />
      ) : accounts.length === 0 ? (
        <text fg={COLORS.muted} marginTop={1} content="No accounts found" />
      ) : (
        accounts.map((account, index) => {
          const selected = account.address === activeSender
          return (
            <box
              key={account.address}
              flexDirection="column"
              marginTop={1}
              paddingX={1}
              onMouseDown={() => onSelect(account.address)}
            >
              <box flexDirection="row" justifyContent="space-between" height={1}>
                <text fg={selected ? COLORS.brassBright : COLORS.text}>
                  {`${selected ? '▸' : ' '}[${index + 1}] ${account.name ?? '—'}`}
                </text>
                <box flexDirection="row" gap={2}>
                  <text
                    fg={balances[account.address] === undefined ? COLORS.faint : COLORS.brassBright}
                  >
                    {balances[account.address] === undefined
                      ? '—'
                      : `${formatMicroAlgos(balances[account.address]!)} ALGO`}
                  </text>
                  {selected ? (
                    <text fg={COLORS.ink} bg={COLORS.brass}>
                      {' ACTIVE '}
                    </text>
                  ) : null}
                </box>
              </box>
              {/* Plain text on purpose: a click here selects the account; drag still copies. */}
              <text
                fg={selected ? COLORS.signal : COLORS.muted}
                content={shorten(account.address, inner)}
              />
            </box>
          )
        })
      )}
    </box>
  )
}
