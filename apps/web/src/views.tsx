/** The read views: a transaction, an account, and the accounts landing. Facts from view models, nothing derived here. */
import { formatMicroAlgos } from '@initlabs/vibekit-explorer'
import type {
  AccountPortfolioViewModel,
  TransactionDetailViewModel,
} from '@initlabs/vibekit-explorer'

export function shorten(value: string, width: number): string {
  if (value.length <= width) return value
  return `${value.slice(0, Math.ceil((width - 1) / 2))}…${value.slice(-Math.floor((width - 1) / 2))}`
}

export function TransactionDetail({
  model,
  onOpenSample,
  onOpenAccount,
}: {
  model: TransactionDetailViewModel | undefined
  onOpenSample: () => void
  onOpenAccount: (address: string) => void
}) {
  if (!model) {
    return (
      <section className="canvas empty">
        <p className="kicker">EXPLORER WORKSPACE</p>
        <h1>Explore Algorand</h1>
        <p>
          Look up a transaction by ID, or type <code>pay 0.5</code> below to walk a payment from
          draft to approval.
        </p>
        <div className="flow-actions">
          <button onClick={onOpenSample}>Open the sample transaction</button>
        </div>
      </section>
    )
  }
  return (
    <section className="canvas">
      <div className="section-heading">
        <div>
          <p className="kicker">TRANSACTION DETAIL</p>
          <h1>{model.type} transaction</h1>
        </div>
        <span className="status">{model.status}</span>
      </div>
      <p className="authoritative">Authoritative result · {model.network}</p>
      <dl className="facts">
        <div>
          <dt>ID</dt>
          <dd>{model.id}</dd>
        </div>
        <div>
          <dt>Sender</dt>
          <dd>
            {model.sender}{' '}
            <button className="inline-open" onClick={() => onOpenAccount(model.sender)}>
              open account
            </button>
          </dd>
        </div>
        <div>
          <dt>Receiver</dt>
          <dd>
            {model.receiver ?? '—'}{' '}
            {model.receiver ? (
              <button className="inline-open" onClick={() => onOpenAccount(model.receiver!)}>
                open account
              </button>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>
            {model.paymentAmountMicroAlgos === undefined
              ? '—'
              : `${formatMicroAlgos(model.paymentAmountMicroAlgos)} ALGO`}
          </dd>
        </div>
        <div>
          <dt>Fee</dt>
          <dd>{formatMicroAlgos(model.feeMicroAlgos)} ALGO</dd>
        </div>
        <div>
          <dt>Confirmed round</dt>
          <dd>{model.confirmedRound ?? '—'}</dd>
        </div>
      </dl>
    </section>
  )
}

export function AccountView({ model }: { model: AccountPortfolioViewModel | undefined }) {
  if (!model) {
    return (
      <section className="canvas empty">
        <p className="kicker">ACCOUNT</p>
        <h1>Account unavailable</h1>
        <p>The account record could not be derived.</p>
      </section>
    )
  }
  return (
    <section className="canvas">
      <div className="section-heading">
        <div>
          <p className="kicker">ACCOUNT</p>
          <h1>{formatMicroAlgos(model.balanceMicroAlgos)} ALGO</h1>
        </div>
        <span className="status">{model.network}</span>
      </div>
      <dl className="facts">
        <div>
          <dt>Address</dt>
          <dd>{model.address}</dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd>{formatMicroAlgos(model.balanceMicroAlgos)} ALGO</dd>
        </div>
        <div>
          <dt>Assets</dt>
          <dd>
            {model.totalAssets === 0
              ? 'No asset holdings'
              : model.assets.map((asset) => (
                  <span key={String(asset.assetId)} className="effect">
                    {String(asset.assetId)} · {asset.name ?? '—'} · {String(asset.amount)}
                    {asset.unitName ? ` ${asset.unitName}` : ''}
                    {asset.isFrozen ? ' · frozen' : ''}
                  </span>
                ))}
          </dd>
        </div>
      </dl>
    </section>
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
    <section className="canvas">
      <div className="section-heading">
        <div>
          <p className="kicker">ACCOUNTS</p>
          <h1>Your accounts</h1>
        </div>
      </div>
      <p className="authoritative">{note}</p>
      <div className="flow-actions account-rows">
        {accounts.map((account) => (
          <button key={account.address} onClick={() => onOpen(account.address)}>
            {account.name ?? 'Account'} <span className="group-bytes">{account.address}</span>
          </button>
        ))}
      </div>
      <p className="authoritative">Or paste any address into the composer below.</p>
    </section>
  )
}
