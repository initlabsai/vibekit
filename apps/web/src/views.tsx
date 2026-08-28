/** The read views: a transaction, an account, and the accounts landing. Facts from view models, nothing derived here. */
import { formatMicroAlgos } from '@initlabs/vibekit-explorer'
import type {
  AccountPortfolioViewModel,
  TransactionDetailViewModel,
} from '@initlabs/vibekit-explorer'

import { Button, Copyable, Fact, Facts, FooterNote, Frame, Header, Hero, Unavailable } from './primitives'

export function Welcome({ onOpenSample }: { onOpenSample: () => void }) {
  return (
    <Frame>
      <Header kicker="EXPLORER" />
      <Hero value="Explore Algorand" />
      <p className="muted">
        Paste a transaction id or an address, or type <code>pay 0.5</code> to walk a payment
        from draft to approval.
      </p>
      <div className="actions">
        <Button label="open the sample transaction" onPress={onOpenSample} />
      </div>
    </Frame>
  )
}

export function TransactionDetail({
  model,
  onOpenAccount,
}: {
  model: TransactionDetailViewModel | undefined
  onOpenAccount: (address: string) => void
}) {
  if (!model) return <Unavailable title="TRANSACTION" />
  const statusTone = model.status === 'confirmed' ? 'ok' : 'idle'
  return (
    <Frame>
      <Header kicker="TRANSACTION" chip={model.type} pill={model.status} tone={statusTone} />
      <Hero
        value={
          model.paymentAmountMicroAlgos === undefined
            ? `${model.type} transaction`
            : formatMicroAlgos(model.paymentAmountMicroAlgos)
        }
        unit={model.paymentAmountMicroAlgos === undefined ? undefined : 'ALGO'}
      />
      <Facts>
        <Fact label="id" value={model.id} copy={model.id} />
        <Fact label="sender">
          <Copyable value={model.sender} />{' '}
          <Button label="open" onPress={() => onOpenAccount(model.sender)} />
        </Fact>
        {model.receiver ? (
          <Fact label="receiver">
            <Copyable value={model.receiver} />{' '}
            <Button label="open" onPress={() => onOpenAccount(model.receiver!)} />
          </Fact>
        ) : null}
        <Fact label="fee" value={`${formatMicroAlgos(model.feeMicroAlgos)} ALGO`} />
        <Fact label="round" value={model.confirmedRound === undefined ? '—' : String(model.confirmedRound)} />
        <Fact label="network" value={model.network} />
      </Facts>
    </Frame>
  )
}

export function AccountView({ model }: { model: AccountPortfolioViewModel | undefined }) {
  if (!model) return <Unavailable title="ACCOUNT" />
  return (
    <Frame>
      <Header kicker="ACCOUNT" chip={model.network} />
      <Hero value={formatMicroAlgos(model.balanceMicroAlgos)} unit="ALGO" />
      <Facts>
        <Fact label="address" value={model.address} copy={model.address} />
        <Fact label="assets">
          {model.totalAssets === 0
            ? 'none'
            : model.assets.map((asset) => (
                <span key={String(asset.assetId)} className="line">
                  {String(asset.assetId)} · {asset.name ?? '—'} · {String(asset.amount)}
                  {asset.unitName ? ` ${asset.unitName}` : ''}
                  {asset.isFrozen ? ' · frozen' : ''}
                </span>
              ))}
        </Fact>
      </Facts>
    </Frame>
  )
}

export function AccountsLanding({
  accounts,
  note,
  onOpen,
}: {
  accounts: ReadonlyArray<{ address: string; name?: string }>
  note: string
  onOpen: (address: string) => void
}) {
  return (
    <Frame>
      <Header kicker="ACCOUNTS" />
      <Facts>
        {accounts.map((account) => (
          <Fact key={account.address} label={account.name ?? 'account'}>
            <Copyable value={account.address} width={24} />{' '}
            <Button label="open" onPress={() => onOpen(account.address)} />
          </Fact>
        ))}
      </Facts>
      <FooterNote text={note} />
    </Frame>
  )
}
